import { t, type Enums, type Tables } from '@lurdy/shared';
import { useMemo, useState } from 'react';
import { friendlyError } from '../errors';
import { fmtStamp } from '../format';
import { Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

// Applications sent on the public website (lurdy.eu → Přihlášky). The organiser checks each one and accepts it into
// this year's participants (sign-in codes are created with it) or declines it. Only identity, contact and the
// emergency contact arrive here; health answers, the ID-card number and attachments stay in the organisers' e-mail.
type Application = Tables<'applications'>;
type Status = Enums<'application_status'>;
const forms: Record<Enums<'application_form'>, { label: string; category: Enums<'participant_category'> }> = {
  pilgrim: { label: 'Poutník', category: 'pilgrim' },
  malade: { label: 'Nemocný', category: 'malade' },
  team: { label: 'Tým', category: 'assistant' },
};
const statuses: { key: Status; label: string }[] = [{ key: 'new', label: 'Nové' }, { key: 'accepted', label: 'Přijaté' }, { key: 'declined', label: 'Zamítnuté' }];
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const czDate = (d: string | null) => (d ? d.split('-').reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join('. ') : '');

export function Applications() {
  const { edition, roles, superAdmin } = useReady();
  const allowed = superAdmin || roles.includes('organizer');
  const [status, setStatus] = useState<Status>('new');
  const [open, setOpen] = useState<string | null>(null);
  const { data, error } = useLive(async () => {
    const [apps, people] = await Promise.all([
      must(supabase.from('applications').select('*').eq('edition_id', edition.id).order('submitted_at', { ascending: false })) as Promise<Application[]>,
      must(supabase.from('participants').select('id, first_name, last_name').eq('edition_id', edition.id)) as Promise<{ id: string; first_name: string; last_name: string }[]>,
    ]);
    return { apps, people };
  }, ['applications', 'participants'], edition.id, [edition.id]);

  const rows = useMemo(() => (data?.apps ?? []).filter((a) => a.status === status), [data, status]);
  if (!allowed) return <Notice kind="warn">Přihlášky vidí jen organizátoři.</Notice>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Přihlášky</h1>
          <p>Přihlášky odeslané na webu pouti. Přijatá přihláška se stane účastníkem tohoto ročníku (s kódy pro přihlášení). Zdravotní údaje, číslo dokladu a přílohy sem nechodí – jsou jen v e-mailu s přihláškou.</p>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row" role="tablist" aria-label="Stav přihlášek" style={{ marginBottom: 16 }}>
        {statuses.map((s) => (
          <button key={s.key} role="tab" aria-selected={s.key === status} className={`btn${s.key === status ? ' primary' : ''}`} onClick={() => { setStatus(s.key); setOpen(null); }}>
            {s.label} <span className="tag" style={{ marginLeft: 6 }}>{(data?.apps ?? []).filter((a) => a.status === s.key).length}</span>
          </button>
        ))}
      </div>
      <section className="panel" aria-label={`Přihlášky – ${statuses.find((s) => s.key === status)!.label}`}>
        {!data ? <p style={{ padding: 20 }}>{t('common.loading')}</p> : rows.length === 0 ? (
          <p style={{ padding: 20, color: 'var(--muted)' }}>{status === 'new' ? 'Žádná nová přihláška.' : 'Nic tu není.'}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Odesláno</th><th>Jméno</th><th>Přihláška</th><th>Narozen(a)</th><th>Kontakt</th><th>Kontakt v nouzi</th><th><span className="visually-hidden">Akce</span></th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <Row key={a.id} a={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} people={data.people} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Row({ a, open, onToggle, people }: { a: Application; open: boolean; onToggle: () => void; people: { id: string; first_name: string; last_name: string }[] }) {
  return (
    <>
      <tr>
        <td>{fmtStamp(new Date(a.submitted_at))}</td>
        <td><strong>{a.full_name}</strong>{a.times && <div style={{ color: 'var(--muted)' }}>Na pouti: {a.times}</div>}</td>
        <td>{forms[a.form].label}</td>
        <td>{czDate(a.birth_date)}</td>
        <td>{[a.phone, a.phone2, a.email].filter(Boolean).join(' · ')}{a.address && <div style={{ color: 'var(--muted)' }}>{a.address}</div>}</td>
        <td>{[a.emergency_name, a.emergency_phone].filter(Boolean).join(' · ')}</td>
        <td>
          {a.status === 'new' && <button className="btn small" onClick={onToggle} aria-expanded={open}>{open ? 'Zavřít' : 'Posoudit'}</button>}
          {a.status === 'accepted' && <span className="tag">přijato {a.decided_at && fmtStamp(new Date(a.decided_at))}</span>}
          {a.status === 'declined' && <Decided a={a} />}
        </td>
      </tr>
      {open && <tr><td colSpan={7}><Decide a={a} people={people} onDone={onToggle} /></td></tr>}
    </>
  );
}

function Decided({ a }: { a: Application }) {
  const [message, setMessage] = useState<string | null>(null);
  async function remove() {
    if (!window.confirm(`Smazat zamítnutou přihlášku: ${a.full_name}?`)) return;
    const { error } = await supabase.from('applications').delete().eq('id', a.id);
    if (error) setMessage(friendlyError(error));
  }
  return (
    <>
      <button className="btn quiet small" onClick={remove} aria-label={`Smazat přihlášku ${a.full_name}`}>Smazat</button>
      {message && <Notice kind="error">{message}</Notice>}
    </>
  );
}

function Decide({ a, people, onDone }: { a: Application; people: { id: string; first_name: string; last_name: string }[]; onDone: () => void }) {
  const [first, setFirst] = useState(a.first_name);
  const [last, setLast] = useState(a.last_name);
  const [category, setCategory] = useState<Enums<'participant_category'>>(forms[a.form].category);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const twins = people.filter((p) => fold(p.first_name) === fold(first) && fold(p.last_name) === fold(last));

  async function accept() {
    setBusy(true);
    const { error } = await supabase.rpc('accept_application', { p_application: a.id, p_category: category, p_first_name: first, p_last_name: last });
    setBusy(false);
    if (error) return setMessage(friendlyError(error));
    onDone();
  }
  async function decline() {
    if (!window.confirm(`Zamítnout přihlášku: ${a.full_name}? Osobě napište sami – systém nic neposílá.`)) return;
    setBusy(true);
    const { error } = await supabase.from('applications').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', a.id);
    setBusy(false);
    if (error) return setMessage(friendlyError(error));
    onDone();
  }

  return (
    <div className="stack" style={{ padding: '8px 0' }} aria-label={`Posouzení přihlášky ${a.full_name}`} role="group">
      {message && <Notice kind="error">{message}</Notice>}
      {twins.length > 0 && <Notice kind="warn">Mezi účastníky už je {twins.map((p) => `${p.first_name} ${p.last_name}`).join(', ')}. Nejde o dvojí přihlášku?</Notice>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field"><label htmlFor={`af-${a.id}`}>Jméno</label><input id={`af-${a.id}`} value={first} onChange={(e) => setFirst(e.target.value)} /></div>
        <div className="field"><label htmlFor={`al-${a.id}`}>Příjmení</label><input id={`al-${a.id}`} value={last} onChange={(e) => setLast(e.target.value)} /></div>
        <div className="field"><label htmlFor={`ac-${a.id}`}>Kategorie</label>
          <select id={`ac-${a.id}`} value={category} onChange={(e) => setCategory(e.target.value as Enums<'participant_category'>)}>
            {(['pilgrim', 'malade', 'assistant', 'staff'] as const).map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select></div>
      </div>
      <div className="row">
        <button className="btn primary" onClick={accept} disabled={busy || !first.trim() || !last.trim()} aria-busy={busy}>Přijmout mezi účastníky</button>
        <button className="btn quiet" onClick={decline} disabled={busy}>Zamítnout</button>
      </div>
    </div>
  );
}
