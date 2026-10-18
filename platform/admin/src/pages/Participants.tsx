import { t, type Category, type Role, type Tables } from '@lurdy/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { friendlyError } from '../errors';
import { fullName } from '../format';
import { Icon, Notice } from '../icons';
import { must, useLive } from '../live';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Row = Tables<'participants'> & {
  role_grants: { role: Role }[];
  leg_assignments: { transport_legs: { code: string; direction: string } | null }[];
};
const categories: Category[] = ['pilgrim', 'malade', 'assistant', 'staff'];
const languages = ['cs', 'sk', 'en', 'fr', 'de', 'it', 'pl'];
const blank = {
  title: '', first_name: '', last_name: '', preferred_name: '', category: 'pilgrim' as Category, phone: '', email: '',
  language: 'cs', mobility: 'walks' as Tables<'participants'>['mobility'], logistics_note: '',
};
type Form = typeof blank;

// Lower-case, accent-free text for search.
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Participants() {
  const { edition } = useReady();
  const { data, error, reload } = useLive(
    () => must(supabase.from('participants')
      .select('*, role_grants(role), leg_assignments(transport_legs(code, direction))')
      .eq('edition_id', edition.id).order('last_name').order('first_name')) as Promise<Row[]>,
    ['participants', 'leg_assignments'],
    edition.id,
    [edition.id],
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'' | Category>('');
  const [selected, setSelected] = useState<string | 'new' | null>(null);

  const rows = useMemo(() => {
    const q = fold(query.trim());
    return (data ?? []).filter((p) =>
      (!category || p.category === category) &&
      (!q || fold(`${p.first_name} ${p.last_name} ${p.preferred_name ?? ''}`).includes(q) || p.access_code === q));
  }, [data, query, category]);
  const current = data?.find((p) => p.id === selected) ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('admin.participants')}</h1>
          <p>{data ? `${data.length} osob` : t('common.loading')}</p>
        </div>
        <button className="btn primary" onClick={() => setSelected('new')}><Icon name="plus" width={18} /> {t('admin.newParticipant')}</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className={selected ? 'split' : undefined}>
        <section className="panel" aria-label={t('admin.participants')}>
          <div className="toolbar">
            <label className="visually-hidden" htmlFor="q">{t('common.search')}</label>
            <input id="q" type="search" placeholder="Hledat jméno nebo kód" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="visually-hidden" htmlFor="cat">Filtrovat podle kategorie</label>
            <select id="cat" value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
              <option value="">Všechny kategorie</option>
              {categories.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
            </select>
            <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{rows.length} zobrazeno</span>
          </div>
          {!data ? (
            <div style={{ padding: 16, display: 'grid', gap: 10 }}>{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}</div>
          ) : rows.length === 0 ? (
            <p className="empty">{data.length === 0 ? t('admin.emptyParticipants') : t('admin.noResults')}</p>
          ) : (
            <table>
              <thead>
                <tr><th>Jméno</th><th>{t('admin.category')}</th><th>Kód</th><th>{t('admin.transport')}</th><th>Role</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="clickable" aria-selected={p.id === selected} onClick={() => setSelected(p.id)}>
                    <td>
                      <button className="btn quiet small" style={{ padding: 0, minHeight: 0 }} onClick={(e) => { e.stopPropagation(); setSelected(p.id); }}>
                        <strong>{p.last_name}</strong>&nbsp;{[p.title, p.first_name].filter(Boolean).join(' ')}
                      </button>
                    </td>
                    <td><span className={`tag ${p.category}`}>{t(`category.${p.category}`)}</span>{p.mobility === 'wheelchair' && <> <span className="tag">{t('mobility.wheelchair')}</span></>}</td>
                    <td className="mono">{p.access_code}</td>
                    <td>{p.leg_assignments.map((a) => a.transport_legs?.code).filter(Boolean).join(', ') || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>{p.role_grants.map((g) => t(`role.${g.role}`)).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {selected && (
          <Editor key={selected} row={selected === 'new' ? null : current} onClose={() => { setSelected(null); reload(); }}
            onSaved={(id) => { setSelected(id); reload(); }} />
        )}
      </div>
    </>
  );
}

function Editor({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { edition, roles: myRoles, superAdmin } = useReady();
  const [form, setForm] = useState<Form>(() => row ? {
    title: row.title ?? '', first_name: row.first_name, last_name: row.last_name, preferred_name: row.preferred_name ?? '',
    category: row.category, phone: row.phone ?? '', email: row.email ?? '', language: row.language, mobility: row.mobility,
    logistics_note: row.logistics_note ?? '',
  } : blank);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.first_name.trim() && form.last_name.trim();
  // Organisers grant team roles; organiser/medical are granted by a super admin.
  const grantable: Role[] = superAdmin ? ['organizer', 'medical', 'staff', 'assistant'] : ['staff', 'assistant'];
  const canGrant = superAdmin || myRoles.includes('organizer');

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return setMessage({ kind: 'error', text: 'Vyplňte jméno a příjmení.' });
    setBusy(true);
    const n = (s: string) => s.trim() || null;
    const values = {
      title: n(form.title), first_name: form.first_name.trim(), last_name: form.last_name.trim(), preferred_name: n(form.preferred_name),
      category: form.category, phone: n(form.phone), email: n(form.email), language: form.language, mobility: form.mobility,
      logistics_note: n(form.logistics_note),
    };
    if (row) {
      const { data, error } = await supabase.from('participants').update(values).eq('id', row.id).eq('version', row.version).select('id');
      setBusy(false);
      if (error) return setMessage({ kind: 'error', text: friendlyError(error) });
      if (!data?.length) return setMessage({ kind: 'warn', text: t('common.conflict') });
      setMessage({ kind: 'ok', text: 'Uloženo.' });
      onSaved(row.id);
    } else {
      const { data, error } = await supabase.from('participants').insert({ ...values, edition_id: edition.id }).select('id').single();
      setBusy(false);
      if (error) return setMessage({ kind: 'error', text: friendlyError(error) });
      onSaved(data.id);
    }
  }

  async function toggleRole(role: Role, on: boolean) {
    if (!row) return;
    const { error } = on
      ? await supabase.from('role_grants').insert({ participant_id: row.id, role, edition_id: row.edition_id })
      : await supabase.from('role_grants').delete().eq('participant_id', row.id).eq('role', role);
    setMessage(error ? { kind: 'error', text: friendlyError(error) } : null);
    onSaved(row.id);
  }

  async function remove() {
    if (!row || !window.confirm(`Opravdu smazat ${fullName(row)}? Smažou se i přidělení k dopravě, ubytování a jmenovky.`)) return;
    const { error } = await supabase.from('participants').delete().eq('id', row.id);
    if (error) return setMessage({ kind: 'error', text: friendlyError(error) });
    onClose();
  }

  return (
    <aside className="panel side" aria-label={row ? fullName(row) : t('admin.newParticipant')}>
      <header>
        <h2>{row ? fullName(row) : t('admin.newParticipant')}</h2>
        <button className="btn quiet small" onClick={onClose} aria-label={t('common.close')}><Icon name="x" width={18} /></button>
      </header>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {row && (
        <div className="field">
          <span className="label">{t('admin.accessCode')}</span>
          <span className="mono" style={{ fontSize: '1.6rem' }}>{row.access_code}</span>
          <span className="help">Osobní – nepište ho na jmenovku ani do veřejných seznamů.</span>
        </div>
      )}
      <form className="stack" onSubmit={save} noValidate>
        <div className="grid2">
          <div className="field"><label htmlFor="fn">{t('admin.firstName')}</label>
            <input id="fn" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} aria-invalid={!form.first_name.trim()} required /></div>
          <div className="field"><label htmlFor="ln">{t('admin.lastName')}</label>
            <input id="ln" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} aria-invalid={!form.last_name.trim()} required /></div>
          <div className="field"><label htmlFor="ti">{t('admin.title')}</label>
            <input id="ti" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="P., Sr., MUDr." /></div>
          <div className="field"><label htmlFor="pn">{t('admin.preferredName')}</label>
            <input id="pn" value={form.preferred_name} onChange={(e) => set('preferred_name', e.target.value)} /></div>
          <div className="field"><label htmlFor="ca">{t('admin.category')}</label>
            <select id="ca" value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {categories.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
            </select></div>
          <div className="field"><label htmlFor="mo">{t('admin.mobility')}</label>
            <select id="mo" value={form.mobility} onChange={(e) => set('mobility', e.target.value as Form['mobility'])}>
              {(['walks', 'assisted', 'wheelchair'] as const).map((m) => <option key={m} value={m}>{t(`mobility.${m}`)}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ph">{t('admin.phone')}</label>
            <input id="ph" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field"><label htmlFor="la">{t('admin.language')}</label>
            <select id="la" value={form.language} onChange={(e) => set('language', e.target.value)}>
              {languages.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select></div>
        </div>
        <div className="field"><label htmlFor="em">{t('admin.email')}</label>
          <input id="em" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        <div className="field"><label htmlFor="no">{t('admin.logisticsNote')}</label>
          <textarea id="no" rows={2} value={form.logistics_note} onChange={(e) => set('logistics_note', e.target.value)} />
          <span className="help">Jen praktické informace pro dopravu a ubytování. Zdravotní údaje sem nepatří.</span></div>
        <div className="row">
          <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{t('common.save')}</button>
          <button className="btn" type="button" onClick={onClose}>{t('common.cancel')}</button>
          {row && <button className="btn quiet" type="button" style={{ marginLeft: 'auto' }} onClick={remove}>{t('common.delete')}</button>}
        </div>
      </form>
      {row && canGrant && (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>{t('admin.roles')}</legend>
          {(['organizer', 'medical', 'staff', 'assistant'] as Role[]).map((r) => (
            <label key={r} className="checkbox">
              <input type="checkbox" checked={row.role_grants.some((g) => g.role === r)} disabled={!grantable.includes(r)}
                onChange={(e) => toggleRole(r, e.target.checked)} />
              {t(`role.${r}`)}
            </label>
          ))}
          <span className="help">Člen týmu se přihlašuje svým kódem a kódem pouti. Organizátora a zdravotníka přidává správce.</span>
        </fieldset>
      )}
    </aside>
  );
}
