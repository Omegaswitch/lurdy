import { archiveKey, archiveLists, archiveTemplate, parseCsv, readArchive, toCsv, type ArchiveList, type ArchiveRow } from '@lurdy/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { friendlyError } from '../errors';
import { Icon, Notice } from '../icons';
import { useReady } from '../session';
import { supabase } from '../supabase';

// Archive of past pilgrimages: who travelled (pilgrims), which sick pilgrims came and who served on the team, year by
// year. Filled from the organisers' own formatted CSV or Excel lists; contact details only, never health information.
type Person = {
  id: string; list: ArchiveList; year: number; last_name: string; first_name: string; title: string | null; birth_date: string | null;
  email: string | null; phone: string | null; address: string | null; parish: string | null; role: string | null; note: string | null;
};
const columns = 'id, list, year, last_name, first_name, title, birth_date, email, phone, address, parish, role, note';
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const czDate = (d: string | null) => (d ? d.split('-').reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join('. ') : '');

async function loadAll(): Promise<Person[]> {
  const out: Person[] = [];
  for (let from = 0; ; from += 1000) { // the API returns at most 1 000 rows at a time
    const { data, error } = await supabase.from('archive_people').select(columns)
      .order('year', { ascending: false }).order('last_name').order('first_name').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as Person[]));
    if ((data ?? []).length < 1000) return out;
  }
}

