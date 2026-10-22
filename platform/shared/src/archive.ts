// The archive of past pilgrimages: who travelled (pilgrims), which sick pilgrims came (malades) and who served on the
// team, year by year. Organisers upload their own formatted CSV (or Excel) lists; this reads them. Contact details
// only: columns with health information are never read, whatever the file contains.

export type ArchiveList = 'pilgrim' | 'malade' | 'team';
export const archiveLists: { key: ArchiveList; label: string }[] = [
  { key: 'pilgrim', label: 'Poutníci' },
  { key: 'malade', label: 'Nemocní' },
  { key: 'team', label: 'Tým' },
];

export type ArchiveField = 'year' | 'last_name' | 'first_name' | 'title' | 'birth_date' | 'email' | 'phone' | 'address' | 'parish' | 'role' | 'note' | 'list';
export type ArchiveValues = {
  list: ArchiveList; year: number; last_name: string; first_name: string; title: string | null; birth_date: string | null;
  email: string | null; phone: string | null; address: string | null; parish: string | null; role: string | null; note: string | null;
};
export type ArchiveRow = { line: number; values: ArchiveValues; errors: string[] };

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

const headerNames: Record<ArchiveField, string[]> = {
  year: ['rok', 'rocnik', 'year', 'annee', 'pout'],
  last_name: ['prijmeni', 'last name', 'lastname', 'surname', 'family name', 'nom'],
  first_name: ['jmeno', 'krestni jmeno', 'first name', 'firstname', 'given name', 'prenom'],
  title: ['titul', 'title', 'titre'],
  birth_date: ['datum narozeni', 'narozen', 'narozena', 'narozeni', 'date of birth', 'birth date', 'birthdate', 'date de naissance', 'ne le', 'nee le'],
  email: ['e-mail', 'email', 'mail', 'courriel'],
  phone: ['telefon', 'tel', 'tel.', 'mobil', 'phone', 'mobile', 'telephone', 'portable'],
  address: ['adresa', 'bydliste', 'address', 'adresse', 'obec', 'mesto', 'ville'],
  parish: ['farnost', 'parish', 'paroisse', 'dieceze', 'diocese'],
  role: ['funkce', 'sluzba', 'ukol', 'role', 'function', 'fonction', 'service'],
  note: ['poznamka', 'note', 'notes', 'remarque'],
  list: ['seznam', 'kategorie', 'category', 'list', 'liste', 'categorie', 'typ'],
};

// Columns that would carry health information: never read, and the person importing is told so.
const healthWords = ['diagnoz', 'nemoc', 'lek', 'alergi', 'postizen', 'zdravot', 'diagnos', 'medic', 'allerg', 'handicap', 'traitement', 'maladie', 'sante', 'health', 'disab'];
export const isHealthHeader = (h: string) => healthWords.some((w) => fold(h).includes(w));

export function mapArchiveHeaders(header: string[]): { map: Partial<Record<ArchiveField, number>>; ignored: string[]; health: string[] } {
  const map: Partial<Record<ArchiveField, number>> = {};
  const ignored: string[] = [], health: string[] = [];
  header.forEach((h, i) => {
    const key = fold(h);
    if (!key) return;
    if (isHealthHeader(h)) { health.push(h); return; }
    const field = (Object.entries(headerNames) as [ArchiveField, string[]][]).find(([, names]) => names.includes(key))?.[0];
    if (field && map[field] === undefined) map[field] = i;
    else ignored.push(h);
  });
  return { map, ignored, health };
}

const listWords: Record<string, ArchiveList> = {
  poutnik: 'pilgrim', poutnice: 'pilgrim', poutnici: 'pilgrim', pilgrim: 'pilgrim', pelerin: 'pilgrim', voyageur: 'pilgrim', traveller: 'pilgrim', traveler: 'pilgrim', cestujici: 'pilgrim',
  nemocny: 'malade', nemocna: 'malade', nemocni: 'malade', malade: 'malade', malades: 'malade', sick: 'malade',
  tym: 'team', team: 'team', staff: 'team', 'clen tymu': 'team', equipe: 'team', asistent: 'team', asistentka: 'team', hospitalier: 'team', hospitaliere: 'team',
};

// 31.12.1950, 31. 12. 1950, 1950-12-31, 12/31/1950 is not accepted (ambiguous): only day-first or ISO.
export function readBirthDate(s: string): string | null | 'invalid' {
  const v = s.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const cz = v.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/) ?? v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (cz) [d, m, y] = [Number(cz[1]), Number(cz[2]), Number(cz[3])];
  else return 'invalid';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 1900 || y > 2100) return 'invalid';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const limits: Partial<Record<ArchiveField, number>> = { last_name: 120, first_name: 120, title: 40, email: 200, phone: 40, address: 300, parish: 120, role: 120, note: 500 };

