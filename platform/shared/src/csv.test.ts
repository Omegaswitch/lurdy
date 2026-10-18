import { describe, expect, it } from 'vitest';
import { findDuplicates, mapHeaders, parseCsv, readRows, toCsv } from './csv';

describe('parseCsv', () => {
  it('reads Czech Excel CSV (BOM, semicolons, quotes, CRLF)', () => {
    const rows = parseCsv('﻿Jméno;Příjmení;Poznámka\r\nAnna;Nováková;"jede s ""dcerou""; potřebuje místo u okna"\r\n\r\nPetr;Dvořák;\r\n');
    expect(rows).toEqual([['Jméno', 'Příjmení', 'Poznámka'], ['Anna', 'Nováková', 'jede s "dcerou"; potřebuje místo u okna'], ['Petr', 'Dvořák', '']]);
  });
  it('detects comma-separated files and quoted newlines', () => {
    expect(parseCsv('first name,last name\n"Mary\nAnn",Smith')).toEqual([['first name', 'last name'], ['Mary\nAnn', 'Smith']]);
  });
});

describe('readRows', () => {
  it('maps Czech headers and words', () => {
    const { rows, missing } = readRows('Příjmení;Jméno;Kategorie;Vozík;Telefon;Jazyk\nNováková;Anna;nemocná;ano;+420 601 000 000;CS\nDvořák;Petr;;;;\n');
    expect(missing).toEqual([]);
    expect(rows[0]!.values).toMatchObject({ first_name: 'Anna', last_name: 'Nováková', category: 'malade', mobility: 'wheelchair', language: 'cs' });
    expect(rows[1]!.values).toMatchObject({ category: 'pilgrim', mobility: 'walks', phone: null });
    expect(rows.every((r) => r.errors.length === 0)).toBe(true);
  });
  it('reports bad rows with their line number and missing columns', () => {
    const { rows } = readRows('Jméno;Příjmení;Kategorie;E-mail\n;Bez;poutník;\nAnna;Nová;kuchař;anna@\n');
    expect(rows[0]!).toMatchObject({ line: 2, errors: ['chybí jméno nebo příjmení'] });
    expect(rows[1]!.errors).toEqual(['neznámá kategorie „kuchař“', 'neplatný e-mail „anna@“']);
    expect(readRows('Name;Telefon\nA;1').missing).toEqual(['first_name', 'last_name']);
  });
  it('maps English headers', () => {
    expect(mapHeaders(['First name', 'Surname', 'E-mail', 'Category'])).toEqual({ first_name: 0, last_name: 1, email: 2, category: 3 });
  });
});

describe('findDuplicates', () => {
  const existing = [
    { id: 1, first_name: 'Anna', last_name: 'Nováková', phone: '+420 601 000 000', email: null },
    { id: 2, first_name: 'Petr', last_name: 'Dvořák', phone: null, email: 'petr@example.test' },
  ];
  it('matches names regardless of accents and case', () => {
    expect(findDuplicates({ first_name: 'anna', last_name: 'NOVAKOVA', phone: null, email: null }, existing).map((d) => [d.match.id, d.reason])).toEqual([[1, 'name']]);
  });
  it('matches phone by last 9 digits and e-mail', () => {
    expect(findDuplicates({ first_name: 'Jana', last_name: 'Jiná', phone: '00420601000000', email: null }, existing)[0]).toMatchObject({ reason: 'contact' });
    expect(findDuplicates({ first_name: 'P.', last_name: 'D.', phone: null, email: 'PETR@example.test' }, existing)[0]!.match.id).toBe(2);
    expect(findDuplicates({ first_name: 'Anna', last_name: 'Nováková', phone: '601000000', email: null }, existing)[0]!.reason).toBe('both');
  });
  it('does not match on short or missing phone numbers', () => {
    expect(findDuplicates({ first_name: 'X', last_name: 'Y', phone: '000', email: null }, [{ first_name: 'Z', last_name: 'W', phone: '000', email: null }])).toEqual([]);
  });
});

describe('toCsv', () => {
  it('writes Excel-friendly CSV that parses back', () => {
    const csv = toCsv(['Jméno', 'Poznámka'], [['Anna', 'a; "b"'], ['Petr', null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(parseCsv(csv)).toEqual([['Jméno', 'Poznámka'], ['Anna', 'a; "b"'], ['Petr', '']]);
  });
});
