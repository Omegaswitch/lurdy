// Participant import/export as CSV. Pure functions, unit-tested: parsing (RFC 4180, ';' or ',' — Czech Excel uses ';'),
// column mapping in Czech or English, validation, and duplicate detection against existing people and within the file.
// Health data is never part of these files.
import type { Category } from './types';

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export type ImportField = 'first_name' | 'last_name' | 'title' | 'preferred_name' | 'category' | 'phone' | 'email' | 'language' | 'mobility' | 'logistics_note';
const headerNames: Record<ImportField, string[]> = {
  first_name: ['jmeno', 'krestni jmeno', 'first name', 'firstname', 'given name'],
  last_name: ['prijmeni', 'last name', 'lastname', 'surname', 'family name'],
  title: ['titul', 'title'],
  preferred_name: ['osloveni', 'preferred name', 'nickname'],
  category: ['kategorie', 'category', 'typ', 'role'],
  phone: ['telefon', 'tel', 'mobil', 'phone', 'mobile'],
  email: ['e-mail', 'email', 'mail'],
  language: ['jazyk', 'language'],
  mobility: ['pohyblivost', 'mobility', 'vozik', 'wheelchair'],
  logistics_note: ['poznamka', 'poznamka k logistice', 'note', 'notes'],
};

export function mapHeaders(header: string[]): Partial<Record<ImportField, number>> {
  const map: Partial<Record<ImportField, number>> = {};
  header.forEach((h, i) => {
    const key = fold(h);
    for (const [field, names] of Object.entries(headerNames) as [ImportField, string[]][])
      if (names.includes(key) && map[field] === undefined) map[field] = i;
  });
  return map;
}

const categoryWords: Record<string, Category> = {
  poutnik: 'pilgrim', poutnice: 'pilgrim', pilgrim: 'pilgrim',
  nemocny: 'malade', nemocna: 'malade', malade: 'malade', sick: 'malade',
  asistent: 'assistant', asistentka: 'assistant', assistant: 'assistant',
  tym: 'staff', team: 'staff', staff: 'staff', 'clen tymu': 'staff',
};
const mobilityWords: Record<string, 'walks' | 'assisted' | 'wheelchair'> = {
  '': 'walks', chodi: 'walks', 'chodi sam': 'walks', walks: 'walks', ne: 'walks', no: 'walks',
  doprovod: 'assisted', 'potrebuje doprovod': 'assisted', assisted: 'assisted',
  vozik: 'wheelchair', wheelchair: 'wheelchair', ano: 'wheelchair', yes: 'wheelchair',
};

export type ImportRow = {
  line: number; // 1-based line in the file, for messages
  values: { first_name: string; last_name: string; title: string | null; preferred_name: string | null; category: Category;
    phone: string | null; email: string | null; language: string; mobility: 'walks' | 'assisted' | 'wheelchair'; logistics_note: string | null };
  errors: string[];
};

export function readRows(text: string, defaultCategory: Category = 'pilgrim'): { rows: ImportRow[]; missing: ImportField[] } {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], missing: ['first_name', 'last_name'] };
  const map = mapHeaders(header);
  const missing = (['first_name', 'last_name'] as ImportField[]).filter((f) => map[f] === undefined);
  const get = (r: string[], f: ImportField) => (map[f] === undefined ? '' : (r[map[f]!] ?? '').trim());
  const rows = body.map((r, i): ImportRow => {
    const errors: string[] = [];
    const cat = get(r, 'category');
    const category = cat ? categoryWords[fold(cat)] : defaultCategory;
    if (!category) errors.push(`neznámá kategorie „${cat}“`);
    const mob = mobilityWords[fold(get(r, 'mobility'))];
    if (!mob) errors.push(`neznámá pohyblivost „${get(r, 'mobility')}“`);
    const email = get(r, 'email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`neplatný e-mail „${email}“`);
    const lang = fold(get(r, 'language')) || 'cs';
    if (!/^[a-z]{2}$/.test(lang)) errors.push(`jazyk musí být dvoupísmenný kód (cs, en, fr…)`);
    const first = get(r, 'first_name'), last = get(r, 'last_name');
    if (!first || !last) errors.push('chybí jméno nebo příjmení');
    if (first.length > 100 || last.length > 100) errors.push('jméno je příliš dlouhé');
    const n = (s: string) => s || null;
    return {
      line: i + 2,
      values: { first_name: first, last_name: last, title: n(get(r, 'title')), preferred_name: n(get(r, 'preferred_name')),
        category: category ?? defaultCategory, phone: n(get(r, 'phone')), email: n(email), language: lang,
        mobility: mob ?? 'walks', logistics_note: n(get(r, 'logistics_note')) },
      errors,
    };
  });
  return { rows, missing };
}

type Comparable = { first_name: string; last_name: string; phone: string | null; email: string | null };
const digits = (p: string | null) => (p ?? '').replace(/\D/g, '').slice(-9); // last 9 digits: ignores +420 / 00420
const sameName = (a: Comparable, b: Comparable) => fold(a.first_name) === fold(b.first_name) && fold(a.last_name) === fold(b.last_name);
const sameContact = (a: Comparable, b: Comparable) =>
  (!!digits(a.phone) && digits(a.phone).length >= 9 && digits(a.phone) === digits(b.phone)) ||
  (!!a.email && !!b.email && fold(a.email) === fold(b.email));

// Possible duplicates for a new row: same name (accents and case ignored), or same phone (last 9 digits) or e-mail.
export function findDuplicates<T extends Comparable>(row: Comparable, existing: T[]): { match: T; reason: 'name' | 'contact' | 'both' }[] {
  return existing.flatMap((e) => {
    const n = sameName(row, e), c = sameContact(row, e);
    return n || c ? [{ match: e, reason: n && c ? 'both' as const : n ? 'name' as const : 'contact' as const }] : [];
  });
}

// CSV for Excel: BOM + ';' delimiter, every cell quoted when needed.
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const q = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(q).join(';')).join('\r\n') + '\r\n';
}
