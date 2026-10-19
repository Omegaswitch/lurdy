import { defaultBadgeConfig, impose, paginate, t, validateBadgeConfig, type BadgeConfig, type Category, type Tables } from '@lurdy/shared';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { friendlyError } from '../errors';
import { fmtStamp, fullName } from '../format';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useAuth, useReady } from '../session';
import { supabase } from '../supabase';

type Row = Pick<Tables<'participants'>, 'id' | 'title' | 'first_name' | 'last_name' | 'preferred_name' | 'category'> & {
  room_assignments: { rooms: { facilities: { short_label: string | null; name: string; colour: string | null } | null } | null } | null;
  leg_assignments: { transport_legs: { code: string; kind: string; direction: string } | null }[];
  credentials: { id: string; kind: string; revoked_at: string | null }[];
};
type Printed = { row: Row; svg: string };
type Batch = { id: string; items: Printed[]; at: string };
type Pending = { batch_id: string; participant_id: string; issued_at: string };
type Config = BadgeConfig & { heading: string };
const HEADING = 'PÈLERINAGE MALTE TCHÈQUE';

// Printing issues a *pending* QR per person: the badge they already have keeps working until the organiser
// confirms the print (Aktivovat), which is when the old badge stops. A failed print is discarded. The QR texts
// exist only in this tab (and in its session storage, so a closed preview does not lose them); they vanish when
// the tab closes.
const batchKey = (editionId: string) => `badges:lastPrint:${editionId}`;
const readBatch = (editionId: string): Batch | null => {
  try { return JSON.parse(sessionStorage.getItem(batchKey(editionId)) ?? 'null'); } catch { return null; }
};