export function Archive() {
  const { roles, superAdmin } = useReady();
  const allowed = superAdmin || roles.includes('organizer');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ArchiveList>('pilgrim');
  const [year, setYear] = useState('');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const reload = useCallback(() => {
    loadAll().then((p) => { setPeople(p); setError(null); }, (e: Error) => setError(e.message));
  }, []);
  useEffect(() => { if (allowed) reload(); }, [allowed, reload]);

  const inList = useMemo(() => (people ?? []).filter((p) => p.list === list), [people, list]);
  const years = useMemo(() => [...new Set(inList.map((p) => p.year))].sort((a, b) => b - a), [inList]);
  const rows = useMemo(() => {
    const q = fold(query.trim());
    return inList.filter((p) => (!year || p.year === Number(year)) &&
      (!q || fold(`${p.first_name} ${p.last_name} ${p.parish ?? ''} ${p.address ?? ''} ${p.email ?? ''} ${p.phone ?? ''}`).includes(q)));
  }, [inList, year, query]);

  if (!allowed) return <Notice kind="warn">Archiv vidí jen organizátoři (přihlášení s ověřením aplikací).</Notice>;

  const label = archiveLists.find((l) => l.key === list)!.label;
  function exportCsv() {
    const csv = toCsv(['Rok', 'Příjmení', 'Jméno', 'Titul', 'Datum narození', 'Telefon', 'E-mail', 'Adresa', 'Farnost', ...(list === 'team' ? ['Funkce'] : []), 'Poznámka'],
      rows.map((p) => [p.year, p.last_name, p.first_name, p.title, czDate(p.birth_date), p.phone, p.email, p.address, p.parish, ...(list === 'team' ? [p.role] : []), p.note]));
    download(csv, `archiv-${fold(label)}${year ? `-${year}` : ''}.csv`);
    setNotice({ kind: 'warn', text: 'Soubor obsahuje osobní údaje. Uložte ho jen na zabezpečené místo a po použití smažte.' });
  }
  async function remove(p: Person) {
    if (!window.confirm(`Smazat z archivu: ${p.last_name} ${p.first_name} (${p.year})?`)) return;
    const { error: e } = await supabase.from('archive_people').delete().eq('id', p.id);
    if (e) return setNotice({ kind: 'error', text: friendlyError(e) });
    reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Archiv</h1>
          <p>Kdo jel na pouť v minulých letech: poutníci, nemocní a tým. Jen kontaktní údaje – zdravotní údaje se do archivu nikdy neukládají.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={downloadTemplate}><Icon name="download" width={18} /> Šablona CSV</button>
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>Exportovat CSV</button>
          <button className="btn primary" onClick={() => setUploading(true)}><Icon name="plus" width={18} /> Nahrát seznam (CSV, Excel)</button>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <div style={{ marginBottom: 16 }}><Notice kind={notice.kind}>{notice.text}</Notice></div>}
      {uploading && people && (
        <UploadPanel list={list} existing={people} onClose={(n, l) => {
          setUploading(false);
          if (n) { setNotice({ kind: 'ok', text: `Do archivu přidáno ${n} osob.` }); setList(l); setYear(''); reload(); }
        }} />
      )}
      <div className="row" role="tablist" aria-label="Seznam" style={{ marginBottom: 16 }}>
        {archiveLists.map((l) => (
          <button key={l.key} role="tab" aria-selected={l.key === list} className={`btn${l.key === list ? ' primary' : ''}`} onClick={() => { setList(l.key); setYear(''); }}>
            {l.label} <span className="tag" style={{ marginLeft: 6 }}>{(people ?? []).filter((p) => p.list === l.key).length}</span>
          </button>
        ))}
      </div>
      <section className="panel" aria-label={`Archiv – ${label}`}>
        <div className="toolbar">
          <label className="visually-hidden" htmlFor="aq">Hledat</label>
          <input id="aq" type="search" placeholder="Hledat jméno, farnost, kontakt" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="visually-hidden" htmlFor="ay">Rok</label>
          <select id="ay" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Všechny roky</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{rows.length} zobrazeno</span>
        </div>
        {!people ? (
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>{[1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>
        ) : rows.length === 0 ? (
          <p className="empty">{inList.length === 0 ? 'Tento seznam je zatím prázdný. Nahrajte CSV nebo Excel z minulých let.' : 'Nic neodpovídá hledání.'}</p>
        ) : (
          <table>
            <thead>
              <tr><th>Rok</th><th>Jméno</th><th>Narozen(a)</th><th>Kontakt</th><th>Farnost / adresa</th>{list === 'team' && <th>Funkce</th>}<th>Poznámka</th><th><span className="visually-hidden">Akce</span></th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.year}</td>
                  <td><strong>{p.last_name}</strong>&nbsp;{[p.title, p.first_name].filter(Boolean).join(' ')}</td>
                  <td>{czDate(p.birth_date)}</td>
                  <td>{[p.phone, p.email].filter(Boolean).join(' · ')}</td>
                  <td>{[p.parish, p.address].filter(Boolean).join(' · ')}</td>
                  {list === 'team' && <td>{p.role}</td>}
                  <td>{p.note}</td>
                  <td><button className="btn quiet small" onClick={() => remove(p)} aria-label={`Smazat ${p.last_name} ${p.first_name} (${p.year})`}><Icon name="trash" width={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

// Upload: read the file, show what will be added, and write only after "Přidat do archivu".
function UploadPanel({ list: initialList, existing, onClose }: { list: ArchiveList; existing: Person[]; onClose: (added: number, list: ArchiveList) => void }) {
  const [list, setList] = useState<ArchiveList>(initialList);
  const [year, setYear] = useState('');
  const [fileName, setFileName] = useState('');
  const [cells, setCells] = useState<unknown[][] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => (cells ? readArchive(cells, list, year ? Number(year) : null) : null), [cells, list, year]);
  const preview = useMemo(() => {
    if (!parsed) return [];
    const known = new Set(existing.map(archiveKey));
    const seen = new Set<string>();
    return parsed.rows.map((row) => {
      const key = archiveKey(row.values);
      const status: 'error' | 'known' | 'new' = row.errors.length ? 'error' : known.has(key) || seen.has(key) ? 'known' : 'new';
      seen.add(key);
      return { row, status };
    });
  }, [parsed, existing]);
  const toAdd = preview.filter((p) => p.status === 'new');
  const count = (s: string) => preview.filter((p) => p.status === s).length;

  async function load(file: File) {
    setFileName(file.name);
    setMessage(null);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        setCells(await readSheet(file));
      } else setCells(parseCsv(await file.text()));
    } catch {
      setCells(null);
      setMessage('Soubor nejde přečíst. Použijte CSV v kódování UTF-8 (oddělovač středník nebo čárka) nebo Excel (.xlsx).');
    }
  }
  async function run() {
    setBusy(true);
    for (let i = 0; i < toAdd.length; i += 500) {
      const { error } = await supabase.from('archive_people').insert(toAdd.slice(i, i + 500).map((p) => ({ ...p.row.values, source_file: fileName.slice(0, 200) })));
      if (error) {
        setBusy(false);
        return setMessage(`${friendlyError(error)} ${i ? `Přidáno bylo ${i} osob, zbytek ne.` : 'Nic nebylo přidáno.'}`);
      }
    }
    setBusy(false);
    onClose(toAdd.length, list);
  }

  return (
    <section className="panel stack" style={{ padding: 20, marginBottom: 24 }} aria-label="Nahrát seznam do archivu">
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Nahrát seznam do archivu</h2>
        <button className="btn quiet" onClick={() => onClose(0, list)}>Zavřít</button>
      </header>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        <li>Připravte CSV (nebo Excel) podle šablony: jeden řádek = jedna osoba, první řádek záhlaví. Sloupce Příjmení a Jméno jsou povinné.</li>
        <li>Rok a seznam mohou být sloupce v souboru; jinak je vyberte zde a platí pro všechny řádky.</li>
        <li>Nic se neuloží, dokud nezkontrolujete náhled a nekliknete na Přidat do archivu. Kdo už v archivu je, se přeskočí.</li>
      </ol>
      <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field"><label htmlFor="al">Seznam</label>
          <select id="al" value={list} onChange={(e) => setList(e.target.value as ArchiveList)}>
            {archiveLists.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select></div>
        <div className="field"><label htmlFor="ayr">Rok pouti</label>
          <input id="ayr" inputMode="numeric" maxLength={4} placeholder="např. 2019" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} style={{ width: 120 }} /></div>
        <div className="field"><label htmlFor="af">Soubor</label>
          <input id="af" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} /></div>
      </div>
      {message && <Notice kind="error">{message}</Notice>}
      {parsed?.health.length ? <Notice kind="warn">Sloupce se zdravotními údaji se do archivu nečtou a neukládají: {parsed.health.join(', ')}.</Notice> : null}
      {parsed?.ignored.length ? <Notice kind="info">Tyto sloupce archiv nezná a vynechá je: {parsed.ignored.join(', ')}.</Notice> : null}
      {parsed?.missing.length ? (
        <Notice kind="error">{parsed.missing.includes('year') && parsed.missing.length === 1
          ? 'V souboru není sloupec Rok – vyberte rok pouti výše.'
          : 'V souboru chybí sloupce Příjmení a Jméno, nebo se jmenují jinak. Upravte záhlaví podle šablony.'}</Notice>
      ) : null}
      {preview.length > 0 && (
        <>
          <p style={{ margin: 0 }}><strong>{count('new')}</strong> nových · {count('known')} už v archivu (přeskočí se) · {count('error')} s chybou (nepřidají se)</p>
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
            <table>
              <thead><tr><th>Řádek</th><th>Seznam</th><th>Rok</th><th>Jméno</th><th>Narozen(a)</th><th>Stav</th></tr></thead>
              <tbody>
                {preview.slice(0, 200).map(({ row, status }) => <PreviewRow key={row.line} row={row} status={status} />)}
              </tbody>
            </table>
          </div>
          {preview.length > 200 && <p style={{ margin: 0, color: 'var(--muted)' }}>Náhled ukazuje prvních 200 řádků; přidají se všechny bez chyby.</p>}
          <div className="row">
            <button className="btn primary" onClick={run} disabled={busy || toAdd.length === 0} aria-busy={busy}>{busy ? 'Ukládá se…' : `Přidat do archivu (${toAdd.length})`}</button>
          </div>
        </>
      )}
    </section>
  );
}

function PreviewRow({ row, status }: { row: ArchiveRow; status: 'error' | 'known' | 'new' }) {
  const v = row.values;
  return (
    <tr>
      <td>{row.line}</td>
      <td>{archiveLists.find((l) => l.key === v.list)?.label}</td>
      <td>{v.year || ''}</td>
      <td><strong>{v.last_name}</strong> {[v.title, v.first_name].filter(Boolean).join(' ')}</td>
      <td>{czDate(v.birth_date)}</td>
      <td>{status === 'new' ? <span className="tag">nový</span> : status === 'known' ? 'už v archivu' : <span style={{ color: 'var(--red-strong)' }}>{row.errors.join('; ')}</span>}</td>
    </tr>
  );
}

function downloadTemplate() {
  download(toCsv(archiveTemplate.map((c) => c.header),
    [['2019', 'Vzorová', 'Marie', '', '3.4.1950', '+420 000 000 000', 'marie@example.invalid', 'Polní 1, Kladno', 'Kladno', '', 'jela s dcerou']]), 'sablona-archiv.csv');
}

function download(csv: string, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
