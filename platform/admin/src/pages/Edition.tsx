import { t, type Tables } from '@lurdy/shared';
import { useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fmtStamp, fromLocalInput, toLocalInput } from '../format';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useAuth, useReady } from '../session';
import { supabase } from '../supabase';

type Code = Tables<'staff_codes'>;
// No 0/O or 1/I: event codes are read aloud and typed on phones.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomEventCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function Edition() {
  const { edition } = useReady();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    title: edition.title, year: String(edition.year), starts_on: edition.starts_on, ends_on: edition.ends_on,
    emergency_phone: edition.emergency_phone ?? '', timezone: edition.timezone,
  });
  const [message, setMessage] = useState<{ kind: 'error' | 'ok' | 'warn'; text: string } | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.title.trim()) return setMessage({ kind: 'error', text: 'Vyplňte název ročníku.' });
    const year = Number(form.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) return setMessage({ kind: 'error', text: 'Rok musí být čtyřmístný, např. 2027.' });
    if (!form.starts_on || !form.ends_on) return setMessage({ kind: 'error', text: 'Vyplňte začátek i konec pouti.' });
    if (form.starts_on > form.ends_on) return setMessage({ kind: 'error', text: 'Konec pouti musí být po začátku.' });
    setBusy(true);
    const { data, error } = await supabase.from('editions').update({
      title: form.title.trim(), year: Number(form.year), starts_on: form.starts_on, ends_on: form.ends_on,
      emergency_phone: form.emergency_phone.trim() || null, timezone: form.timezone,
    }).eq('id', edition.id).eq('version', edition.version).select('id');
    setBusy(false);
    if (error) return setMessage({ kind: 'error', text: friendlyError(error) });
    if (!data?.length) { refresh(); return setMessage({ kind: 'warn', text: t('common.conflict') }); }
    setMessage({ kind: 'ok', text: 'Uloženo.' });
    refresh();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('admin.edition')} {edition.year}</h1>
          <p>Údaje ročníku a kódy pouti, kterými se přihlašuje tým.</p>
        </div>
      </div>
      <div className="split even">
        <form className="panel stack" style={{ padding: 20 }} onSubmit={save} aria-label="Údaje ročníku">
          <h2>Údaje ročníku</h2>
          {message && <Notice kind={message.kind}>{message.text}</Notice>}
          <div className="field"><label htmlFor="et">Název</label><input id="et" value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="ey">Rok</label><input id="ey" type="number" value={form.year} onChange={(e) => set('year', e.target.value)} /></div>
            <div className="field"><label htmlFor="ez">Časové pásmo pouti</label>
              <select id="ez" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {['Europe/Paris', 'Europe/Prague'].map((z) => <option key={z}>{z}</option>)}
              </select></div>
            <div className="field"><label htmlFor="es">Začátek</label><input id="es" type="date" value={form.starts_on} onChange={(e) => set('starts_on', e.target.value)} /></div>
            <div className="field"><label htmlFor="ee">Konec</label><input id="ee" type="date" value={form.ends_on} onChange={(e) => set('ends_on', e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="ep">Nouzová linka pouti</label>
            <input id="ep" type="tel" value={form.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} />
            <span className="help">Tiskne se na jmenovky a je v aplikaci pod Pomoc.</span></div>
          <div><button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{t('common.save')}</button></div>
        </form>
        <EventCodes />
      </div>
    </>
  );
}

