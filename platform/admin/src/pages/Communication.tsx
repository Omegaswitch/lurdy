import { t, type Category, type Tables } from '@lurdy/shared';
import { useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fmtStamp } from '../format';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Contact = Tables<'contacts'>;
type Announcement = Tables<'announcements'> & { announcement_acks: { user_id: string }[] };
const audienceOptions: { label: string; value: Category[] }[] = [
  { label: 'Všichni', value: [] },
  { label: 'Jen tým', value: ['staff', 'assistant'] },
  { label: 'Poutníci', value: ['pilgrim'] },
  { label: 'Nemocní a tým', value: ['malade', 'staff', 'assistant'] },
];
const key = (a: Category[]) => [...a].sort().join(',');

export function Communication() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kontakty a oznámení</h1>
          <p>Kontakty jsou v aplikaci pod „Pomoc a kontakty“. Oznámení se zobrazí na úvodní obrazovce.</p>
        </div>
      </div>
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <Contacts />
        <Announcements />
      </div>
    </>
  );
}

function Contacts() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    () => must(supabase.from('contacts').select('*').eq('edition_id', edition.id).order('is_emergency', { ascending: false }).order('sort')) as Promise<Contact[]>,
    ['contacts'], edition.id, [edition.id],
  );
  const [f, setF] = useState({ label: '', name: '', phone: '', is_emergency: false, audiences: [] as Category[] });
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.label.trim()) return setMessage({ kind: 'error', text: 'Vyplňte, kdo to je (např. Vedoucí pouti).' });
    const { error: err } = await supabase.from('contacts').insert({
      edition_id: edition.id, label: f.label.trim(), name: f.name.trim() || null, phone: f.phone.trim() || null,
      is_emergency: f.is_emergency, audiences: f.audiences, sort: (data?.length ?? 0) * 10,
    });
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: 'Kontakt přidán.' });
    if (!err) setF({ label: '', name: '', phone: '', is_emergency: false, audiences: [] });
    reload();
  }
  async function remove(c: Contact) {
    if (!window.confirm(`Smazat kontakt „${c.label}“?`)) return;
    const { error: err } = await supabase.from('contacts').delete().eq('id', c.id);
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : null);
    reload();
  }
  return (
    <section className="panel" aria-label="Kontakty">
      <div className="stack" style={{ padding: 20 }}>
        <h2>Důležité kontakty</h2>
        {error && <Notice kind="error">{error}</Notice>}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </div>
      {data && data.length > 0 && (
        <table>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.label}</strong>{c.is_emergency && <> <span className="tag"><Icon name="alert" width={12} /> nouzový</span></>}<div>{c.name}</div></td>
                <td className="mono">{c.phone}</td>
                <td><span className="tag">{audienceOptions.find((o) => key(o.value) === key(c.audiences))?.label ?? c.audiences.join(', ')}</span></td>
                <td className="num"><button className="btn quiet small" onClick={() => remove(c)}>{t('common.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="stack" style={{ padding: 20 }} onSubmit={add} aria-label="Nový kontakt">
        <div className="grid2">
          <div className="field"><label htmlFor="kl">Kdo (funkce)</label><input id="kl" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Hlavní lékař v Accueil" /></div>
          <div className="field"><label htmlFor="kn">Jméno</label><input id="kn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="kp">Telefon</label><input id="kp" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="field"><label htmlFor="ka">Uvidí</label>
            <select id="ka" value={key(f.audiences)} onChange={(e) => setF({ ...f, audiences: audienceOptions.find((o) => key(o.value) === e.target.value)!.value })}>
              {audienceOptions.map((o) => <option key={o.label} value={key(o.value)}>{o.label}</option>)}
            </select></div>
        </div>
        <label className="checkbox"><input type="checkbox" checked={f.is_emergency} onChange={(e) => setF({ ...f, is_emergency: e.target.checked })} /> Nouzový kontakt (zobrazí se nahoře, červeně)</label>
        <div><button className="btn primary" type="submit"><Icon name="plus" width={18} /> Přidat kontakt</button></div>
      </form>
    </section>
  );
}

function Announcements() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    () => must(supabase.from('announcements').select('*, announcement_acks(user_id)').eq('edition_id', edition.id).order('created_at', { ascending: false })) as Promise<Announcement[]>,
    ['announcements'], edition.id, [edition.id],
  );
  const [f, setF] = useState({ title: '', body: '', critical: false, audiences: [] as Category[] });
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  async function create(publish: boolean) {
    if (!f.title.trim()) return setMessage({ kind: 'error', text: 'Vyplňte nadpis.' });
    const { error: err } = await supabase.from('announcements').insert({
      edition_id: edition.id, title: f.title.trim(), body: f.body.trim() || null, critical: f.critical, audiences: f.audiences,
      published_at: publish ? new Date().toISOString() : null,
    });
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: publish ? 'Oznámení zveřejněno.' : 'Uloženo jako koncept.' });
    if (!err) setF({ title: '', body: '', critical: false, audiences: [] });
    reload();
  }
  async function remove(a: Announcement) {
    if (!window.confirm(`Smazat oznámení „${a.title}“? Zmizí i z aplikace.`)) return;
    const { error: err } = await supabase.from('announcements').delete().eq('id', a.id);
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: 'Oznámení smazáno.' });
    reload();
  }
  async function publish(a: Announcement) {
    const { error: err } = await supabase.from('announcements').update({ published_at: new Date().toISOString() }).eq('id', a.id);
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: 'Oznámení zveřejněno.' });
    reload();
  }
  return (
    <section className="panel" aria-label="Oznámení">
      <div className="stack" style={{ padding: 20 }}>
        <h2>Oznámení</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Nepište do oznámení zdravotní údaje ani jména nemocných – může je vidět kdokoli s telefonem v ruce.</p>
        {error && <Notice kind="error">{error}</Notice>}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <div className="field"><label htmlFor="at">Nadpis</label><input id="at" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Odjezd na letiště o 30 minut dříve" /></div>
        <div className="field"><label htmlFor="ab">Text</label><textarea id="ab" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        <div className="row">
          <div className="field"><label htmlFor="aa">Uvidí</label>
            <select id="aa" value={key(f.audiences)} onChange={(e) => setF({ ...f, audiences: audienceOptions.find((o) => key(o.value) === e.target.value)!.value })}>
              {audienceOptions.map((o) => <option key={o.label} value={key(o.value)}>{o.label}</option>)}
            </select></div>
          <label className="checkbox"><input type="checkbox" checked={f.critical} onChange={(e) => setF({ ...f, critical: e.target.checked })} /> Důležité – vyžádat potvrzení „Přečetl(a) jsem“</label>
        </div>
        <div className="row">
          <button className="btn primary" type="button" onClick={() => create(true)}>Zveřejnit</button>
          <button className="btn" type="button" onClick={() => create(false)}>Uložit jako koncept</button>
        </div>
      </div>
      {data && data.length > 0 && (
        <table>
          <thead><tr><th>Oznámení</th><th>Stav</th><th className="num">Potvrdilo</th><th><span className="visually-hidden">Akce</span></th></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.title}</strong>{a.critical && <> <span className="tag"><Icon name="alert" width={12} /> důležité</span></>}{a.body && <div style={{ color: 'var(--muted)' }}>{a.body}</div>}</td>
                <td>{a.published_at ? `zveřejněno ${fmtStamp(new Date(a.published_at))}` : <button className="btn small" onClick={() => publish(a)}>Zveřejnit</button>}</td>
                <td className="num">{a.critical ? a.announcement_acks.length : '—'}</td>
                <td className="num"><button className="btn quiet small" onClick={() => remove(a)}>{t('common.delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
