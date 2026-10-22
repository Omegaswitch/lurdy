import { t, type Enums, type Tables } from '@lurdy/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fullName } from '../format';
import { Icon, Notice } from '../icons';
import { affected, must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Affecting = { select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> };

type Occupant = { id: string; participant_id: string; bed: string | null; checked_in_at: string | null };
type Room = Tables<'rooms'> & { room_assignments: Occupant[] };
type Facility = Tables<'facilities'> & { rooms: Room[] };
type Person = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'title' | 'category' | 'mobility'>;
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const kinds: Enums<'facility_kind'>[] = ['hotel', 'care', 'other'];
const kindLabel: Record<Enums<'facility_kind'>, string> = { hotel: 'Hotel', care: 'Zařízení pro nemocné', other: 'Jiné' };

export function Accommodation() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    async () => {
      const [facilities, people] = await Promise.all([
        must(supabase.from('facilities').select('*, rooms(*, room_assignments(id, participant_id, bed, checked_in_at))')
          .eq('edition_id', edition.id).order('sort').order('name')) as Promise<Facility[]>,
        must(supabase.from('participants').select('id, first_name, last_name, title, category, mobility').eq('edition_id', edition.id).order('last_name')) as Promise<Person[]>,
      ]);
      for (const f of facilities) f.rooms.sort((a, b) => a.number.localeCompare(b.number, 'cs', { numeric: true }));
      return { facilities, people };
    },
    ['facilities', 'rooms', 'room_assignments', 'participants'],
    edition.id,
    [edition.id],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'facility' | { facility: string } | { editFacility: Facility } | { editRoom: Room & { facility: Facility } } | null>(null);
  const rooms = data?.facilities.flatMap((f) => f.rooms.map((r) => ({ ...r, facility: f }))) ?? [];
  const selected = rooms.find((r) => r.id === selectedId) ?? rooms[0] ?? null;
  const housed = new Set(rooms.flatMap((r) => r.room_assignments.map((a) => a.participant_id)));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ubytování</h1>
          <p>{data ? `${housed.size} z ${data.people.length} ubytováno` : t('common.loading')} · kapacitu pokojů hlídá databáze.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('facility')}><Icon name="plus" width={18} /> Nové zařízení</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {editing === 'facility' && <FacilityForm existing={null} onDone={() => { setEditing(null); reload(); }} />}
      {typeof editing === 'object' && editing && 'editFacility' in editing && <FacilityForm key={editing.editFacility.id} existing={editing.editFacility} onDone={() => { setEditing(null); reload(); }} />}
      {typeof editing === 'object' && editing && 'facility' in editing && <RoomForm facilityId={editing.facility} existing={null} onDone={(id) => { setEditing(null); if (id) setSelectedId(id); reload(); }} />}
      {typeof editing === 'object' && editing && 'editRoom' in editing && <RoomForm key={editing.editRoom.id} facilityId={editing.editRoom.facility_id} existing={editing.editRoom} onDone={() => { setEditing(null); reload(); }} />}
      {!data ? <div className="skeleton" style={{ width: 300 }} /> : data.facilities.length === 0 ? (
        <p className="panel empty">Zatím žádné ubytování. Přidejte hotel a zařízení pro nemocné (např. Accueil Notre-Dame).</p>
      ) : (
        <div className="board">
          <nav className="panel timetable" aria-label="Pokoje">
            {data.facilities.map((f) => (
              <div key={f.id}>
                <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span className="tag"><i style={{ background: f.colour ?? '#999' }} />{f.short_label ?? f.name}</span>
                  <span>
                    <button className="btn quiet small" onClick={() => setEditing({ editFacility: f })} aria-label={`Upravit ${f.name}`}>{t('common.edit')}</button>
                    <button className="btn quiet small" onClick={() => setEditing({ facility: f.id })}><Icon name="plus" width={14} /> pokoj</button>
                  </span>
                </h3>
                {f.rooms.map((r) => {
                  const n = r.room_assignments.length;
                  const full = n >= r.capacity;
                  return (
                    <button key={r.id} aria-pressed={r.id === selected?.id} onClick={() => setSelectedId(r.id)}>
                      <span className="code">{r.number}</span>
                      <span className="time">{r.floor ? `${r.floor}. p.` : ''}</span>
                      <span className="route">
                        {r.zone ?? f.name}
                        <span className={`meter${full ? ' full' : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, (n / Math.max(1, r.capacity)) * 100)}%` }} /></span>
                        <span className="load">{n} / {r.capacity}{full && ` · ${t('admin.full')}`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          {selected && <RoomDetail key={selected.id} room={selected} rooms={rooms} people={data.people} housed={housed} onEdit={() => setEditing({ editRoom: selected })} onDeleted={() => { setSelectedId(null); reload(); }} />}
        </div>
      )}
    </>
  );
}

function RoomDetail({ room, rooms, people, housed, onEdit, onDeleted }: { room: Room & { facility: Facility }; rooms: (Room & { facility: Facility })[]; people: Person[]; housed: Set<string>; onEdit: () => void; onDeleted: () => void }) {
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [moving, setMoving] = useState<string | null>(null); // the one row whose "move to" choice is open
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const unhoused = people.filter((p) => !housed.has(p.id));
  const hasRoom = room.room_assignments.length < room.capacity;
  const candidates = unhoused.filter((p) => fold(`${p.first_name} ${p.last_name}`).includes(fold(query.trim()))).slice(0, 8);
  // every change asks for the affected row back: zero rows (rights lapsed, row gone) is an error, not "Uloženo"
  const run = async (op: Affecting, ok: string) => {
    const { error } = await affected(op.select('id'));
    setMessage(error ? { kind: 'error', text: friendlyError(error) } : { kind: 'ok', text: ok });
  };

  return (
    <section className="panel" aria-label={`Pokoj ${room.number}`}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h2>{room.facility.name} · pokoj {room.number}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
            {[room.floor && `${room.floor}. patro`, room.zone, `${room.room_assignments.length} / ${room.capacity} míst`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button className="btn small" onClick={onEdit}>Upravit pokoj</button>
      </div>
      <div className="stack" style={{ padding: '16px 20px' }}>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <div className="field">
          <label htmlFor="resp">Odpovídá za pokoj (služba)</label>
          <select id="resp" value={room.responsible_id ?? ''} onChange={(e) => run(
            supabase.from('rooms').update({ responsible_id: e.target.value || null }).eq('id', room.id), 'Odpovědná osoba uložena.')}>
            <option value="">—</option>
            {people.filter((p) => p.category !== 'malade').map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </select>
          <span className="help">Člen týmu, který má pokoj na starosti, nemusí v pokoji bydlet.</span>
        </div>
        <div className="field">
          <label htmlFor="addr">Ubytovat{unhoused.length > 0 && ` · ${unhoused.length} bez lůžka`}</label>
          <input id="addr" type="search" placeholder="Jméno (zobrazí se jen dosud neubytovaní)" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {(query.trim() || (hasRoom && unhoused.length > 0)) && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {candidates.length === 0 && <li style={{ color: 'var(--muted)' }}>{t('admin.noResults')}</li>}
            {candidates.map((p) => (
              <li key={p.id} className="row">
                <span style={{ flex: 1 }}>{fullName(p)} <span className={`tag ${p.category}`}>{t(`category.${p.category}`)}</span></span>
                <button className="btn small" onClick={() => run(supabase.from('room_assignments').insert({ room_id: room.id, participant_id: p.id, edition_id: room.edition_id }), `${fullName(p)} ubytován(a) v pokoji ${room.number}.`)}>
                  <Icon name="plus" width={16} /> {t('common.add')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {room.room_assignments.length === 0 ? (
        <div className="empty">
          <p style={{ margin: '0 0 12px' }}>Pokoj je prázdný.</p>
          <button className="btn small" onClick={async () => {
            if (!window.confirm(`Smazat pokoj ${room.number}?`)) return;
            const { error } = await affected(supabase.from('rooms').delete().eq('id', room.id).select('id'));
            if (error) return setMessage({ kind: 'error', text: friendlyError(error) });
            onDeleted();
          }}>Smazat pokoj</button>
        </div>
      ) : (
        <table>
          <thead><tr><th>Ubytovaní</th><th>Lůžko</th><th><span className="visually-hidden">{t('admin.moveTo')}</span></th><th><span className="visually-hidden">{t('admin.remove')}</span></th></tr></thead>
          <tbody>
            {room.room_assignments.map((a) => {
              const p = byId.get(a.participant_id);
              if (!p) return null;
              return (
                <tr key={a.id}>
                  <td>{fullName(p)} <span className={`tag ${p.category}`}>{t(`category.${p.category}`)}</span>{p.mobility === 'wheelchair' && <> <span className="tag">{t('mobility.wheelchair')}</span></>}</td>
                  <td>
                    <label className="visually-hidden" htmlFor={`bed-${a.id}`}>Lůžko</label>
                    <input id={`bed-${a.id}`} defaultValue={a.bed ?? ''} style={{ width: 80 }}
                      onBlur={(e) => e.target.value !== (a.bed ?? '') && run(supabase.from('room_assignments').update({ bed: e.target.value || null }).eq('id', a.id), 'Lůžko uloženo.')} />
                  </td>
                  <td>
                    {moving !== a.id ? <button className="btn quiet small" onClick={() => setMoving(a.id)}>{t('admin.moveTo')}…</button> : <>
                    <label className="visually-hidden" htmlFor={`mvr-${a.id}`}>{t('admin.moveTo')}</label>
                    <select id={`mvr-${a.id}`} value="" autoFocus onBlur={() => setMoving(null)} onChange={(e) => { setMoving(null); if (e.target.value) run(
                      supabase.from('room_assignments').update({ room_id: e.target.value }).eq('id', a.id),
                      `${fullName(p)} přestěhován(a).`); }}>
                      <option value="">—</option>
                      {rooms.filter((r) => r.id !== room.id).map((r) => <option key={r.id} value={r.id}>{r.facility.short_label ?? r.facility.name} {r.number} ({r.room_assignments.length}/{r.capacity})</option>)}
                    </select></>}
                  </td>
                  <td className="num"><button className="btn quiet small" onClick={() => run(supabase.from('room_assignments').delete().eq('id', a.id), `${fullName(p)} odebrán(a) z pokoje.`)}>{t('admin.remove')}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function FacilityForm({ existing, onDone }: { existing: Facility | null; onDone: () => void }) {
  const { edition } = useReady();
  const [f, setF] = useState(existing ? {
    name: existing.name, short_label: existing.short_label ?? '', kind: existing.kind, address: existing.address ?? '', phone: existing.phone ?? '',
    colour: existing.colour ?? '#1f5fa8', lat: existing.lat == null ? '' : String(existing.lat), lng: existing.lng == null ? '' : String(existing.lng),
  } : { name: '', short_label: '', kind: 'hotel' as Enums<'facility_kind'>, address: '', phone: '', colour: '#1f5fa8', lat: '', lng: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  // "43,0991" is how a Czech keyboard writes it
  const coord = (v: string) => (v.trim() ? parseFloat(v.trim().replace(',', '.')) : null);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.name.trim()) return setError('Vyplňte název.');
    const lat = coord(f.lat), lng = coord(f.lng);
    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) return setError('Souřadnice musí být číslo, např. 43.0991.');
    if ((lat === null) !== (lng === null)) return setError('Vyplňte obě souřadnice, nebo žádnou.');
    setBusy(true);
    const values = {
      name: f.name.trim(), short_label: f.short_label.trim() || null, kind: f.kind, address: f.address.trim() || null,
      phone: f.phone.trim() || null, colour: f.colour, lat, lng,
    };
    const { data, error: err } = existing
      ? await supabase.from('facilities').update(values).eq('id', existing.id).eq('version', existing.version).select('id')
      : await supabase.from('facilities').insert({ ...values, edition_id: edition.id }).select('id');
    setBusy(false);
    if (err) return setError(err.code === '23505' ? 'Zařízení s tímto názvem už existuje.' : friendlyError(err));
    if (existing && !data?.length) return setError(t('common.conflict'));
    onDone();
  }
  async function remove() {
    if (!existing) return;
    if (existing.rooms.length) return setError('Nejdřív smažte pokoje tohoto zařízení.');
    if (!window.confirm(`Smazat zařízení ${existing.name}?`)) return;
    const { error: err } = await affected(supabase.from('facilities').delete().eq('id', existing.id).select('id'));
    if (err) return setError(friendlyError(err));
    onDone();
  }
  return (
    <form className="panel stack" style={{ padding: 20, marginBottom: 24 }} onSubmit={save} aria-label={existing ? `Upravit ${existing.name}` : 'Nové zařízení'}>
      <h2>{existing ? `Upravit ${existing.name}` : 'Nové zařízení'}</h2>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 240 }}><label htmlFor="fn2">Název</label><input id="fn2" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><label htmlFor="fs">Zkratka na jmenovku</label><input id="fs" value={f.short_label} onChange={(e) => set('short_label', e.target.value)} placeholder="HOTEL" style={{ width: 140 }} /></div>
        <div className="field"><label htmlFor="fk">Druh</label><select id="fk" value={f.kind} onChange={(e) => set('kind', e.target.value)}>{kinds.map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}</select></div>
        <div className="field"><label htmlFor="fc">Barva na jmenovce</label><input id="fc" type="color" value={f.colour} onChange={(e) => set('colour', e.target.value)} style={{ width: 70, padding: 2 }} /></div>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 280 }}><label htmlFor="fa2">Adresa</label><input id="fa2" value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="field"><label htmlFor="fp">Telefon recepce</label><input id="fp" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="field"><label htmlFor="flat">Zem. šířka</label><input id="flat" inputMode="decimal" value={f.lat} onChange={(e) => set('lat', e.target.value)} style={{ width: 120 }} placeholder="43.0991" /></div>
        <div className="field"><label htmlFor="flng">Zem. délka</label><input id="flng" inputMode="decimal" value={f.lng} onChange={(e) => set('lng', e.target.value)} style={{ width: 120 }} placeholder="-0.0565" /></div>
      </div>
      <span className="help">Souřadnice umístí ubytování na mapu v aplikaci (najdete je na openstreetmap.org → pravým tlačítkem → Zobrazit adresu).</span>
      <div className="row"><button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{t('common.save')}</button><button className="btn" type="button" onClick={onDone}>{t('common.cancel')}</button>
        {existing && <button className="btn quiet" type="button" style={{ marginLeft: 'auto' }} onClick={remove}>Smazat zařízení</button>}</div>
    </form>
  );
}

function RoomForm({ facilityId, existing, onDone }: { facilityId: string; existing: Room | null; onDone: (id: string | null) => void }) {
  const { edition } = useReady();
  const [f, setF] = useState(existing ? { number: existing.number, floor: existing.floor ?? '', zone: existing.zone ?? '', capacity: String(existing.capacity) }
    : { number: '', floor: '', zone: '', capacity: '2' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.number.trim()) return setError('Vyplňte číslo pokoje.');
    setBusy(true);
    const values = { number: f.number.trim(), floor: f.floor.trim() || null, zone: f.zone.trim() || null, capacity: Number(f.capacity) || 0 };
    const { data, error: err } = existing
      ? await supabase.from('rooms').update(values).eq('id', existing.id).eq('version', existing.version).select('id')
      : await supabase.from('rooms').insert({ ...values, edition_id: edition.id, facility_id: facilityId }).select('id');
    setBusy(false);
    if (err) return setError(err.code === '23505' ? 'Pokoj s tímto číslem už v zařízení je.' : friendlyError(err));
    if (existing && !data?.length) return setError(t('common.conflict'));
    onDone(data?.[0]?.id ?? null);
  }
  return (
    <form className="panel stack" style={{ padding: 20, marginBottom: 24 }} onSubmit={save} aria-label={existing ? `Upravit pokoj ${existing.number}` : 'Nový pokoj'}>
      <h2>{existing ? `Upravit pokoj ${existing.number}` : 'Nový pokoj'}</h2>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field"><label htmlFor="rn">Číslo</label><input id="rn" value={f.number} onChange={(e) => set('number', e.target.value)} style={{ width: 100 }} /></div>
        <div className="field"><label htmlFor="rf">Patro</label><input id="rf" value={f.floor} onChange={(e) => set('floor', e.target.value)} style={{ width: 80 }} /></div>
        <div className="field"><label htmlFor="rz">Zóna / křídlo</label><input id="rz" value={f.zone} onChange={(e) => set('zone', e.target.value)} /></div>
        <div className="field"><label htmlFor="rc">Lůžek</label><input id="rc" type="number" min={0} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} style={{ width: 80 }} /></div>
        <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{t('common.save')}</button>
        <button className="btn" type="button" onClick={() => onDone(null)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