function EventCodes() {
  const { edition, staffCodeId } = useReady();
  const { data, error, reload } = useLive(
    () => must(supabase.from('staff_codes').select('*').eq('edition_id', edition.id).order('valid_from')) as Promise<Code[]>,
    ['staff_codes'], edition.id, [edition.id],
  );
  const now = new Date().toISOString();
  const [form, setForm] = useState({ code: randomEventCode(), label: 'před poutí', from: toLocalInput(now, edition.timezone), until: `${edition.ends_on}T23:59` });
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!fromLocalInput(form.from, edition.timezone) || !fromLocalInput(form.until, edition.timezone)) return setMessage({ kind: 'error', text: 'Vyplňte začátek i konec platnosti.' });
    const { error: err } = await supabase.from('staff_codes').insert({
      edition_id: edition.id, code: form.code, label: form.label.trim() || null,
      valid_from: fromLocalInput(form.from, edition.timezone)!, valid_until: fromLocalInput(form.until, edition.timezone)!,
    });
    if (err) return setMessage({ kind: 'error', text: err.message.includes('valid_until') ? 'Konec platnosti musí být po začátku.' : friendlyError(err) });
    setMessage({ kind: 'ok', text: `Kód ${form.code} přidán. Sdělte ho týmu osobně, ne v hromadném e-mailu.` });
    setForm((f) => ({ ...f, code: randomEventCode() }));
    reload();
  }

  // Ending a code now (instead of deleting it) keeps the audit trail; team members signed in with it lose team rights.
  async function endNow(c: Code) {
    if (c.id === staffCodeId) {
      return setMessage({ kind: 'error', text: `Kódem ${c.code} jste přihlášeni vy. Nejdřív vytvořte nový kód a přihlaste se s ním, teprve potom tento ukončete.` });
    }
    if (!window.confirm(`Ukončit platnost kódu ${c.code} hned teď? Kdo je s ním přihlášen, ztratí týmová oprávnění.`)) return;
    const { error: err } = await supabase.from('staff_codes').update({ valid_until: new Date().toISOString() }).eq('id', c.id);
    setMessage(err ? { kind: 'error', text: friendlyError(err) } : { kind: 'ok', text: `Kód ${c.code} už neplatí.` });
    reload();
  }

  const state = (c: Code) => (c.valid_until <= now ? 'neplatí' : c.valid_from > now ? 'bude platit' : 'platí');
  return (
    <section className="panel" aria-label="Kódy pouti">
      <div className="stack" style={{ padding: 20 }}>
        <h2>Kódy pouti pro tým</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Člen týmu se přihlašuje svým čtyřmístným kódem a platným kódem pouti. Můžete mít kód „před poutí“ a jiný „během pouti“.</p>
        {error && <Notice kind="error">{error}</Notice>}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </div>
      {data && data.length > 0 && (
        <table>
          <thead><tr><th>Kód</th><th>Popis</th><th>Platí</th><th>Stav</th><th><span className="visually-hidden">Akce</span></th></tr></thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td>{c.label}</td>
                <td>{fmtStamp(new Date(c.valid_from))} – {fmtStamp(new Date(c.valid_until))}</td>
                <td><span className="tag">{state(c)}</span></td>
                <td className="num">{state(c) !== 'neplatí' && <button className="btn quiet small" onClick={() => endNow(c)}>Ukončit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="stack" style={{ padding: 20 }} onSubmit={add} aria-label="Nový kód pouti">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field"><label htmlFor="cc">Nový kód</label>
            <input id="cc" className="code" value={form.code} readOnly style={{ maxWidth: '10ch', fontSize: '1.2rem' }} /></div>
          <button className="btn small" type="button" onClick={() => setForm((f) => ({ ...f, code: randomEventCode() }))}>Jiný kód</button>
          <div className="field"><label htmlFor="cl">Popis</label><input id="cl" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></div>
        </div>
        <div className="grid2">
          <div className="field"><label htmlFor="cf">Platí od</label><input id="cf" type="datetime-local" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} /></div>
          <div className="field"><label htmlFor="cu">Platí do</label><input id="cu" type="datetime-local" value={form.until} onChange={(e) => setForm((f) => ({ ...f, until: e.target.value }))} /></div>
        </div>
        <div><button className="btn primary" type="submit"><Icon name="plus" width={18} /> Přidat kód</button></div>
      </form>
    </section>
  );
}
