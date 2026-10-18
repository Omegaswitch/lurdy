import { aiReformatPrompt, findDuplicates, importTemplate, parseCsv, readTable, t, toCsv, type Category, type ImportRow, type Tables } from '@lurdy/shared';
import { useMemo, useState } from 'react';
import { friendlyError } from '../errors';
import { Icon, Notice } from '../icons';
import { useReady } from '../session';
import { supabase } from '../supabase';

type Existing = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'>;
type Decision = 'add' | 'skip';

// Import: preview first, decide each possible duplicate, then insert in one go. Nothing is written before "Importovat".
export function ImportPanel({ existing, onClose }: { existing: Existing[]; onClose: (imported: number) => void }) {
  const { edition } = useReady();
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; missing: string[] } | null>(null);
  const [category, setCategory] = useState<Category>('pilgrim');
  const [table, setTable] = useState<unknown[][] | null>(null);
  const [foundHeaders, setFoundHeaders] = useState<string[] | undefined>();
  const [showPrompt, setShowPrompt] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [message, setMessage] = useState<{ kind: 'error' | 'ok' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row, i) => {
      // duplicates against the database and against earlier rows of the same file
      const earlier = parsed.rows.slice(0, i).map((r) => ({ id: `line ${r.line}`, ...r.values }));
      const dups = [...findDuplicates(row.values, existing), ...findDuplicates(row.values, earlier)];
      const status: 'error' | 'duplicate' | 'new' = row.errors.length ? 'error' : dups.length ? 'duplicate' : 'new';
      return { row, dups, status };
    });
  }, [parsed, existing]);

  async function load(file: File) {
    setFileName(file.name);
    try {
      let cells: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser'); // loaded only when someone imports a sheet
        cells = await readSheet(file);
      } else {
        cells = parseCsv(await file.text()); // CSV takes the same path as a sheet: parse once, keep the cells
      }
      setTable(cells);
      read(cells, category);
    } catch {
      setParsed(null);
      setMessage({ kind: 'error', text: 'Soubor nejde přečíst. Použijte Excel (.xlsx) nebo CSV v kódování UTF-8.' });
    }
  }
  function read(cells: unknown[][], cat: Category) {
    const r = readTable(cells, cat);
    setParsed(r);
    setDecisions({});
    setFoundHeaders((cells[0] ?? []).map((c) => String(c ?? '')).filter(Boolean));
    if (r.missing.length) setShowPrompt(true);
    setMessage(r.missing.length ? { kind: 'error', text: 'V souboru chybí sloupce Jméno a Příjmení, nebo se jmenují jinak. Upravte záhlaví podle šablony, nebo nechte tabulku přeformátovat umělou inteligencí (návod níže).' } : null);
  }
  const decision = (i: number, status: string): Decision => decisions[i] ?? (status === 'new' ? 'add' : 'skip');
  const toImport = preview.filter((p, i) => p.status !== 'error' && decision(i, p.status) === 'add');

  async function run() {
    setBusy(true);
    const { error } = await supabase.from('participants').insert(toImport.map((p) => ({ ...p.row.values, edition_id: edition.id })));
    setBusy(false);
    if (error) return setMessage({ kind: 'error', text: `${friendlyError(error)} Nic nebylo importováno.` });
    onClose(toImport.length);
  }

  const counts = { new: preview.filter((p) => p.status === 'new').length, duplicate: preview.filter((p) => p.status === 'duplicate').length, error: preview.filter((p) => p.status === 'error').length };
  return (
    <section className="panel stack" style={{ padding: 20, marginBottom: 24 }} aria-label="Import účastníků">
      <header className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Hromadný import účastníků</h2>
        <button className="btn quiet small" onClick={() => onClose(0)} aria-label={t('common.close')}><Icon name="x" width={18} /></button>
      </header>
      <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Stáhněte šablonu, nebo použijte vlastní tabulku. <button className="btn small" onClick={downloadTemplate}><Icon name="download" width={14} /> Šablona (Excel)</button></li>
        <li>Vlastní tabulku v jiném tvaru může přeformátovat Claude nebo jiná AI. <button className="btn small quiet" aria-expanded={showPrompt} aria-controls="ai-prompt" onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? 'Skrýt návod pro AI' : 'Návod pro AI'}</button></li>
        <li>Nahrajte soubor (.xlsx nebo .csv). Nic se neuloží, dokud neuvidíte náhled a nekliknete na Importovat.</li>
      </ol>
      {showPrompt && <AiPrompt found={parsed?.missing.length ? foundHeaders : undefined} />}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field"><label htmlFor="csv">Soubor</label>
          <input id="csv" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} /></div>
        <div className="field"><label htmlFor="dcat">Kategorie, když ve sloupci chybí</label>
          <select id="dcat" value={category} onChange={(e) => { const c = e.target.value as Category; setCategory(c); if (table) read(table, c); }}>
            {(['pilgrim', 'malade', 'assistant', 'staff'] as Category[]).map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
          </select></div>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {parsed && !parsed.missing.length && (
        <>
          <p style={{ margin: 0 }} role="status">{fileName}: {preview.length} řádků · <strong>{counts.new}</strong> nových · <strong>{counts.duplicate}</strong> možná již existuje · <strong>{counts.error}</strong> s chybou</p>
          <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 6 }}>
            <table>
              <thead><tr><th>Řádek</th><th>Jméno</th><th>Kategorie</th><th>Stav</th><th>Co udělat</th></tr></thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={p.row.line}>
                    <td className="mono">{p.row.line}</td>
                    <td>{p.row.values.last_name} {p.row.values.first_name}</td>
                    <td>{t(`category.${p.row.values.category}`)}</td>
                    <td>
                      {p.status === 'new' && <span className="tag"><Icon name="plus" width={12} /> nový</span>}
                      {p.status === 'error' && <span style={{ color: 'var(--bad)', display: 'flex', gap: 4 }}><Icon name="alert" width={14} /> {p.row.errors.join('; ')}</span>}
                      {p.status === 'duplicate' && (
                        <span style={{ color: 'var(--warn)', display: 'flex', gap: 4 }}><Icon name="alert" width={14} />
                          možná duplicita: {p.dups.map((d) => `${d.match.last_name} ${d.match.first_name} (${d.reason === 'name' ? 'stejné jméno' : d.reason === 'contact' ? 'stejný kontakt' : 'jméno i kontakt'})`).join(', ')}</span>
                      )}
                    </td>
                    <td>
                      {p.status === 'error' ? 'přeskočí se' : (
                        <>
                          <label className="visually-hidden" htmlFor={`d-${i}`}>Co udělat s řádkem {p.row.line}</label>
                          <select id={`d-${i}`} value={decision(i, p.status)} onChange={(e) => setDecisions((d) => ({ ...d, [i]: e.target.value as Decision }))}>
                            <option value="add">přidat</option>
                            <option value="skip">přeskočit</option>
                          </select>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <button className="btn primary" onClick={run} disabled={!toImport.length || busy} aria-busy={busy}>Importovat {toImport.length} {toImport.length === 1 ? 'osobu' : toImport.length < 5 ? 'osoby' : 'osob'}</button>
            <button className="btn" onClick={() => onClose(0)}>{t('common.cancel')}</button>
          </div>
        </>
      )}
    </section>
  );
}