// Reads a sheet already split into cells (CSV via parseCsv, or an .xlsx). `list` and `year` are used when the file has no
// such column. Rows with errors are reported, never silently fixed.
export function readArchive(table: unknown[][], list: ArchiveList, year: number | null):
  { rows: ArchiveRow[]; missing: ArchiveField[]; ignored: string[]; health: string[] } {
  const cells = table.map((r, i) => ({ line: i + 1, r: r.map((c) => (c == null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))) }))
    .filter(({ r }) => r.some((x) => x.trim() !== ''));
  const [head, ...body] = cells;
  if (!head) return { rows: [], missing: ['last_name', 'first_name'], ignored: [], health: [] };
  const { map, ignored, health } = mapArchiveHeaders(head.r);
  const missing = (['last_name', 'first_name'] as ArchiveField[]).filter((f) => map[f] === undefined);
  if (map.year === undefined && year == null) missing.push('year');
  if (missing.length) return { rows: [], missing, ignored, health };
  const get = (r: string[], f: ArchiveField) => (map[f] === undefined ? '' : (r[map[f]!] ?? '').trim());
  const rows = body.map(({ line, r }) => {
    const errors: string[] = [];
    const yText = get(r, 'year');
    const y = yText ? Number(yText.match(/\d{4}/)?.[0]) : year;
    if (!y || y < 1950 || y > 2200) errors.push(`rok „${yText}“ není platný`);
    const lText = fold(get(r, 'list'));
    const l = lText ? listWords[lText] : list;
    if (!l) errors.push(`seznam „${get(r, 'list')}“ neznám (poutník, nemocný, tým)`);
    const birth = readBirthDate(get(r, 'birth_date'));
    if (birth === 'invalid') errors.push(`datum narození „${get(r, 'birth_date')}“ musí být ve tvaru 31.12.1950 nebo 1950-12-31`);
    const email = get(r, 'email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('e-mail nemá platný tvar');
    if (!get(r, 'first_name') || !get(r, 'last_name')) errors.push('chybí jméno nebo příjmení');
    for (const [f, max] of Object.entries(limits) as [ArchiveField, number][])
      if (get(r, f).length > max) errors.push(`${f === 'note' ? 'poznámka' : 'údaj'} je příliš dlouhý (nejvýše ${max} znaků)`);
    const n = (f: ArchiveField) => get(r, f) || null;
    return {
      line, errors,
      values: { list: l ?? list, year: y ?? 0, last_name: get(r, 'last_name'), first_name: get(r, 'first_name'), title: n('title'),
        birth_date: birth === 'invalid' ? null : birth, email: email || null, phone: n('phone'), address: n('address'), parish: n('parish'), role: n('role'), note: n('note') },
    };
  });
  return { rows, missing, ignored, health };
}

// The same person in the same list and year is in the archive once (accents and case ignored; the birth date tells
// namesakes apart). Used for the preview; the database enforces the same rule.
export const archiveKey = (v: Pick<ArchiveValues, 'list' | 'year' | 'last_name' | 'first_name' | 'birth_date'>) =>
  [v.list, v.year, fold(v.last_name), fold(v.first_name), v.birth_date ?? ''].join('\u0000');

export const archiveTemplate: { header: string; required: boolean; allowed: string }[] = [
  { header: 'Rok', required: true, allowed: 'rok pouti, např. 2019 (nebo vyberte rok při nahrání)' },
  { header: 'Příjmení', required: true, allowed: 'text' },
  { header: 'Jméno', required: true, allowed: 'text' },
  { header: 'Titul', required: false, allowed: 'Ing., MUDr., P. …' },
  { header: 'Datum narození', required: false, allowed: '31.12.1950 nebo 1950-12-31' },
  { header: 'Telefon', required: false, allowed: 'např. +420 601 234 567' },
  { header: 'E-mail', required: false, allowed: 'e-mailová adresa' },
  { header: 'Adresa', required: false, allowed: 'ulice, obec' },
  { header: 'Farnost', required: false, allowed: 'farnost nebo diecéze' },
  { header: 'Funkce', required: false, allowed: 'jen u týmu: služba na pouti, např. vedoucí autobusu' },
  { header: 'Poznámka', required: false, allowed: 'krátká poznámka – nikdy zdravotní údaje' },
];
