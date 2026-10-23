import { fee, inView, nextLetter, overview, regViews, typeCode, validEmail, type Due, type RegPerson, type RegView, type Tables } from '@lurdy/shared';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { friendlyError } from '../errors';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useAuth, useReady } from '../session';
import { supabase } from '../supabase';

// The registration register: what the organisers kept for years in the "Participants" tab of their Google Sheet
// (one row per person, a personal number, P / M / T, waiting list and cancelled ticks, the letter last sent,
// payments), shown as a working list. Every rule (fees, the letter due, the tabs, the overview) comes from
// @lurdy/shared/register, so the screen, the prints and the tests agree. Nobody is deleted: cancelling is a tick.
const cols = 'id, first_name, last_name, category, email, phone, varsym, waiting, cancelled, confirmed, mail_sent, gender, birth_year, previous_count, registered_on, stays, travels_with, room_no, is_nurse, is_doctor, is_priest, is_smom, is_lead, luggage_team, plane_to_accueil, truck_driver, no_flight';
type Row = RegPerson & { phone: string | null; previous_count: number | null; registered_on: string | null; travels_with: string | null; room_no: string | null };
type Private = Tables<'participant_private'>;
type RoleFlag = 'is_nurse' | 'is_doctor' | 'is_priest' | 'is_smom' | 'is_lead' | 'luggage_team' | 'plane_to_accueil' | 'truck_driver';

