import { t, type Category } from '@lurdy/shared';
import { Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { activeNow } from '../format';
import { supabase } from '../supabase';

const day = (d: string) => new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(`${d}T12:00:00`)).replace(/ /g, '\u00a0');

// The overview answers one question: who is still without transport, a bed or a main assistant?
export function Overview() {
  const { edition } = useReady();
  const { data, error } = useLive(
    async () => {
      const [people, legs, care] = await Promise.all([
        must(supabase.from('participants').select('id, category, leg_assignments(leg_id), room_assignments(id)').eq('edition_id', edition.id)),
        must(supabase.from('transport_legs').select('id, code, kind, direction, capacity, leg_assignments(boarded_at, arrived_at)').eq('edition_id', edition.id).order('sort')),
        must(supabase.from('care_assignments').select('malade_id, kind, starts_at, ends_at').eq('edition_id', edition.id)),
      ]);
      return { people, legs, care, loadedAt: Date.now() };
    },
    ['participants', 'leg_assignments', 'room_assignments', 'transport_legs', 'care_assignments'],
    edition.id,
    [edition.id],
  );
  const started = new Date().toISOString().slice(0, 10) >= edition.starts_on;
  const daysLeft = Math.ceil((Date.parse(`${edition.starts_on}T00:00:00`) - Date.now()) / 86_400_000);
  const head = (
    <div className="page-head">
      <div>
        <h1>{t('admin.overview')}</h1>
        <p>{edition.title} · {day(edition.starts_on)} – {day(edition.ends_on)}{!started && daysLeft > 0 && ` · za ${daysLeft} dní`}</p>
      </div>
    </div>
  );
  if (error) return <>{head}<Notice kind="error">{error}</Notice></>;
  if (!data) return <>{head}<div className="skeleton" style={{ width: 240 }} /></>;

  const count = (c: Category) => data.people.filter((p) => p.category === c).length;
  const covered = new Set(data.care.filter((a) => a.kind === 'primary' && activeNow(a, data.loadedAt)).map((a) => a.malade_id));
  const gaps = [
    { n: data.people.filter((p) => p.leg_assignments.length === 0).length, label: 'bez dopravy', href: '#/doprava', screen: 'Doprava' },
    { n: data.people.filter((p) => !p.room_assignments).length, label: 'bez lůžka', href: '#/ubytovani', screen: 'Ubytování' },
    { n: data.people.filter((p) => p.category === 'malade' && !covered.has(p.id)).length, label: 'nemocných bez hlavního asistenta', href: '#/pece', screen: 'Péče' },
  ];

  return (
    <>
      {head}
      <dl className="panel strip">
        <div><dt>{t('admin.participants')}</dt><dd>{data.people.length}</dd></div>
        {(['pilgrim', 'malade', 'assistant', 'staff'] as Category[]).map((c) => (
          <div key={c}><dt>{t(`category.${c}`)}</dt><dd>{count(c)}</dd></div>
        ))}
      </dl>
      <div className="pair">
        <section className="panel ready" aria-labelledby="ready-h">
          <h2 id="ready-h">Co ještě chybí</h2>
          {gaps.every((g) => g.n === 0) && <p className="all-set">Všichni mají dopravu, lůžko a nemocní hlavního asistenta.</p>}
          <ul>
            {gaps.map((g) => (
              <li key={g.label}>
                <span className="n">{g.n}</span>
                <span className="what">{g.label}</span>
                <a href={g.href}>{g.screen}</a>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-labelledby="legs-h">
          <h2 id="legs-h" className="panel-title">{started ? 'Nástupy' : 'Spoje'}</h2>
          <table>
            <thead><tr><th>Spoj</th><th>Druh</th><th className="num">Přiděleno</th>{started && <><th className="num">Nastoupilo</th><th className="num">Dorazilo</th></>}</tr></thead>
            <tbody>
              {data.legs.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.code}</td>
                  <td>{t(`leg.${l.kind}`)} · {t(`direction.${l.direction}`)}</td>
                  <td className="num">{l.leg_assignments.length}{l.capacity != null && <span className="of"> / {l.capacity}</span>}</td>
                  {started && <>
                    <td className="num">{l.leg_assignments.filter((a) => a.boarded_at).length}</td>
                    <td className="num">{l.leg_assignments.filter((a) => a.arrived_at).length}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
