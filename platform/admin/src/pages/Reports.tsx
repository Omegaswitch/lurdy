import { t, type Category } from '@lurdy/shared';
import { useState, type ReactNode } from 'react';
import { fmtDay, fmtStamp, fmtTime, fullName } from '../format';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

// Paper fallback. Operational fields only — no health data is ever loaded here.
type Leg = { id: string; code: string; kind: 'flight' | 'bus' | 'truck' | 'other'; direction: 'outbound' | 'return' | 'local'; label: string | null; departs_at: string | null; origin: string | null; destination: string | null; capacity: number | null; responsible_id: string | null };
type Person = {
  id: string; title: string | null; first_name: string; last_name: string; category: Category; mobility: 'walks' | 'assisted' | 'wheelchair'; phone: string | null;
  leg_assignments: { leg_id: string; boarded_at: string | null }[];
  room_assignments: { bed: string | null; room_id: string } | null;
};
type Room = { id: string; number: string; floor: string | null; zone: string | null; capacity: number; responsible_id: string | null; facility_id: string };
type Facility = { id: string; name: string; short_label: string | null };
type Care = { malade_id: string; carer_id: string; kind: 'primary' | 'backup' | 'temporary'; starts_at: string | null; ends_at: string | null };
type Event = { id: string; starts_at: string; ends_at: string | null; title: string; location: string | null; audiences: Category[] };
type Contact = { id: string; label: string; name: string | null; phone: string | null; is_emergency: boolean };

const reports = [
  ['alpha', 'Seznam účastníků (abecedně)'],
  ['category', 'Seznam podle kategorií'],
  ['manifest', 'Manifesty spojů (autobusy, lety)'],
  ['rooms', 'Rozdělení pokojů'],
  ['care', 'Péče – nemocní a asistenti'],
  ['programme', 'Program'],
  ['contacts', 'Kontakty'],
] as const;
type ReportKey = (typeof reports)[number][0];

