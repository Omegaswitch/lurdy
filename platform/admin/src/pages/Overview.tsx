import { t, type Category } from '@lurdy/shared';
import { Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

export function Overview() {
  const { edition } = useReady();
  const { data, error } = useLive(
    async () => {
      const [people, legs] = await Promise.all([
        must(supabase.from('participants').select('id, category, leg_assignments(leg_id), room_assignments(id)').eq('edition_id', edition.id)),
        must(supabase.from('transport_legs').select('id, code, kind, direction, capacity, leg_assignments(boarded_at, arrived_at)').eq('edition_id', edition.id).order('sort')),
      ]);
      return { people, legs };
    },
    ['participants', 'leg_assignments', 'room_assignments', 'transport_legs'],
    edition.id,
    [edition.id],
  );
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <div className="skeleton" style={{ width: 240 }} />;

  const count = (c: Category) => data.people.filter((p) => p.category === c).length;
  const noLeg = data.people.filter((p) => p.leg_assignments.length === 0).length;
  const noRoom = data.people.filter((p) => !p.room_assignments).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('admin.overview')}</h1>
          <p>{edition.title}</p>
        </div>
      </div>
      <dl className="stats">
        <div className="panel stat"><dt>{t('admin.participants')}</dt><dd>{data.people.length}</dd></div>
        {(['pilgrim', 'malade', 'assistant', 'staff'] as Category[]).map((c) => (
          <div className="panel stat" key={c}><dt>{t(`category.${c}`)}</dt><dd>{count(c)}</dd></div>
        ))}
        <div className="panel stat"><dt>Bez dopravy</dt><dd>{noLeg}</dd></div>
        <div className="panel stat"><dt>Bez ubytování</dt><dd>{noRoom}</dd></div>
      </dl>
      <h2 style={{ margin: '32px 0 12px' }}>Nástupy</h2>
      <div className="panel">
        <table>
          <thead><tr><th>Spoj</th><th>Druh</th><th className="num">Přiděleno</th><th className="num">Nastoupilo</th><th className="num">Dorazilo</th></tr></thead>
          <tbody>
            {data.legs.map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.code}</td>
                <td>{t(`leg.${l.kind}`)} · {t(`direction.${l.direction}`)}</td>
                <td className="num">{l.leg_assignments.length}{l.capacity != null && ` / ${l.capacity}`}</td>
                <td className="num">{l.leg_assignments.filter((a) => a.boarded_at).length}</td>
                <td className="num">{l.leg_assignments.filter((a) => a.arrived_at).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
