import { t, type Category, type Tables } from '@lurdy/shared';
import { useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fmtDay, fmtTime, fromLocalInput, toLocalInput } from '../format';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Event = Tables<'events'>;
type Place = Pick<Tables<'places'>, 'id' | 'name'>;
const categories: Category[] = ['malade', 'staff', 'assistant', 'pilgrim'];
// The two columns of the old brochure, as presets.
const presets: { label: string; value: Category[] }[] = [
  { label: 'Všichni', value: [] },
  { label: 'Nemocní a tým', value: ['malade', 'staff', 'assistant'] },
  { label: 'Poutníci', value: ['pilgrim'] },
  { label: 'Jen tým', value: ['staff', 'assistant'] },
];
const audienceLabel = (a: Category[]) =>
  presets.find((p) => p.value.length === a.length && p.value.every((c) => a.includes(c)))?.label ?? a.map((c) => t(`category.${c}`)).join(', ');

export function Programme() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    async () => {
      const [events, places] = await Promise.all([
        must(supabase.from('events').select('*').eq('edition_id', edition.id).order('starts_at')) as Promise<Event[]>,
        must(supabase.from('places').select('id, name').order('sort')) as Promise<Place[]>,
      ]);
      return { events, places };
    },
    ['events'],
    edition.id,
    [edition.id],
  );
  const [editing, setEditing] = useState<Event | 'new' | null>(null);
  const days = [...new Set((data?.events ?? []).map((e) => fmtDay(e.starts_at, edition.timezone)))];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Program</h1>
          <p>Každý vidí v aplikaci jen body pro svou kategorii. Změna se v aplikaci označí jako „Změněno“.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" width={18} /> Nový bod programu</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {editing && <EventForm key={editing === 'new' ? 'new' : editing.id} event={editing === 'new' ? null : editing} places={data?.places ?? []}
        onDone={() => { setEditing(null); reload(); }} />}
      {!data ? <div className="skeleton" style={{ width: 300 }} /> : data.events.length === 0 ? (
        <p className="panel empty">Program je prázdný. Přidejte první bod, nebo převezměte program z minulého ročníku (připravujeme).</p>
      ) : days.map((day) => (
        <section key={day} className="panel" style={{ marginBottom: 16 }} aria-label={day}>
          <h2 style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', textTransform: 'capitalize' }}>{day}</h2>
          <table>
            <tbody>
              {data.events.filter((e) => fmtDay(e.starts_at, edition.timezone) === day).map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setEditing(e)}>
                  <td className="mono" style={{ width: 130, whiteSpace: 'nowrap' }}>{fmtTime(e.starts_at, edition.timezone)}{e.ends_at && `–${fmtTime(e.ends_at, edition.timezone)}`}</td>
                  <td><strong>{e.title}</strong>{e.location && <span style={{ color: 'var(--muted)' }}> · {e.location}</span>}</td>
                  <td><span className="tag">{audienceLabel(e.audiences)}</span></td>
                  <td>{e.place_id ? <span className="tag"><Icon name="map" width={12} /> na mapě</span> : ''}</td>
                  <td className="num"><button className="btn quiet small" onClick={(ev) => { ev.stopPropagation(); setEditing(e); }}>{t('common.edit')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}

function EventForm({ event, places, onDone }: { event: Event | null; places: Place[]; onDone: () => void }) {
  const { edition } = useReady();
  const tz = edition.timezone;
  const [f, setF] = useState({
    starts: event ? toLocalInput(event.starts_at, tz) : `${edition.starts_on}T09:00`,
    ends: event?.ends_at ? toLocalInput(event.ends_at, tz) : '',
    title: event?.title ?? '', location: event?.location ?? '', place_id: event?.place_id ?? '', description: event?.description ?? '',
    audiences: event?.audiences ?? ([] as Category[]),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // the version this form was opened with; a conflict reloads the row and the person edits the fresh values
  const [version, setVersion] = useState(event?.version ?? 0);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.title.trim() || !f.starts) return setError('Vyplňte čas a název.');
    setBusy(true);
    const values = {
      starts_at: fromLocalInput(f.starts, tz)!, ends_at: fromLocalInput(f.ends, tz), title: f.title.trim(), location: f.location.trim() || null,
      place_id: f.place_id || null, description: f.description.trim() || null, audiences: f.audiences,
    };
    const { data, error: err } = event
      ? await supabase.from('events').update(values).eq('id', event.id).eq('version', version).select('id')
      : await supabase.from('events').insert({ ...values, edition_id: edition.id }).select('id');
    setBusy(false);
    if (err) return setError(err.message.includes('ends_at') ? 'Konec musí být po začátku.' : friendlyError(err));
    if (event && !data?.length) {
      const { data: fresh } = await supabase.from('events').select('*').eq('id', event.id).maybeSingle();
      if (fresh) {
        setVersion(fresh.version);
        setF({ starts: toLocalInput(fresh.starts_at, tz), ends: fresh.ends_at ? toLocalInput(fresh.ends_at, tz) : '', title: fresh.title,
          location: fresh.location ?? '', place_id: fresh.place_id ?? '', description: fresh.description ?? '', audiences: fresh.audiences });
      }
      return setError(t('common.conflict'));
    }
    onDone();
  }
  async function remove() {
    if (!event || !window.confirm(`Smazat „${event.title}“ z programu?`)) return;
    const { error: err } = await supabase.from('events').delete().eq('id', event.id);
    if (err) return setError(friendlyError(err));
    onDone();
  }

  return (
    <form className="panel stack" style={{ padding: 20, marginBottom: 24 }} onSubmit={save} aria-label={event ? 'Upravit bod programu' : 'Nový bod programu'}>
      <h2>{event ? 'Upravit bod programu' : 'Nový bod programu'}</h2>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field"><label htmlFor="ps">Začátek ({tz})</label><input id="ps" type="datetime-local" value={f.starts} onChange={(e) => set('starts', e.target.value)} /></div>
        <div className="field"><label htmlFor="pe">Konec (nepovinné)</label><input id="pe" type="datetime-local" value={f.ends} onChange={(e) => set('ends', e.target.value)} /></div>
        <div className="field" style={{ minWidth: 280, flex: 1 }}><label htmlFor="pt">Název</label><input id="pt" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Mše svatá v jeskyni" /></div>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 240 }}><label htmlFor="pl">Místo (text)</label><input id="pl" value={f.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field" style={{ minWidth: 240 }}><label htmlFor="pp">Místo na mapě</label>
          <select id="pp" value={f.place_id} onChange={(e) => set('place_id', e.target.value)}>
            <option value="">— bez mapy —</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Pro koho</legend>
        <div className="row">
          {presets.map((p) => (
            <button key={p.label} type="button" className={`btn small${audienceLabel(f.audiences) === p.label ? ' primary' : ''}`}
              aria-pressed={audienceLabel(f.audiences) === p.label} onClick={() => set('audiences', p.value)}>{p.label}</button>
          ))}
          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>nebo:</span>
          {categories.map((c) => (
            <label key={c} className="checkbox"><input type="checkbox" checked={f.audiences.includes(c)}
              onChange={(e) => set('audiences', e.target.checked ? [...f.audiences, c] : f.audiences.filter((x) => x !== c))} /> {t(`category.${c}`)}</label>
          ))}
        </div>
      </fieldset>
      <div className="field"><label htmlFor="pd">Poznámka pro účastníky</label><textarea id="pd" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{t('common.save')}</button>
        <button className="btn" type="button" onClick={onDone}>{t('common.cancel')}</button>
        {event && <button className="btn quiet" type="button" style={{ marginLeft: 'auto' }} onClick={remove}>{t('common.delete')}</button>}
      </div>
    </form>
  );
}