const roleFlags: { key: RoleFlag; label: string; hint?: string }[] = [
  { key: 'is_nurse', label: 'Sestra' }, { key: 'is_doctor', label: 'Lékař' }, { key: 'is_priest', label: 'Kněz' },
  { key: 'is_smom', label: 'SMOM' }, { key: 'is_lead', label: 'Vedení' },
  { key: 'luggage_team', label: 'Zavazadla', hint: 'tým v hotelu, jede hotelovým autobusem' },
  { key: 'plane_to_accueil', label: 'Z letiště do Accueil', hint: 'doprovází nemocné rovnou z letadla' },
  { key: 'truck_driver', label: 'Kamion', hint: 'řídí auto se zavazadly' },
];
const typeLabel = { P: 'Poutník', M: 'Nemocný', T: 'Tým' } as const;
const letterLabel: Record<string, string> = { w: 'čekací listina', x: 'potvrzení účasti', o: 'potvrzení platby' };
const czk = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`;
// Czech counts: 1 muž, 2-4 muži, 5+ mužů
const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
const regDate = (d: string | null) => (d ? d.split('-').reverse().slice(0, 2).map(Number).join('. ') + '.' : '–');

export function Register() {
  const { edition, roles, superAdmin } = useReady();
  const { refresh } = useAuth();
  const allowed = superAdmin || roles.includes('organizer');
  const [view, setView] = useState<RegView>('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const { data, error } = useLive(async () => {
    const [people, priv] = await Promise.all([
      must(supabase.from('participants').select(cols).eq('edition_id', edition.id).order('varsym')) as Promise<Row[]>,
      must(supabase.from('participant_private').select('*').eq('edition_id', edition.id)) as Promise<Private[]>,
    ]);
    return { people, priv: new Map(priv.map((p) => [p.participant_id, p])) };
  }, ['participants', 'participant_private'], edition.id, [edition.id]);
  // edits show at once; the live reload (triggered by the write itself) then carries them, so they are forgotten
  const [local, setLocal] = useState<Record<string, Partial<Row>>>({});
  const [localPriv, setLocalPriv] = useState<Record<string, Partial<Private>>>({});
  useEffect(() => { setLocal({}); setLocalPriv({}); }, [data]);

  const people = useMemo(() => (data?.people ?? []).map((p) => ({ ...p, ...local[p.id] }) as Row), [data, local]);
  const priv = (id: string) => ({ ...data?.priv.get(id), ...localPriv[id] }) as Partial<Private>;
  const paidOf = (p: RegPerson) => priv(p.id).paid_czk ?? 0;
  const year = edition.year;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) => inView(p, view, year) && (!q || `${p.first_name} ${p.last_name} ${p.email ?? ''} ${p.varsym ?? ''}`.toLowerCase().includes(q)));
  }, [people, view, query, year]);

  if (!allowed) return <Notice kind="warn">Registr vidí jen organizátoři.</Notice>;

  async function save(ids: string[], patch: Partial<Row>) {
    setLocal((l) => Object.fromEntries([...Object.entries(l), ...ids.map((id) => [id, { ...l[id], ...patch }])]));
    const { error: e } = await supabase.from('participants').update(patch).in('id', ids);
    if (e) {
      setMessage(friendlyError(e));
      setLocal((l) => Object.fromEntries(Object.entries(l).filter(([id]) => !ids.includes(id))));
    }
  }
  async function savePriv(p: Row, patch: Partial<Private>) {
    setLocalPriv((l) => ({ ...l, [p.id]: { ...l[p.id], ...patch } }));
    // only the changed column: a colleague's concurrent edit of another column stays
    const { error: e } = await supabase.from('participant_private').upsert({ participant_id: p.id, edition_id: edition.id, ...patch });
    if (e) { setMessage(friendlyError(e)); setLocalPriv((l) => { const n = { ...l }; delete n[p.id]; return n; }); }
  }

  const ov = overview(people, paidOf, edition, year);
  const dueOf = (p: Row) => nextLetter(p, paidOf(p), fee(p, edition));
  const letters = people.filter((p) => { const d = dueOf(p); return d === 'w' || d === 'x' || d === 'o'; }).length;
  const noMail = people.filter((p) => !p.cancelled && dueOf(p) === 'nomail').length;
  const finding = !data ? '' : [
    plural(ov.team.participants + ov.malades.participants + ov.pilgrims.participants, 'přihlášený', 'přihlášení', 'přihlášených'),
    letters ? `${plural(letters, 'dopis', 'dopisy', 'dopisů')} k odeslání` : 'všechny dopisy odeslány',
    noMail ? `${noMail} bez platného e-mailu` : null,
    ov.money.unpaid ? `zbývá vybrat ${czk(ov.money.unpaid)}` : 'vše zaplaceno',
  ].filter(Boolean).join(' · ');
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visibleSelected = rows.filter((r) => selected.has(r.id));

  return (
    <div className="reg">
      <header className="reg-head">
        <div>
          <h1>Registr</h1>
          <p className="reg-finding">{finding}</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" width={18} /> Přidat osobu</button>
      </header>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <div className="reg-msg"><Notice kind="error">{message}</Notice><button className="btn quiet small" onClick={() => setMessage(null)}>Zavřít</button></div>}
      {adding && <AddPerson editionId={edition.id} onDone={() => setAdding(false)} onError={setMessage} />}

      <Plane ov={ov} edition={edition} letters={letters} noMail={noMail} onSaved={refresh} />

      <nav className="reg-tabs" aria-label="Seznamy">
        {regViews.map((v) => {
          const n = people.filter((p) => inView(p, v.key, year)).length;
          return (
            <button key={v.key} aria-pressed={v.key === view} onClick={() => { setView(v.key); setSelected(new Set()); }}>
              {v.label} <span className="n">{n}</span>
            </button>
          );
        })}
      </nav>

      <div className="reg-tools">
        <label className="reg-search">
          <Icon name="search" width={16} />
          <span className="visually-hidden">Hledat</span>
          <input type="search" placeholder="Hledat jméno, e-mail nebo VarSym" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {visibleSelected.length > 0 ? (
          <div className="reg-bulk" role="group" aria-label="Hromadné úpravy">
            <span><b>{visibleSelected.length}</b> vybráno</span>
            <span className="sep" />
            <span className="muted">Dopis odeslán:</span>
            {(['w', 'x', 'o'] as const).map((l) => (
              <button key={l} className="btn small" title={letterLabel[l]} onClick={() => save(visibleSelected.map((r) => r.id), { mail_sent: l })}>{letterLabel[l]}</button>
            ))}
            <button className="btn small" onClick={() => save(visibleSelected.map((r) => r.id), { confirmed: true })}>Potvrdili účast</button>
            <button className="btn quiet small" onClick={() => setSelected(new Set())}>Zrušit výběr</button>
          </div>
        ) : (
          <span className="reg-count">{plural(rows.length, 'osoba', 'osoby', 'osob')}</span>
        )}
      </div>

      <section className="panel reg-list" aria-label="Seznam přihlášených">
        {!data ? <p className="reg-empty">Načítá se…</p> : rows.length === 0 ? (
          <p className="reg-empty">{query ? 'Hledání nic nenašlo.' : view === 'waiting' ? 'Na čekací listině nikdo není.' : view === 'cancelled' ? 'Nikdo se neodhlásil.' : 'V tomto seznamu zatím nikdo není.'}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="pick"><input type="checkbox" aria-label="Vybrat vše v seznamu" checked={rows.every((r) => selected.has(r.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
                <th className="num">VarSym</th><th>Jméno a kontakt</th><th>Typ</th><th>Role</th><th>Stav</th><th>Dopis</th><th className="num">Platba</th><th><span className="visually-hidden">Upravit</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const price = fee(p, edition), paid = paidOf(p), due = dueOf(p);
                const isOpen = open === p.id;
                return (
                  <PersonRow key={p.id} p={p} price={price} paid={paid} due={due} open={isOpen} selected={selected.has(p.id)}
                    onSelect={() => toggle(p.id)} onOpen={() => setOpen(isOpen ? null : p.id)}>
                    {isOpen && <Detail p={p} price={price} priv={priv(p.id)} save={(patch) => save([p.id], patch)} savePriv={(patch) => savePriv(p, patch)} />}
                  </PersonRow>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function PersonRow({ p, price, paid, due, open, selected, onSelect, onOpen, children }: {
  p: Row; price: number; paid: number; due: Due; open: boolean; selected: boolean; onSelect: () => void; onOpen: () => void; children: ReactNode;
}) {
  const name = `${p.last_name} ${p.first_name}`;
  const roles = roleFlags.filter((f) => p[f.key]);
  const code = typeCode(p.category);
  return (
    <>
      <tr className={`${p.cancelled ? 'is-cancelled' : ''}${open ? ' is-open' : ''}`} aria-selected={selected || undefined}>
        <td className="pick"><input type="checkbox" aria-label={`Vybrat ${name}`} checked={selected} onChange={onSelect} /></td>
        <td className="num varsym">{p.varsym}</td>
        <td className="who">
          <button className="name" onClick={onOpen} aria-expanded={open}>{name}</button>
          <span className="sub">
            {p.email && validEmail(p.email) ? p.email : <span className="bad"><Icon name="alert" width={13} /> {p.email ? 'neplatný e-mail' : 'bez e-mailu'}</span>}
            {p.phone && <> · {p.phone}</>}
          </span>
          <span className="sub m-only">
            {typeLabel[code]} · {p.cancelled ? 'zrušeno' : p.waiting ? 'čekací listina' : p.confirmed ? `potvrdil${p.gender === 'F' ? 'a' : ''} účast` : `přihlášen${p.gender === 'F' ? 'a' : ''}`}
            {(due === 'w' || due === 'x' || due === 'o') && <> · <span className="due">poslat: {letterLabel[due]}</span></>}
            {price > 0 && <> · {paid >= price ? 'zaplaceno' : `zbývá ${czk(price - paid)}`}</>}
          </span>
        </td>
        <td><span className="type">{typeLabel[code]}</span><span className="sub">{p.stays === 'A' ? 'Accueil' : 'Hotel'}{p.no_flight ? ' · bez letadla' : ''}</span></td>
        <td className="roles">{roles.length ? roles.map((r) => <span key={r.key} className="tag" title={r.hint}>{r.label}</span>) : <span className="dash">–</span>}</td>
        <td>
          {p.cancelled ? <span className="pill off">Zrušeno</span> : p.waiting ? <span className="pill wait">Čekací listina</span> : <span className="state">Přihlášen{p.gender === 'F' ? 'a' : ''}</span>}
          {p.confirmed && !p.cancelled && <span className="sub ok"><Icon name="check" width={13} /> potvrdil{p.gender === 'F' ? 'a' : ''} účast</span>}
        </td>
        <td>
          <span className="sent">{p.mail_sent ? letterLabel[p.mail_sent] : <span className="dash">nic neodesláno</span>}</span>
          {(due === 'w' || due === 'x' || due === 'o') && <span className="sub due">poslat: {letterLabel[due]}</span>}
        </td>
        <td className="num money">
          {price ? (paid >= price ? <span className="ok">zaplaceno</span> : <><span className="paid">{czk(paid)}</span><span className="sub">z {czk(price)}</span></>) : <span className="dash">–</span>}
        </td>
        <td className="chev"><button className="btn quiet small" onClick={onOpen} aria-expanded={open} aria-label={`${open ? 'Zavřít' : 'Upravit'} ${name}`}><Icon name="chevron" width={18} className={open ? 'rot' : ''} /></button></td>
      </tr>
      {open && <tr className="detail-row"><td colSpan={9}>{children}</td></tr>}
    </>
  );
}

function Detail({ p, price, priv, save, savePriv }: { p: Row; price: number; priv: Partial<Private>; save: (patch: Partial<Row>) => void; savePriv: (patch: Partial<Private>) => void }) {
  const id = (k: string) => `d-${p.id}-${k}`;
  const code = typeCode(p.category);
  return (
    <div className="reg-detail">
      <fieldset>
        <legend>Osoba</legend>
        <Text id={id('fn')} label="Jméno" value={p.first_name} required onSave={(v) => save({ first_name: v! })} />
        <Text id={id('ln')} label="Příjmení" value={p.last_name} required onSave={(v) => save({ last_name: v! })} />
        <div className="field"><label htmlFor={id('ty')}>Typ</label>
          <select id={id('ty')} value={code} onChange={(e) => save({ category: e.target.value === 'P' ? 'pilgrim' : e.target.value === 'M' ? 'malade' : p.category === 'staff' ? 'staff' : 'assistant' })}>
            <option value="P">Poutník</option><option value="M">Nemocný</option><option value="T">Tým</option>
          </select></div>
        <div className="pair2">
          <div className="field"><label htmlFor={id('g')}>Pohlaví</label>
            <select id={id('g')} value={p.gender ?? ''} onChange={(e) => save({ gender: e.target.value || null })}><option value="">–</option><option value="M">muž</option><option value="F">žena</option></select></div>
          <Text id={id('by')} label="Rok narození" value={p.birth_year?.toString() ?? null} numeric onSave={(v) => save({ birth_year: v ? Number(v) : null })} />
        </div>
        <div className="pair2">
          <Text id={id('pc')} label="Předchozí poutě" value={p.previous_count?.toString() ?? null} numeric onSave={(v) => save({ previous_count: v ? Number(v) : null })} />
          <div className="field"><span className="label">Registrace</span><span className="static">{regDate(p.registered_on)}</span></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Kontakt</legend>
        <Text id={id('em')} label="E-mail" value={p.email} invalid={!!p.email && !validEmail(p.email)} onSave={(v) => save({ email: v })} />
        <Text id={id('ph')} label="Telefon" value={p.phone} onSave={(v) => save({ phone: v })} />
        <Text id={id('tw')} label="Cestuje s" value={p.travels_with} onSave={(v) => save({ travels_with: v })} />
      </fieldset>
      <fieldset>
        <legend>Cesta a ubytování</legend>
        <div className="field"><span className="label">Bydlí</span>
          <div className="seg" role="radiogroup" aria-label="Bydlí">
            {(['H', 'A'] as const).map((s) => <button key={s} role="radio" aria-checked={p.stays === s} onClick={() => save({ stays: s })}>{s === 'H' ? 'Hotel' : 'Accueil'}</button>)}
          </div></div>
        <Text id={id('rm')} label="Pokoj" value={p.room_no} onSave={(v) => save({ room_no: v })} />
        <Text id={id('pp')} label="Číslo pasu nebo OP" value={priv.passport ?? null} onSave={(v) => savePriv({ passport: v })} />
        <Check label="Cestuje sám, bez letadla" checked={p.no_flight} onChange={(v) => save({ no_flight: v })} />
      </fieldset>
      <fieldset>
        <legend>Role v týmu</legend>
        {roleFlags.map((f) => <Check key={f.key} label={f.label} hint={f.hint} checked={p[f.key]} onChange={(v) => save({ [f.key]: v })} />)}
      </fieldset>
      <fieldset>
        <legend>Stav a dopisy</legend>
        <Check label="Na čekací listině" checked={p.waiting} onChange={(v) => save({ waiting: v })} />
        <Check label="Potvrdil(a) účast odpovědí" checked={p.confirmed} onChange={(v) => save({ confirmed: v })} />
        <div className="field"><label htmlFor={id('ms')}>Poslední odeslaný dopis</label>
          <select id={id('ms')} value={p.mail_sent ?? ''} onChange={(e) => save({ mail_sent: e.target.value || null })}>
            <option value="">nic neodesláno</option><option value="w">čekací listina</option><option value="x">potvrzení účasti</option><option value="o">potvrzení platby</option>
          </select></div>
        <Check label="Zrušil(a) účast" hint="řádek zůstane, jen se nepočítá" checked={p.cancelled} onChange={(v) => save({ cancelled: v })} />
      </fieldset>
      <fieldset>
        <legend>Platba</legend>
        <div className="field"><span className="label">Cena</span><span className="static">{price ? czk(price) : '– (čekací listina nebo zrušeno)'}</span></div>
        <Text id={id('pd')} label="Zaplaceno (Kč)" value={priv.paid_czk ? String(priv.paid_czk) : null} numeric onSave={(v) => savePriv({ paid_czk: v ? Number(v) : 0 })} />
        <div className="field"><span className="label">Variabilní symbol</span><span className="static num">{p.varsym}</span></div>
      </fieldset>
    </div>
  );
}

// a field that saves when it loses focus
function Text({ id, label, value, numeric, invalid, required, onSave }: { id: string; label: string; value: string | null; numeric?: boolean; invalid?: boolean; required?: boolean; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? '');
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setV(value ?? ''); }
  return (
    <div className="field"><label htmlFor={id}>{label}</label>
      <input id={id} value={v} inputMode={numeric ? 'numeric' : undefined} aria-invalid={invalid || undefined} required={required}
        onChange={(e) => setV(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
        onBlur={() => {
          const n = v.trim() || null;
          if (required && !n) return setV(value ?? ''); // a name cannot be emptied: the field springs back
          if (n !== (value ?? null)) onSave(n);
        }} /></div>
  );
}
function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox reg-check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <small>{hint}</small>}</span></label>
  );
}

// The charter plane: the seats taken by the team, the sick and the pilgrims against its capacity, with the team's and
// the malades' quotas, and beside it what is left to do (letters, missing e-mails, money).
type Ov = ReturnType<typeof overview>;
function Plane({ ov, edition, letters, noMail, onSaved }: { ov: Ov; edition: Tables<'editions'>; letters: number; noMail: number; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [details, setDetails] = useState(false);
  const seats = { T: ov.team.inPlane, M: ov.malades.inPlane, P: ov.pilgrims.inPlane };
  const taken = seats.T + seats.M + seats.P;
  const cap = edition.cap_plane;
  const scale = Math.max(cap ?? 0, taken, 1);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  return (
    <section className="panel plane" aria-labelledby="plane-h">
      <div className="plane-main">
        <h2 id="plane-h" className="visually-hidden">Letadlo a co zbývá udělat</h2>
        <p className="plane-figure"><span className="big">{taken}</span>{cap != null ? <span className="of"> z {cap} míst v letadle</span> : <span className="of"> v letadle · kapacita není zadaná</span>}</p>
        <div className="seatbar" role="img" aria-label={`Obsazeno ${taken}${cap != null ? ` z ${cap}` : ''} míst: tým ${seats.T}, nemocní ${seats.M}, poutníci ${seats.P}`}>
          <span className="t" style={{ width: pct(seats.T) }} /><span className="m" style={{ width: pct(seats.M) }} /><span className="p" style={{ width: pct(seats.P) }} />
          {edition.cap_team != null && <i className="quota" style={{ left: pct(edition.cap_team) }} title={`kapacita týmu ${edition.cap_team}`} />}
        </div>
        <dl className="seatlegend">
          <div><dt><i className="sw t" />Tým</dt><dd>{seats.T}{edition.cap_team != null && <span className="of"> z {edition.cap_team}</span>}</dd></div>
          <div><dt><i className="sw m" />Nemocní</dt><dd>{seats.M}{edition.cap_malades != null && <span className="of"> z {edition.cap_malades}</span>}</dd></div>
          <div><dt><i className="sw p" />Poutníci</dt><dd>{seats.P}</dd></div>
          <div><dt>Volná místa</dt><dd>{cap != null ? Math.max(0, cap - taken) : '–'}</dd></div>
          <div><dt>Čekací listina</dt><dd>{ov.waiting}</dd></div>
          {ov.ownWay > 0 && <div><dt>Bez letadla</dt><dd>{ov.ownWay}</dd></div>}
        </dl>
      </div>
      <dl className="plane-todo">
        <div><dt>Dopisy k odeslání</dt><dd className={letters ? 'act' : ''}>{letters}</dd></div>
        <div><dt>Bez platného e-mailu</dt><dd className={noMail ? 'warn' : ''}>{noMail}</dd></div>
        <div><dt>Zbývá vybrat</dt><dd>{czk(ov.money.unpaid)}</dd><dd className="of">zaplaceno {czk(ov.money.paid)} z {czk(ov.money.planned)}</dd></div>
        <div><dt>Pečující tým</dt><dd>{plural(ov.caregivers.men, 'muž', 'muži', 'mužů')} · {plural(ov.caregivers.women, 'žena', 'ženy', 'žen')}</dd>
          {edition.caregiver_goal ? <dd className="of">cíl {edition.caregiver_goal}</dd> : null}</div>
      </dl>
      <div className="plane-foot">
        <button className="btn quiet small" onClick={() => setDetails((d) => !d)} aria-expanded={details}>{details ? 'Skrýt podrobný přehled' : 'Podrobný přehled'}</button>
        <button className="btn quiet small" onClick={() => setEdit((e) => !e)} aria-expanded={edit}>Kapacity a ceny ročníku</button>
      </div>
      {details && <Details ov={ov} />}
      {edit && <Capacities edition={edition} onSaved={() => { setEdit(false); onSaved(); }} />}
    </section>
  );
}

function Details({ ov }: { ov: Ov }) {
  const line = (label: string, r: Ov['team']) => (
    <tr><th scope="row">{label}</th><td className="num">{r.participants}</td><td className="num">{r.partConfirmed}</td><td className="num">{r.payConfirmed}</td>
      <td className="num">{r.toBeSent}</td><td className="num">{r.noMail}</td><td className="num">{r.waiting}</td></tr>
  );
  return (
    <div className="plane-details">
      <div className="table-wrap"><table>
        <thead><tr><th /><th className="num">Přihlášení</th><th className="num">Potvrdili účast</th><th className="num">Platba potvrzena</th><th className="num">K odeslání</th><th className="num">Bez e-mailu</th><th className="num">Čekací listina</th></tr></thead>
        <tbody>{line('Tým', ov.team)}{line('Nemocní', ov.malades)}{line('Poutníci', ov.pilgrims)}</tbody>
      </table></div>
      <dl className="kv">
        <dt>Sestry · lékaři · kněží</dt><dd>{ov.nurses} · {ov.doctors} · {ov.priests}</dd>
        <dt>Hotel / Accueil</dt><dd>{ov.hotel} / {ov.accueil}</dd>
        <dt>Tým v hotelu / v Accueil</dt><dd>{ov.teamHotel} / {ov.teamAccueil}</dd>
        <dt>Nemocní v hotelu / v Accueil</dt><dd>{ov.maladesHotel} / {ov.maladesAccueil}</dd>
        <dt>Průměrný věk pečujících</dt><dd>muži {ov.caregivers.menAge ?? '–'} · ženy {ov.caregivers.womenAge ?? '–'}</dd>
        <dt>SMOM · zrušeno</dt><dd>{ov.smom} · {ov.cancelled}</dd>
      </dl>
    </div>
  );
}

const capFields = [
  ['cap_plane', 'Míst v letadle'], ['cap_extra_hotel', 'Další místa v hotelu'], ['cap_team', 'Kapacita týmu'], ['cap_malades', 'Kapacita nemocných'],
  ['caregiver_goal', 'Cíl pečujícího týmu'], ['fee_pilgrim', 'Cena: poutník'], ['fee_team', 'Cena: tým'], ['fee_malade', 'Cena: nemocný'],
  ['fee_pilgrim_nf', 'Bez letu: poutník'], ['fee_team_nf', 'Bez letu: tým'], ['fee_malade_nf', 'Bez letu: nemocný'],
] as const;
function Capacities({ edition, onSaved }: { edition: Tables<'editions'>; onSaved: () => void }) {
  const [form, setForm] = useState(() => Object.fromEntries(capFields.map(([k]) => [k, edition[k]?.toString() ?? ''])) as Record<string, string>);
  const [message, setMessage] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    const patch = Object.fromEntries(capFields.map(([k]) => [k, form[k] === '' ? (k.startsWith('fee') ? 0 : null) : Number(form[k])])) as Partial<Tables<'editions'>>;
    const { error } = await supabase.from('editions').update(patch).eq('id', edition.id);
    if (error) return setMessage(friendlyError(error));
    onSaved();
  }
  return (
    <form className="plane-caps" onSubmit={save}>
      {message && <Notice kind="error">{message}</Notice>}
      <div className="caps-grid">
        {capFields.map(([k, label]) => (
          <div className="field" key={k}><label htmlFor={`cap-${k}`}>{label}</label>
            <input id={`cap-${k}`} inputMode="numeric" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '') }))} /></div>
        ))}
      </div>
      <div className="row"><button className="btn primary" type="submit">Uložit</button></div>
    </form>
  );
}

function AddPerson({ editionId, onDone, onError }: { editionId: string; onDone: () => void; onError: (m: string) => void }) {
  const [first, setFirst] = useState(''), [last, setLast] = useState(''), [type, setType] = useState<'P' | 'M' | 'T'>('P');
  async function add(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('participants').insert({ edition_id: editionId, first_name: first.trim(), last_name: last.trim(),
      category: type === 'P' ? 'pilgrim' : type === 'M' ? 'malade' : 'assistant', stays: type === 'M' ? 'A' : 'H' });
    if (error) return onError(friendlyError(error));
    onDone();
  }
  return (
    <form className="panel reg-add" onSubmit={add} aria-label="Přidat osobu">
      <div className="field"><label htmlFor="add-fn">Jméno</label><input id="add-fn" value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus /></div>
      <div className="field"><label htmlFor="add-ln">Příjmení</label><input id="add-ln" value={last} onChange={(e) => setLast(e.target.value)} required /></div>
      <div className="field"><label htmlFor="add-ty">Typ</label>
        <select id="add-ty" value={type} onChange={(e) => setType(e.target.value as 'P' | 'M' | 'T')}><option value="P">Poutník</option><option value="M">Nemocný</option><option value="T">Tým</option></select></div>
      <div className="row"><button className="btn primary" type="submit" disabled={!first.trim() || !last.trim()}>Přidat</button><button className="btn quiet" type="button" onClick={onDone}>Zrušit</button></div>
      <p className="muted">Dostane další VarSym. Ostatní údaje doplníte v řádku.</p>
    </form>
  );
}
