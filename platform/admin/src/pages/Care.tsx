import { t, type Enums, type Tables } from '@lurdy/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fmtStamp, fromLocalInput, fullName } from '../format';
import { Icon, Notice } from '../icons';
import { affected, must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Affecting = { select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> };

type Person = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'title' | 'category' | 'mobility'> & {
  room_assignments: { rooms: { number: string; facilities: { short_label: string | null; name: string } | null } | null } | null;
};
type Assignment = Tables<'care_assignments'>;
const active = (a: Assignment, now: number) =>
  (!a.starts_at || new Date(a.starts_at).getTime() <= now) && (!a.ends_at || new Date(a.ends_at).getTime() > now);

export function Care() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    async () => {
      const [people, assignments] = await Promise.all([
        must(supabase.from('participants').select('id, first_name, last_name, title, category, mobility, room_assignments(rooms(number, facilities(short_label, name)))')
          .eq('edition_id', edition.id).order('last_name')) as Promise<Person[]>,
        must(supabase.from('care_assignments').select('*').eq('edition_id', edition.id)) as Promise<Assignment[]>,
      ]);
      return { people, assignments, loadedAt: Date.now() };
    },
    ['participants', 'care_assignments'],
    edition.id,
    [edition.id],
  );
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const now = data.loadedAt;
    const byId = new Map(data.people.map((p) => [p.id, p]));
    const load = new Map<string, number>(); // active cared-for persons per carer
    for (const a of data.assignments) if (active(a, now)) load.set(a.carer_id, (load.get(a.carer_id) ?? 0) + 1);
    const malades = data.people.filter((p) => p.category === 'malade').map((m) => {
      const mine = data.assignments.filter((a) => a.malade_id === m.id);
      return { m, mine, covered: mine.some((a) => a.kind === 'primary' && active(a, now)) };
    });
    return { byId, load, malades, carers: data.people.filter((p) => p.category !== 'malade'), now };
  }, [data]);

  // every change asks for the affected row back: zero rows (rights lapsed, row gone) is an error, not "Uloženo"
  const run = async (op: Affecting, ok: string) => {
    const { error: err } = await affected(op.select('id'));
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: ok });
    reload();
  };

  const gaps = view?.malades.filter((x) => !x.covered).length ?? 0;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Péče</h1>
          <p>Kdo se o koho stará. Dočasný zástup (noční služba, letiště) má čas od–do; po jeho konci platí zase hlavní asistent.</p>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <div style={{ marginBottom: 16 }}><Notice kind={message.kind}>{message.text}</Notice></div>}
      <section className="panel">
        <div className="toolbar">
          <label className="checkbox"><input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Jen bez hlavního asistenta ({gaps})</label>
          {view && <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{view.malades.length} nemocných · {gaps === 0 ? 'všichni mají hlavního asistenta' : `${gaps} bez hlavního asistenta`}</span>}
        </div>
        {!view ? <div className="skeleton" style={{ margin: 16 }} /> : view.malades.length === 0 ? (
          <p className="empty">V tomto ročníku zatím není nikdo v kategorii Nemocný.</p>
        ) : (
          <table>
            <thead><tr><th>Nemocný</th><th>Pokoj</th><th>Asistenti</th><th>Přidat asistenta</th></tr></thead>
            <tbody>
              {view.malades.filter((x) => !onlyGaps || !x.covered).map(({ m, mine, covered }) => (
                <tr key={m.id}>
                  <td>
                    <strong>{fullName(m)}</strong>{m.mobility !== 'walks' && <> <span className="tag">{t(`mobility.${m.mobility}`)}</span></>}
                    {!covered && <div style={{ color: 'var(--warn)', display: 'flex', gap: 4, alignItems: 'center', fontSize: '.85rem' }}><Icon name="alert" width={14} /> Chybí hlavní asistent</div>}
                  </td>
                  <td>{m.room_assignments?.rooms ? `${m.room_assignments.rooms.facilities?.short_label ?? ''} ${m.room_assignments.rooms.number}` : '—'}</td>
                  <td>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
                      {mine.length === 0 && <li style={{ color: 'var(--muted)' }}>nikdo</li>}
                      {mine.map((a) => {
                        const c = view.byId.get(a.carer_id);
                        const isActive = active(a, view.now);
                        return (
                          <li key={a.id} className="row" style={{ gap: 6 }}>
                            <span>{c ? fullName(c) : '—'}</span>
                            <span className="tag">{t(`care.${a.kind}`)}</span>
                            {(a.starts_at || a.ends_at) && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{a.starts_at ? fmtStamp(new Date(a.starts_at)) : '…'} – {a.ends_at ? fmtStamp(new Date(a.ends_at)) : '…'}{!isActive && ' (neplatí teď)'}</span>}
                            <button className="btn quiet small" aria-label={`Odebrat ${c ? fullName(c) : ''}`}
                              onClick={() => run(supabase.from('care_assignments').delete().eq('id', a.id), 'Asistent odebrán.')}><Icon name="x" width={14} /></button>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                  <td><AddCarer malade={m} carers={view.carers} load={view.load} existing={mine} onAdd={run} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function AddCarer({ malade, carers, load, existing, onAdd }: {
  malade: Person; carers: Person[]; load: Map<string, number>; existing: Assignment[];
  onAdd: (op: Affecting, ok: string) => void;
}) {
  const { edition } = useReady();
  const [carer, setCarer] = useState('');
  const [kind, setKind] = useState<Enums<'care_kind'>>(existing.some((a) => a.kind === 'primary') ? 'backup' : 'primary');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const temporary = kind === 'temporary';
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!carer || (temporary && (!from || !until))) return;
    const c = carers.find((p) => p.id === carer)!;
    onAdd(supabase.from('care_assignments').insert({
      edition_id: edition.id, malade_id: malade.id, carer_id: carer, kind,
      starts_at: temporary ? fromLocalInput(from, edition.timezone) : null, ends_at: temporary ? fromLocalInput(until, edition.timezone) : null,
    }), `${fullName(c)} je ${t(`care.${kind}`).toLowerCase()} pro ${fullName(malade)}.`);
    setCarer('');
  }
  return (
    <form className="row" onSubmit={submit} style={{ gap: 6 }}>
      <label className="visually-hidden" htmlFor={`c-${malade.id}`}>Asistent pro {fullName(malade)}</label>
      <select id={`c-${malade.id}`} value={carer} onChange={(e) => setCarer(e.target.value)} style={{ width: 200 }}>
        <option value="">— vyberte —</option>
        {carers.map((p) => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}{load.get(p.id) ? ` (pečuje o ${load.get(p.id)})` : ''}</option>)}
      </select>
      <label className="visually-hidden" htmlFor={`k-${malade.id}`}>Druh</label>
      <select id={`k-${malade.id}`} value={kind} onChange={(e) => setKind(e.target.value as Enums<'care_kind'>)} style={{ width: 150 }}>
        {(['primary', 'backup', 'temporary'] as const).map((k) => <option key={k} value={k}>{t(`care.${k}`)}</option>)}
      </select>
      {temporary && (
        <>
          <label className="visually-hidden" htmlFor={`f-${malade.id}`}>Od</label>
          <input id={`f-${malade.id}`} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 190 }} />
          <label className="visually-hidden" htmlFor={`u-${malade.id}`}>Do</label>
          <input id={`u-${malade.id}`} type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} style={{ width: 190 }} />
        </>
      )}
      <button className="btn small" type="submit" disabled={!carer || (temporary && (!from || !until))}><Icon name="plus" width={14} /> Přidat</button>
    </form>
  );
}