export function Badges() {
  const { edition } = useReady();
  const { refresh } = useAuth();
  const { data, error, reload } = useLive(
    () => must(supabase.from('participants')
      .select('id, title, first_name, last_name, preferred_name, category, room_assignments(rooms(facilities(short_label, name, colour))), leg_assignments(transport_legs(code, kind, direction)), credentials(id, kind, revoked_at)')
      .eq('edition_id', edition.id).order('last_name').order('first_name')) as Promise<Row[]>,
    ['participants', 'room_assignments', 'leg_assignments'],
    edition.id,
    [edition.id],
  );
  const { data: pending, reload: reloadPending } = useLive(
    () => must(supabase.from('pending_credentials').select('batch_id, participant_id, issued_at').eq('edition_id', edition.id)
      .is('activated_at', null).is('discarded_at', null).order('issued_at')) as Promise<Pending[]>,
    [], edition.id, [edition.id],
  );
  const [config, setConfig] = useState<Config>(() => ({ ...defaultBadgeConfig, heading: HEADING, ...(edition.badge_config as Partial<Config>) }));
  const [filter, setFilter] = useState<'all' | 'unprinted' | Category>('unprinted');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [printed, setPrinted] = useState<Batch | null>(null);
  const [lastBatch, setLastBatch] = useState<Batch | null>(() => readBatch(edition.id));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok' | 'warn'; text: string } | null>(null);
  const layout = useMemo(() => impose(config), [config]);
  const batches = useMemo(() => {
    const m = new Map<string, Pending[]>();
    for (const p of pending ?? []) m.set(p.batch_id, [...(m.get(p.batch_id) ?? []), p]);
    return [...m.entries()].map(([id, rows]) => ({ id, rows, at: rows[0]!.issued_at }));
  }, [pending]);
  const nameOf = (id: string) => { const r = (data ?? []).find((x) => x.id === id); return r ? fullName(r) : '…'; };

  async function activate(batchId: string) {
    setBusy(true);
    const { data: n, error: err } = await supabase.rpc('activate_batch', { p_batch: batchId });
    setBusy(false);
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: `Aktivováno ${n} jmenovek. Dřívější jmenovky těchto lidí už neplatí.` });
    if (!err) { if (printed?.id === batchId) setPrinted(null); reloadPending(); reload(); }
  }
  async function discard(batchId: string) {
    setBusy(true);
    const { error: err } = await supabase.rpc('discard_batch', { p_batch: batchId });
    setBusy(false);
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: 'Tisk zahozen. Dosavadní jmenovky platí dál.' });
    if (!err) { if (printed?.id === batchId) setPrinted(null); reloadPending(); }
  }
  const configErrors = validateBadgeConfig(config);

  const hasCard = (r: Row) => r.credentials.some((c) => c.kind === 'card' && !c.revoked_at);
  const rows = (data ?? []).filter((r) => filter === 'all' || (filter === 'unprinted' ? !hasCard(r) : r.category === filter));
  // only people visible in the table can be printed: a selection made under another filter is dropped
  const list = rows.filter((r) => chosen.has(r.id));
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const changeFilter = (f: typeof filter) => { setFilter(f); setChosen(new Set()); setConfirming(false); };

  // After the sheets are rendered, open the print dialog (Save as PDF works the same way). Safari ignores the named
  // page `badges`, so the zero margin is also set globally while the preview is up.
  useEffect(() => {
    if (!printed) return;
    const style = document.createElement('style');
    style.textContent = '@media print{@page{margin:0}}';
    document.head.appendChild(style);
    requestAnimationFrame(() => window.print());
    return () => { style.remove(); };
  }, [printed]);

  async function saveConfig() {
    const { data: ok, error: err } = await supabase.from('editions').update({ badge_config: config }).eq('id', edition.id).eq('version', edition.version).select('id');
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : !ok?.length ? { kind: 'warn', text: t('common.conflict') } : { kind: 'ok', text: 'Rozvržení uloženo pro tento ročník.' });
    if (!err) await refresh(); // the edition's version moved on; the next save must use it
  }

  function requestPrint() {
    if (!list.length) return;
    if (list.some(hasCard)) setConfirming(true);
    else print();
  }

  async function print() {
    setConfirming(false);
    if (!list.length) return;
    setBusy(true);
    setMessage(null);
    const items: Printed[] = [];
    const batchId = crypto.randomUUID();
    try {
      for (const row of list) {
        const { data: payload, error: err } = await supabase.rpc('issue_pending_credential', { p_participant: row.id, p_batch: batchId });
        if (err || !payload) throw err ?? new Error('no payload');
        items.push({ row, svg: await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: `${friendlyError(e as Error)} Nové kódy dostalo ${items.length} z ${list.length} lidí; ti jsou v náhledu níže.` });
    } finally {
      setBusy(false);
    }
    if (items.length) {
      const batch: Batch = { id: batchId, items, at: new Date().toISOString() };
      try { sessionStorage.setItem(batchKey(edition.id), JSON.stringify(batch)); } catch { /* storage full or blocked: the preview still shows */ }
      setLastBatch(batch);
      setPrinted(batch);
      setChosen(new Set());
      reloadPending();
    }
  }

  const num = (k: keyof BadgeConfig, label: string, step = 1) => (
    <div className="field"><label htmlFor={k}>{label}</label>
      <input id={k} type="number" step={step} value={config[k] as number} style={{ width: 90 }}
        onChange={(e) => setConfig((c) => ({ ...c, [k]: e.target.value === '' ? c[k] : Number(e.target.value) }))} /></div>
  );
  const flag = (k: keyof BadgeConfig, label: string) => (
    <label className="checkbox"><input type="checkbox" checked={config[k] as boolean} onChange={(e) => setConfig((c) => ({ ...c, [k]: e.target.checked }))} /> {label}</label>
  );
  const reprint = list.filter(hasCard);

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>{t('admin.badges')}</h1>
          <p>Jednostranné jmenovky do pouzdra na šňůrku. QR kód nese jen náhodný identifikátor – při naskenování se vždy zobrazí aktuální údaje.</p>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <div className="no-print" style={{ marginBottom: 16 }}><Notice kind={message.kind}>{message.text}</Notice></div>}

      <section className="panel stack no-print" style={{ padding: 20, marginBottom: 24 }} aria-label="Rozvržení">
        <h2>Rozvržení</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          {num('widthMm', 'Šířka (mm)', 0.5)}{num('heightMm', 'Výška (mm)', 0.5)}{num('marginMm', 'Okraj listu (mm)', 0.5)}{num('gapMm', 'Mezera (mm)', 0.5)}
          {num('offsetXMm', 'Posun X (mm)', 0.5)}{num('offsetYMm', 'Posun Y (mm)', 0.5)}
          <div className="field" style={{ minWidth: 260 }}><label htmlFor="hd">Nadpis</label>
            <input id="hd" value={config.heading} onChange={(e) => setConfig((c) => ({ ...c, heading: e.target.value }))} /></div>
        </div>
        <div className="row">
          {flag('cropMarks', 'Ořezové značky')}{flag('showBus', 'Autobus')}{flag('showFacility', 'Ubytování')}{flag('showEmergencyPhone', 'Nouzový telefon')}
          {flag('showCategory', 'Kategorie')}
        </div>
        {config.showCategory && <Notice kind="info">Kategorie se tiskne velkým písmem. „Nemocný“ je zdravotní údaj – účastníci by o tom měli vědět z přihlášky.</Notice>}
        {configErrors.length > 0 ? <Notice kind="error">Jmenovka se na A4 nevejde nebo má nesmyslný rozměr.</Notice>
          : <p style={{ margin: 0, color: 'var(--muted)' }}>{layout.columns} × {layout.rows} = {layout.perSheet} jmenovek na list A4.</p>}
        <div><button className="btn" onClick={saveConfig} disabled={configErrors.length > 0}>{t('common.save')}</button></div>
      </section>

      <section className="panel no-print" aria-label="Výběr">
        <div className="toolbar">
          <label className="visually-hidden" htmlFor="flt">Filtr</label>
          <select id="flt" value={filter} onChange={(e) => changeFilter(e.target.value as typeof filter)}>
            <option value="unprinted">Bez platné jmenovky</option>
            <option value="all">Všichni</option>
            {(['pilgrim', 'malade', 'assistant', 'staff'] as Category[]).map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select>
          <button className="btn small" disabled={!rows.length} onClick={() => setChosen(new Set(rows.map((r) => r.id)))}>{t('admin.selectAll')} ({rows.length})</button>
          <span style={{ marginLeft: 'auto' }}>{t('admin.selected')}: {list.length}</span>
          <button className="btn primary" onClick={requestPrint} disabled={!list.length || busy || configErrors.length > 0} aria-busy={busy}>
            <Icon name="printer" width={18} /> {busy ? t('common.loading') : t('admin.printBadges')}
          </button>
        </div>
        {confirming && (
          <div style={{ padding: '0 16px 16px' }} role="alertdialog" aria-labelledby="reprint-title">
            <Notice kind="warn">
              <strong id="reprint-title">{t('admin.printWarning')}</strong>{' '}
              Týká se: {reprint.slice(0, 8).map(fullName).join(', ')}{reprint.length > 8 ? ` a dalších ${reprint.length - 8}` : ''}.
              Jejich dosavadní jmenovky platí, dokud tisk nepotvrdíte tlačítkem „Aktivovat“; potom začnou platit nové a staré ukážou „Neplatná jmenovka“.
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={print}>Vytisknout nové</button>
                <button className="btn" onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
              </div>
            </Notice>
          </div>
        )}
        {!data ? <div className="skeleton" style={{ margin: 16 }} /> : rows.length === 0 ? <p className="empty">Všichni v tomto výběru už mají platnou jmenovku.</p> : (
          <table>
            <thead><tr><th><span className="visually-hidden">Vybrat</span></th><th>Jméno</th><th>{t('admin.category')}</th><th>Ubytování</th><th>Jmenovka</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const f = r.room_assignments?.rooms?.facilities;
                return (
                  <tr key={r.id} className="clickable" onClick={() => toggle(r.id)}>
                    <td><input type="checkbox" aria-label={fullName(r)} checked={chosen.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} style={{ width: 18, height: 18 }} /></td>
                    <td>{fullName(r)}</td>
                    <td><span className={`tag ${r.category}`}>{t(`category.${r.category}`)}</span></td>
                    <td>{f ? <span className="tag"><i style={{ background: f.colour ?? '#999' }} />{f.short_label ?? f.name}</span> : '—'}</td>
                    <td>{hasCard(r) ? 'platná' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {batches.length > 0 && (
        <section className="panel stack" style={{ padding: 20, marginTop: 24 }} aria-label="Čekající tisky">
          <h2>Vytištěno, čeká na potvrzení</h2>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Nové jmenovky začnou platit až po aktivaci. Do té doby je skener hlásí jako „ještě není aktivní“ a dosavadní jmenovky platí dál.</p>
          {batches.map((b) => (
            <div key={b.id} className="row" style={{ alignItems: 'center', gap: 12 }} data-testid="pending-batch">
              <span>{fmtStamp(new Date(b.at))} · {b.rows.length} {b.rows.length === 1 ? 'jmenovka' : b.rows.length < 5 ? 'jmenovky' : 'jmenovek'}: {b.rows.slice(0, 5).map((r) => nameOf(r.participant_id)).join(', ')}{b.rows.length > 5 ? '…' : ''}</span>
              <button className="btn primary small" onClick={() => activate(b.id)} disabled={busy}>Aktivovat – vytištěno v pořádku</button>
              <button className="btn small" onClick={() => discard(b.id)} disabled={busy}>Zahodit – tisk se nepovedl</button>
            </div>
          ))}
        </section>
      )}

      {!printed && lastBatch && (batches.some((b) => b.id === lastBatch.id)) && (
        <p className="no-print" style={{ marginTop: 16 }}>
          Poslední tisk ({fmtStamp(new Date(lastBatch.at))}, {lastBatch.items.length} jmenovek) lze otevřít znovu, dokud nezavřete tuto záložku – třeba když se tisk nepovedl.{' '}
          <button className="btn small" onClick={() => setPrinted(lastBatch)}><Icon name="printer" width={16} /> Znovu otevřít poslední tisk</button>
        </p>
      )}

      {printed && (
        <div aria-label="Náhled tisku">
          <p className="no-print" style={{ marginTop: 24 }}>
            Náhled {printed.items.length} jmenovek. <button className="btn small" onClick={() => window.print()}><Icon name="printer" width={16} /> {t('admin.print')}</button>{' '}
            <button className="btn small quiet" onClick={() => setPrinted(null)}>{t('common.close')}</button>
          </p>
          {paginate(printed.items, layout.perSheet).map((page, i, pages) => (
            <div className="sheet" key={i}>
              {page.map((item, j) => <Badge key={item.row.id} item={item} config={config} at={layout.slots[j]!} />)}
              {config.cropMarks && page.map((_, j) => <CropMarks key={j} at={layout.slots[j]!} config={config} />)}
              <div className="print-meta">{t('app.name')} {edition.year} · {edition.title} · {t('admin.printedAt')} {fmtStamp(new Date(printed.at))} · list {i + 1}/{pages.length}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Badge({ item, config, at }: { item: Printed; config: Config; at: { xMm: number; yMm: number } }) {
  const { edition } = useReady();
  const r = item.row;
  const facility = r.room_assignments?.rooms?.facilities;
  const bus = r.leg_assignments.map((a) => a.transport_legs).find((l) => l?.kind === 'bus' && l.direction === 'outbound');
  return (
    <div className="badge" style={{ left: `${at.xMm}mm`, top: `${at.yMm}mm`, width: `${config.widthMm}mm`, height: `${config.heightMm}mm` }}>
      <div className="head"><img src="/img/shield.svg" alt="" /><span>{config.heading}</span></div>
      <div className="name">{r.preferred_name || [r.title, r.first_name].filter(Boolean).join(' ')} {r.last_name}</div>
      {/* bus and attendee type are the largest elements: read at a glance at the airport and at the bus door */}
      {((config.showBus && bus) || config.showCategory) && (
        <div className="big">
          {config.showBus && bus && <span className={`bus${bus.code.length > 2 ? ' long' : ''}`}><small>BUS</small>{bus.code}</span>}
          {config.showCategory && <span className="cat">{t(`category.${r.category}`)}</span>}
        </div>
      )}
      <div className="qr" dangerouslySetInnerHTML={{ __html: item.svg }} />
      <div className="foot">
        {config.showFacility && facility && <div><strong>{facility.short_label ?? facility.name}</strong></div>}
        {config.showEmergencyPhone && edition.emergency_phone && <div>SOS {edition.emergency_phone}</div>}
      </div>
      {config.showFacility && facility?.colour && <div className="band" style={{ background: facility.colour }} />}
    </div>
  );
}

// Corner marks just outside each card, in the gap.
function CropMarks({ at, config }: { at: { xMm: number; yMm: number }; config: Config }) {
  const o = 1; // mm from the card edge
  const corners = [
    [at.xMm, at.yMm, -1, -1], [at.xMm + config.widthMm, at.yMm, 1, -1],
    [at.xMm, at.yMm + config.heightMm, -1, 1], [at.xMm + config.widthMm, at.yMm + config.heightMm, 1, 1],
  ] as const;
  return (
    <>
      {corners.map(([x, y, dx, dy], i) => (
        <svg key={i} aria-hidden="true" style={{ position: 'absolute', left: `${x - 4}mm`, top: `${y - 4}mm`, width: '8mm', height: '8mm', overflow: 'visible' }} viewBox="-4 -4 8 8">
          <line x1={dx * o} y1={0} x2={dx * (o + 3)} y2={0} stroke="#000" strokeWidth={0.15} />
          <line x1={0} y1={dy * o} x2={0} y2={dy * (o + 3)} stroke="#000" strokeWidth={0.15} />
        </svg>
      ))}
    </>
  );
}