// The prompt to paste into an AI with one's own sheet. The sheet goes to that AI provider, so the warning is explicit.
function AiPrompt({ found }: { found?: string[] }) {
  const prompt = aiReformatPrompt(found);
  const [copied, setCopied] = useState(false);
  return (
    <div id="ai-prompt" className="stack" style={{ gap: 8 }}>
      <Notice kind="warn">Tabulka se jmény a kontakty se tím odešle poskytovateli AI. Použijte jen službu, kterou Převorství schválilo pro osobní údaje, a nikdy do ní nevkládejte zdravotní údaje.</Notice>
      <label htmlFor="ai-prompt-text">Zkopírujte tento text, vložte ho do AI a přiložte svou tabulku. Výsledné CSV uložte a nahrajte sem.</label>
      <textarea id="ai-prompt-text" readOnly rows={10} value={prompt} style={{ fontFamily: 'inherit', width: '100%' }} />
      <div><button className="btn small" onClick={async () => { await navigator.clipboard.writeText(prompt); setCopied(true); }}>
        <Icon name={copied ? 'check' : 'copy'} width={14} /> {copied ? 'Zkopírováno' : 'Zkopírovat návod'}</button>
        <span role="status" className="visually-hidden">{copied ? 'Návod zkopírován do schránky' : ''}</span></div>
    </div>
  );
}

// Empty template: one sheet to fill in, one sheet explaining every column.
async function downloadTemplate() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const head = importTemplate.map((c) => ({ value: c.header, fontWeight: 'bold' as const }));
  await writeXlsxFile([
    { sheet: 'Účastníci', data: [head], columns: importTemplate.map(() => ({ width: 22 })) },
    { sheet: 'Návod', data: [
      [{ value: 'Sloupec', fontWeight: 'bold' as const }, { value: 'Povinný', fontWeight: 'bold' as const }, { value: 'Co sem patří', fontWeight: 'bold' as const }],
      ...importTemplate.map((c) => [{ value: c.header }, { value: c.required ? 'ano' : 'ne' }, { value: c.allowed }]),
      [], [{ value: 'Zdravotní údaje do této tabulky nepatří. Zapisují se jen v zabezpečené zdravotní části.' }],
    ], columns: [{ width: 16 }, { width: 10 }, { width: 70 }] },
  ]).toFile('sablona-ucastnici.xlsx');
}

// Export of operational data (never health data). Contains sign-in codes for invitation mail-merge.
export async function exportParticipants(editionId: string, year: number) {
  const { data, error } = await supabase.from('participants')
    .select('last_name, first_name, title, preferred_name, category, phone, email, language, mobility, logistics_note, access_code, leg_assignments(transport_legs(code, direction)), room_assignments(rooms(number, facilities(short_label, name)))')
    .eq('edition_id', editionId).order('last_name').order('first_name');
  if (error) throw error;
  const legs = (p: (typeof data)[number], dir: string) => p.leg_assignments.map((a) => a.transport_legs).filter((l) => l?.direction === dir).map((l) => l!.code).join(', ');
  const csv = toCsv(
    ['Příjmení', 'Jméno', 'Titul', 'Oslovení', 'Kategorie', 'Telefon', 'E-mail', 'Jazyk', 'Pohyblivost', 'Poznámka', 'Kód', 'Tam', 'Zpět', 'Ubytování', 'Pokoj'],
    data.map((p) => [p.last_name, p.first_name, p.title, p.preferred_name, t(`category.${p.category}`), p.phone, p.email, p.language,
      t(`mobility.${p.mobility}`), p.logistics_note, p.access_code, legs(p, 'outbound'), legs(p, 'return'),
      p.room_assignments?.rooms?.facilities?.short_label ?? p.room_assignments?.rooms?.facilities?.name ?? '', p.room_assignments?.rooms?.number ?? '']),
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `ucastnici-${year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
