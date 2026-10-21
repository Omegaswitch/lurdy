import { t, type Enums, type Tables } from '@lurdy/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fmtDay, fmtTime, fromLocalInput, fullName } from '../format';
import { Icon, Notice } from '../icons';
import { affected, must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Affecting = { select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> };

type Assignment = { id: string; participant_id: string; boarded_at: string | null; arrived_at: string | null };
type Leg = Tables<'transport_legs'> & { leg_assignments: Assignment[] };
type Person = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'title' | 'category' | 'mobility'>;
const directions: Enums<'leg_direction'>[] = ['outbound', 'return', 'local'];
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Transport() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    async () => {
      const [legs, people, facilities] = await Promise.all([
        must(supabase.from('transport_legs').select('*, leg_assignments(id, participant_id, boarded_at, arrived_at)')
          .eq('edition_id', edition.id).order('departs_at', { nullsFirst: false }).order('sort').order('code')) as Promise<Leg[]>,
        must(supabase.from('participants').select('id, first_name, last_name, title, category, mobility')
          .eq('edition_id', edition.id).order('last_name')) as Promise<Person[]>,
        must(supabase.from('facilities').select('id, name').eq('edition_id', edition.id).order('sort')),
      ]);
      return { legs, people, facilities };
    },
    ['transport_legs', 'leg_assignments', 'participants'],
    edition.id,
    [edition.id],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = data?.legs.find((l) => l.id === selectedId) ?? data?.legs[0] ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('admin.transport')}</h1>
          <p>Lety, autobusy a kamion pro každou cestu zvlášť. Kapacitu hlídá databáze.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" width={18} /> Nový spoj</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {creating && <NewLeg facilities={data?.facilities ?? []} onDone={(id) => { setCreating(false); if (id) { setSelectedId(id); reload(); } }} />}
      {!data ? <div className="skeleton" style={{ width: 300 }} /> : data.legs.length === 0 ? (
        <p className="panel empty">Zatím žádné spoje. Začněte letem tam, pak autobusy z letiště.</p>
      ) : (
        <div className="board">
          <nav className="panel timetable" aria-label="Spoje">
            {directions.map((dir) => {
              const legs = data.legs.filter((l) => l.direction === dir);
              if (!legs.length) return null;
              return (
                <div key={dir}>
                  <h3>{t(`direction.${dir}`)}</h3>
                  {legs.map((l) => {
                    const n = l.leg_assignments.length;
                    const full = l.capacity != null && n >= l.capacity;
                    return (
                      <button key={l.id} aria-pressed={l.id === selected?.id} onClick={() => setSelectedId(l.id)}>
                        <span className="time">{fmtTime(l.departs_at, edition.timezone)}</span>
                        <span className="code">{l.code}</span>
                        <span className="route">
                          {t(`leg.${l.kind}`)}{l.destination && ` → ${l.destination}`}
                          {l.capacity != null && (
                            <>
                              <span className={`meter${full ? ' full' : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, (n / Math.max(1, l.capacity)) * 100)}%` }} /></span>
                              <span className="load">{n} / {l.capacity}{full && ` · ${t('admin.full')}`}</span>
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          {selected && <LegDetail key={selected.id} leg={selected} legs={data.legs} people={data.people} />}
        </div>
      )}
    </>
  );
}

function LegDetail({ leg, legs, people }: { leg: Leg; legs: Leg[]; people: Person[] }) {
  const { edition } = useReady();
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [moving, setMoving] = useState<string | null>(null); // the one row whose "move to" choice is open
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const onLeg = new Set(leg.leg_assignments.map((a) => a.participant_id));
  // People without any leg in this direction come first: they are the ones still to place.
  const placed = new Set(legs.filter((l) => l.direction === leg.direction).flatMap((l) => l.leg_assignments.map((a) => a.participant_id)));
  const candidates = people
    .filter((p) => !onLeg.has(p.id) && (!query.trim() || fold(`${p.first_name} ${p.last_name}`).includes(fold(query.trim()))))
    .sort((a, b) => Number(placed.has(a.id)) - Number(placed.has(b.id)))
    .slice(0, 8);
  const wheelchairs = leg.leg_assignments.filter((a) => byId.get(a.participant_id)?.mobility === 'wheelchair').length;
  const passengers = leg.leg_assignments
    .map((a) => ({ a, p: byId.get(a.participant_id) }))
    .filter((x): x is { a: Assignment; p: Person } => !!x.p)
    .sort((x, y) => x.p.last_name.localeCompare(y.p.last_name, 'cs'));

  // every change asks for the affected row back: zero rows (rights lapsed, row gone) is an error, not "Uloženo"
  const run = async (op: Affecting, ok: string) => {
    const { error } = await affected(op.select('id'));
    setMessage(error ? { kind: 'error', text: friendlyError(error) } : { kind: 'ok', text: ok });
  };

  return (
    <section className="panel" aria-label={`Spoj ${leg.code}`}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
        <h2>{t(`leg.${leg.kind}`)} {leg.code}{leg.label && ` · ${leg.label}`}</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
          {[leg.origin, leg.destination].filter(Boolean).join(' → ')}
          {leg.departs_at && ` · ${fmtDay(leg.departs_at, edition.timezone)} ${fmtTime(leg.departs_at, edition.timezone)}`}
          {' · '}{t('admin.capacity')}: {leg.leg_assignments.length}{leg.capacity != null ? ` / ${leg.capacity}` : ''}
          {' · '}{t('admin.wheelchairs')}: {wheelchairs} / {leg.wheelchair_capacity}
        </p>
        {wheelchairs > leg.wheelchair_capacity && (
          <div style={{ marginTop: 12 }}><Notice kind="warn">Na spoji je {wheelchairs} lidí na vozíku, ale jen {leg.wheelchair_capacity} míst pro vozík. Přesuňte {wheelchairs - leg.wheelchair_capacity} z nich, nebo navyšte místa.</Notice></div>
        )}
      </div>
      <div className="stack" style={{ padding: '16px 20px' }}>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <div className="field">
          <label htmlFor="add">{t('admin.addPassenger')}</label>
          <input id="add" type="search" placeholder="Začněte psát jméno" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query.trim() && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {candidates.length === 0 && <li style={{ color: 'var(--muted)' }}>{t('admin.noResults')}</li>}
            {candidates.map((p) => (
              <li key={p.id} className="row">
                <span style={{ flex: 1 }}>{fullName(p)} <span className={`tag ${p.category}`}>{t(`category.${p.category}`)}</span>
                  {!placed.has(p.id) && <span className="tag">{t('admin.unassigned')}</span>}</span>
                <button className="btn small" onClick={() => run(supabase.from('leg_assignments').insert({ leg_id: leg.id, participant_id: p.id, edition_id: leg.edition_id }), `${fullName(p)} přidán(a) do ${leg.code}.`)}>
                  <Icon name="plus" width={16} /> {t('common.add')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {passengers.length === 0 ? <p className="empty">Na tomto spoji zatím nikdo není.</p> : (
        <table>
          <thead><tr><th>{t('admin.passengers')}</th><th>Stav</th><th><span className="visually-hidden">{t('admin.moveTo')}</span></th><th><span className="visually-hidden">{t('admin.remove')}</span></th></tr></thead>
          <tbody>
            {passengers.map(({ a, p }) => (
              <tr key={a.id}>
                <td>{fullName(p)} <span className={`tag ${p.category}`}>{t(`category.${p.category}`)}</span>{p.mobility === 'wheelchair' && <> <span className="tag">{t('mobility.wheelchair')}</span></>}</td>
                <td>{a.arrived_at ? <span className="tag"><Icon name="check" width={12} /> Dorazil(a)</span> : a.boarded_at ? <span className="tag"><Icon name="check" width={12} /> {t('journey.boarded')}</span> : '—'}</td>
                <td>
                  {moving !== a.id ? <button className="btn quiet small" onClick={() => setMoving(a.id)}>{t('admin.moveTo')}…</button> : <>
                  <label className="visually-hidden" htmlFor={`mv-${a.id}`}>{t('admin.moveTo')}</label>
                  <select id={`mv-${a.id}`} value="" autoFocus onBlur={() => setMoving(null)} onChange={(e) => { setMoving(null); if (e.target.value) run(
                    supabase.from('leg_assignments').update({ leg_id: e.target.value }).eq('id', a.id),
                    `${fullName(p)} přesunut(a) do ${legs.find((l) => l.id === e.target.value)?.code}.`); }}>
                    <option value="">—</option>
                    {legs.filter((l) => l.id !== leg.id && l.direction === leg.direction && !l.leg_assignments.some((x) => x.participant_id === p.id))
                      .map((l) => <option key={l.id} value={l.id}>{t(`leg.${l.kind}`)} {l.code}</option>)}
                  </select></>}
                </td>
                <td className="num">
                  <button className="btn quiet small" onClick={() => run(supabase.from('leg_assignments').delete().eq('id', a.id), `${fullName(p)} odebrán(a) z ${leg.code}.`)}>
                    {t('admin.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function NewLeg({ facilities, onDone }: { facilities: { id: string; name: string }[]; onDone: (id: string | null) => void }) {
  const { edition } = useReady();
  const [f, setF] = useState({ kind: 'bus' as Enums<'leg_kind'>, direction: 'outbound' as Enums<'leg_direction'>, code: '', label: '', origin: '', destination: '',
    departs: '', capacity: '50', wheelchair: '0', facility: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.code.trim()) return setError('Vyplňte označení spoje (např. A nebo číslo letu).');
    setBusy(true);
    const { data, error: err } = await supabase.from('transport_legs').insert({
      edition_id: edition.id, kind: f.kind, direction: f.direction, code: f.code.trim(), label: f.label.trim() || null,
      origin: f.origin.trim() || null, destination: f.destination.trim() || null, departs_at: fromLocalInput(f.departs, edition.timezone),
      capacity: f.capacity ? Number(f.capacity) : null, wheelchair_capacity: Number(f.wheelchair) || 0, facility_id: f.facility || null,
    }).select('id').single();
    setBusy(false);
    if (err) return setError(friendlyError(err));
    onDone(data.id);
  }

  return (
    <form className="panel stack" style={{ padding: 20, marginBottom: 24 }} onSubmit={save}>
      <h2>Nový spoj</h2>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field"><label htmlFor="k">Druh</label>
          <select id="k" value={f.kind} onChange={(e) => set('kind', e.target.value)}>{(['flight', 'bus', 'truck', 'other'] as const).map((k) => <option key={k} value={k}>{t(`leg.${k}`)}</option>)}</select></div>
        <div className="field"><label htmlFor="d">Směr</label>
          <select id="d" value={f.direction} onChange={(e) => set('direction', e.target.value)}>{directions.map((d) => <option key={d} value={d}>{t(`direction.${d}`)}</option>)}</select></div>
        <div className="field"><label htmlFor="c">Označení</label><input id="c" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="A" style={{ width: 120 }} /></div>
        <div className="field"><label htmlFor="o">Odkud</label><input id="o" value={f.origin} onChange={(e) => set('origin', e.target.value)} /></div>
        <div className="field"><label htmlFor="to">Kam</label><input id="to" value={f.destination} onChange={(e) => set('destination', e.target.value)} /></div>
        <div className="field"><label htmlFor="dt">Odjezd ({edition.timezone})</label><input id="dt" type="datetime-local" value={f.departs} onChange={(e) => set('departs', e.target.value)} /></div>
        <div className="field"><label htmlFor="cap">Míst</label><input id="cap" type="number" min={0} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} style={{ width: 90 }} /></div>
        <div className="field"><label htmlFor="wc">Vozíků</label><input id="wc" type="number" min={0} value={f.wheelchair} onChange={(e) => set('wheelchair', e.target.value)} style={{ width: 90 }} /></div>
        <div className="field"><label htmlFor="fa">Cíl (ubytování)</label>
          <select id="fa" value={f.facility} onChange={(e) => set('facility', e.target.value)}><option value="">—</option>{facilities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      </div>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{t('common.save')}</button>
        <button className="btn" type="button" onClick={() => onDone(null)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