export function Reports() {
  const { edition } = useReady();
  const [report, setReport] = useState<ReportKey>('manifest');
  const { data, error } = useLive(
    async () => {
      const q = (table: string, select: string) => must(supabase.from(table as 'participants').select(select).eq('edition_id', edition.id));
      const [people, legs, rooms, facilities, care, events, contacts] = await Promise.all([
        q('participants', 'id, title, first_name, last_name, category, mobility, phone, leg_assignments(leg_id, boarded_at), room_assignments(bed, room_id)') as unknown as Promise<Person[]>,
        q('transport_legs', 'id, code, kind, direction, label, departs_at, origin, destination, capacity, responsible_id') as unknown as Promise<Leg[]>,
        q('rooms', 'id, number, floor, zone, capacity, responsible_id, facility_id') as unknown as Promise<Room[]>,
        q('facilities', 'id, name, short_label') as unknown as Promise<Facility[]>,
        q('care_assignments', 'malade_id, carer_id, kind, starts_at, ends_at') as unknown as Promise<Care[]>,
        q('events', 'id, starts_at, ends_at, title, location, audiences') as unknown as Promise<Event[]>,
        q('contacts', 'id, label, name, phone, is_emergency') as unknown as Promise<Contact[]>,
      ]);
      const cs = (a: string, b: string) => a.localeCompare(b, 'cs');
      people.sort((a, b) => cs(a.last_name, b.last_name) || cs(a.first_name, b.first_name));
      legs.sort((a, b) => (a.departs_at ?? '').localeCompare(b.departs_at ?? '') || cs(a.code, b.code));
      rooms.sort((a, b) => a.number.localeCompare(b.number, 'cs', { numeric: true }));
      events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      return { people, legs, rooms, facilities, care, events, contacts, byId: new Map(people.map((p) => [p.id, p])) };
    },
    ['participants', 'leg_assignments', 'room_assignments', 'transport_legs', 'rooms', 'care_assignments', 'events', 'contacts'],
    edition.id,
    [edition.id],
  );
  const title = reports.find(([k]) => k === report)![1];
  const printedAt = new Date();

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>Tisk</h1>
          <p>Záložní papírové sestavy. Každá strana nese ročník a čas tisku – starší papír poznáte. Zdravotní údaje se sem nikdy nedostanou.</p>
        </div>
      </div>
      <div className="panel toolbar no-print" style={{ marginBottom: 24 }}>
        <label htmlFor="rep" className="label">Sestava</label>
        <select id="rep" value={report} onChange={(e) => setReport(e.target.value as ReportKey)} style={{ width: 320 }}>
          {reports.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => window.print()} disabled={!data}><Icon name="printer" width={18} /> {t('admin.print')}</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {!data ? <div className="skeleton" style={{ width: 300 }} /> : (
        <article className="report" aria-label={title}>
          {/* every printed page, not only the first, says which edition and when it was printed */}
          <style>{`@media print{@page{@top-left{content:${JSON.stringify(`${t('app.name')} ${edition.year} · ${title} · vytištěno ${fmtStamp(printedAt)}`)};font:8pt Asap,Arial,sans-serif;color:#444}}}`}</style>
          <header className="report-head">
            <img src="/img/shield.svg" alt="" />
            <div>
              <h2>{title}</h2>
              <p>{t('app.name')} {edition.year} · {edition.title} · vytištěno {fmtStamp(printedAt)}</p>
            </div>
            <span className="report-internal">Interní – po použití skartovat</span>
          </header>
          {report === 'alpha' && <PeopleTable people={data.people} legs={data.legs} rooms={data.rooms} facilities={data.facilities} />}
          {report === 'category' && (['malade', 'pilgrim', 'assistant', 'staff'] as Category[]).map((c) => (
            <Section key={c} title={`${t(`category.${c}`)} (${data.people.filter((p) => p.category === c).length})`}>
              <PeopleTable people={data.people.filter((p) => p.category === c)} legs={data.legs} rooms={data.rooms} facilities={data.facilities} />
            </Section>
          ))}
          {report === 'manifest' && data.legs.map((l) => {
            const pax = data.people.filter((p) => p.leg_assignments.some((a) => a.leg_id === l.id));
            const resp = l.responsible_id ? data.byId.get(l.responsible_id) : null;
            return (
              <Section key={l.id} title={`${t(`leg.${l.kind}`)} ${l.code}${l.label ? ` – ${l.label}` : ''}`} pageBreak
                sub={[t(`direction.${l.direction}`), [l.origin, l.destination].filter(Boolean).join(' → '), l.departs_at && `${fmtDay(l.departs_at, edition.timezone)} ${fmtTime(l.departs_at, edition.timezone)}`,
                  `${pax.length}${l.capacity != null ? ` / ${l.capacity}` : ''} osob`, `vozíky: ${pax.filter((p) => p.mobility === 'wheelchair').length}`, resp && `odpovídá ${fullName(resp)}`].filter(Boolean).join(' · ')}>
                <table className="print-table">
                  <thead><tr><th className="tick">Nást.</th><th>#</th><th>Příjmení a jméno</th><th>Kategorie</th><th>Pohyblivost</th><th>Telefon</th></tr></thead>
                  <tbody>
                    {pax.map((p, i) => (
                      <tr key={p.id}><td className="tick">{p.leg_assignments.find((a) => a.leg_id === l.id)?.boarded_at ? '✓' : ''}</td><td>{i + 1}</td>
                        <td><strong>{p.last_name}</strong> {[p.title, p.first_name].filter(Boolean).join(' ')}</td><td>{t(`category.${p.category}`)}</td>
                        <td>{p.mobility === 'walks' ? '' : t(`mobility.${p.mobility}`)}</td><td>{p.phone}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            );
          })}
          {report === 'rooms' && data.facilities.map((f) => (
            <Section key={f.id} title={f.name} pageBreak>
              <table className="print-table">
                <thead><tr><th>Pokoj</th><th>Ubytovaní</th><th>Odpovídá (služba)</th></tr></thead>
                <tbody>
                  {data.rooms.filter((r) => r.facility_id === f.id).map((r) => {
                    const occ = data.people.filter((p) => p.room_assignments?.room_id === r.id);
                    const resp = r.responsible_id ? data.byId.get(r.responsible_id) : null;
                    return (
                      <tr key={r.id}><td><strong>{r.number}</strong>/{r.capacity}{r.zone ? ` · ${r.zone}` : ''}</td>
                        <td>{occ.map((p) => <div key={p.id}>{p.last_name} {p.first_name}{p.category === 'malade' ? ' (N)' : ''}{p.room_assignments?.bed ? `, lůžko ${p.room_assignments.bed}` : ''}</div>)}</td>
                        <td>{resp ? fullName(resp) : ''}</td></tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="print-note">(N) = nemocný</p>
            </Section>
          ))}
          {report === 'care' && (
            <table className="print-table">
              <thead><tr><th>Nemocný</th><th>Hlavní asistent</th><th>Záskok / dočasně</th></tr></thead>
              <tbody>
                {data.people.filter((p) => p.category === 'malade').map((m) => {
                  const mine = data.care.filter((c) => c.malade_id === m.id);
                  const names = (k: Care['kind'][]) => mine.filter((c) => k.includes(c.kind)).map((c) => {
                    const p = data.byId.get(c.carer_id);
                    return `${p ? `${p.last_name} ${p.first_name}` : '—'}${c.starts_at ? ` (${fmtStamp(new Date(c.starts_at))}–${c.ends_at ? fmtStamp(new Date(c.ends_at)) : ''})` : ''}`;
                  });
                  return <tr key={m.id}><td><strong>{m.last_name}</strong> {m.first_name}</td><td>{names(['primary']).join(', ') || '— chybí —'}</td><td>{names(['backup', 'temporary']).join(', ')}</td></tr>;
                })}
              </tbody>
            </table>
          )}
          {report === 'programme' && [...new Set(data.events.map((e) => fmtDay(e.starts_at, edition.timezone)))].map((day) => (
            <Section key={day} title={day}>
              <table className="print-table">
                <tbody>
                  {data.events.filter((e) => fmtDay(e.starts_at, edition.timezone) === day).map((e) => (
                    <tr key={e.id}><td style={{ width: '18mm' }}><strong>{fmtTime(e.starts_at, edition.timezone)}</strong></td><td>{e.title}{e.location ? ` – ${e.location}` : ''}</td>
                      <td style={{ width: '45mm' }}>{e.audiences.length === 0 ? 'všichni' : e.audiences.map((c) => t(`category.${c}`)).join(', ')}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ))}
          {report === 'contacts' && (
            <table className="print-table">
              <tbody>
                {[...data.contacts].sort((a, b) => Number(b.is_emergency) - Number(a.is_emergency)).map((c) => (
                  <tr key={c.id}><td><strong>{c.label}</strong></td><td>{c.name}</td><td className="mono">{c.phone}</td></tr>
                ))}
                {edition.emergency_phone && <tr><td><strong>Nouzová linka pouti</strong></td><td /><td className="mono">{edition.emergency_phone}</td></tr>}
                <tr><td><strong>Tísňové volání (EU)</strong></td><td /><td className="mono">112</td></tr>
              </tbody>
            </table>
          )}
        </article>
      )}
    </>
  );
}

function Section({ title, sub, pageBreak, children }: { title: string; sub?: string; pageBreak?: boolean; children: ReactNode }) {
  return (
    <section className={`report-section${pageBreak ? ' break' : ''}`}>
      <h3>{title}</h3>
      {sub && <p className="print-sub">{sub}</p>}
      {children}
    </section>
  );
}

function PeopleTable({ people, legs, rooms, facilities }: { people: Person[]; legs: Leg[]; rooms: Room[]; facilities: Facility[] }) {
  const legById = new Map(legs.map((l) => [l.id, l]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const facById = new Map(facilities.map((f) => [f.id, f]));
  return (
    <table className="print-table">
      <thead><tr><th>#</th><th>Příjmení a jméno</th><th>Kategorie</th><th>Tam</th><th>Zpět</th><th>Ubytování</th></tr></thead>
      <tbody>
        {people.map((p, i) => {
          const codes = (dir: Leg['direction']) => p.leg_assignments.map((a) => legById.get(a.leg_id)).filter((l) => l?.direction === dir).map((l) => l!.code).join(', ');
          const room = p.room_assignments ? roomById.get(p.room_assignments.room_id) : null;
          return (
            <tr key={p.id}><td>{i + 1}</td><td><strong>{p.last_name}</strong> {[p.title, p.first_name].filter(Boolean).join(' ')}</td><td>{t(`category.${p.category}`)}</td>
              <td>{codes('outbound')}</td><td>{codes('return')}</td>
              <td>{room ? `${facById.get(room.facility_id)?.short_label ?? ''} ${room.number}` : ''}</td></tr>
          );
        })}
      </tbody>
    </table>
  );
}
