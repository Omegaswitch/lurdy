import { describe, expect, it } from 'vitest';
import { archiveKey, readArchive, readBirthDate } from './archive';
import { parseCsv } from './csv';

describe('archive import', () => {
  it('reads a Czech list with the year in a column', () => {
    const r = readArchive(parseCsv('Rok;Příjmení;Jméno;Datum narození;E-mail\n2019;Vzorová;Marie;3. 4. 1950;marie@example.invalid\n'), 'malade', null);
    expect(r.missing).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.errors).toEqual([]);
    expect(r.rows[0]!.values).toMatchObject({ list: 'malade', year: 2019, last_name: 'Vzorová', first_name: 'Marie', birth_date: '1950-04-03', email: 'marie@example.invalid' });
  });

  it('reads French headers and takes the year chosen at upload when the file has none', () => {
    const r = readArchive(parseCsv('Nom,Prénom,Paroisse,Liste\nDupont,Jean,Brno,équipe\nNovák,Petr,,pèlerin\n'), 'pilgrim', 2018);
    expect(r.rows.map((x) => [x.values.list, x.values.year, x.values.parish])).toEqual([['team', 2018, 'Brno'], ['pilgrim', 2018, null]]);
  });

  it('never reads health columns, and says so', () => {
    const r = readArchive(parseCsv('Příjmení;Jméno;Diagnóza;Léky;Alergie;Barva bundy\nVzorová;Marie;x;y;z;modrá\n'), 'malade', 2020);
    expect(r.health).toEqual(['Diagnóza', 'Léky', 'Alergie']);
    expect(r.ignored).toEqual(['Barva bundy']);
    expect(JSON.stringify(r.rows[0]!.values)).not.toMatch(/"x"|"y"|"z"/);
  });

  it('asks for the year when neither the file nor the upload gives one', () => {
    expect(readArchive(parseCsv('Příjmení;Jméno\nA;B\n'), 'pilgrim', null).missing).toEqual(['year']);
  });

  it('reports bad rows instead of guessing', () => {
    const r = readArchive(parseCsv('Rok;Příjmení;Jméno;Datum narození;Seznam\n19;A;B;12/31/1950;turista\n'), 'pilgrim', null);
    expect(r.rows[0]!.errors).toHaveLength(3);
  });

  it('parses only day-first or ISO birth dates', () => {
    expect(readBirthDate('31.12.1950')).toBe('1950-12-31');
    expect(readBirthDate('1950-12-31')).toBe('1950-12-31');
    expect(readBirthDate('31.02.1950')).toBe('invalid');
    expect(readBirthDate('')).toBeNull();
  });

  it('treats the same person in the same list and year as one, whatever the accents', () => {
    const a = { list: 'pilgrim' as const, year: 2019, last_name: 'Novák', first_name: 'Petr', birth_date: null };
    expect(archiveKey(a)).toBe(archiveKey({ ...a, last_name: 'NOVAK' }));
    expect(archiveKey(a)).not.toBe(archiveKey({ ...a, year: 2020 }));
  });
});
