// Every admin screen beyond the core loop: edition & event codes, accommodation, care, programme, contacts and
// announcements. Each step checks the effect where it matters (database rules, the participant's own view)
// and runs axe. Everything created here is removed again.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { readSheet } from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { adminLogin, codeClient, DEV, organiserClient } from './helpers';

test.describe.configure({ mode: 'serial' });
let page: Page;
let secret = '';
const tag = Date.now().toString(36);
const malade = `Nemocná${tag}`;
const PILGRIM = DEV.pilgrim;

const a11y = async () => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
};
const go = async (name: string) => {
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  page.on('dialog', (d) => d.accept());
  secret = await adminLogin(page);
});
test.afterAll(async () => {
  await page.close();
  if (!secret) return;
  // Whatever happened above: remove test participants and empty test rooms (also from earlier interrupted runs).
  const org = await organiserClient(secret);
  await org.from('participants').delete().like('last_name', 'Nemocná%').eq('first_name', 'Test');
  await org.from('rooms').delete().like('number', 'T%').eq('capacity', 0);
  await org.from('transport_legs').delete().like('code', 'T%').like('destination', 'Testovací cíl%');
  await org.from('participants').delete().like('last_name', 'Importovaný%');
  await org.from('archive_people').delete().like('last_name', 'Archivní%');
});

test('edition: add an event code, then end it', async () => {
  await go('Ročník');
  const code = await page.getByLabel('Nový kód', { exact: true }).inputValue();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await page.getByLabel('Popis', { exact: true }).fill(`test ${tag}`);
  await page.getByRole('button', { name: 'Přidat kód' }).click();
  const row = page.getByRole('row').filter({ hasText: code });
  await expect(row).toContainText('platí');
  await a11y();
  await row.getByRole('button', { name: 'Ukončit' }).click();
  await expect(row).toContainText('neplatí');
});

test('transport: create a leg, edit it, delete it', async () => {
  await go('Doprava');
  await page.getByRole('button', { name: 'Nový spoj' }).click();
  const form = page.getByRole('form', { name: 'Nový spoj' });
  await form.getByLabel('Označení').fill(`T${tag}`.slice(0, 8));
  await form.getByLabel('Kam').fill('Testovací cíl');
  await form.getByLabel('Míst').fill('3');
  await form.getByRole('button', { name: 'Uložit' }).click();
  const detail = page.getByRole('region', { name: `Spoj T${tag}`.slice(0, 13) });
  await expect(detail).toContainText('Testovací cíl');
  await detail.getByRole('button', { name: 'Upravit' }).click();
  const edit = page.getByRole('form', { name: /^Upravit spoj/ });
  await edit.getByLabel('Kam').fill('Testovací cíl (změněn)');
  await edit.getByLabel('Míst').fill('4');
  await edit.getByRole('button', { name: 'Uložit' }).click();
  await expect(detail).toContainText('Testovací cíl (změněn)');
  await expect(detail).toContainText('0 / 4');
  await a11y();
  await detail.getByRole('button', { name: 'Smazat spoj' }).click(); // the confirm dialog is auto-accepted
  await expect(detail).toHaveCount(0);
  await expect(page.locator('.timetable .code', { hasText: `T${tag}`.slice(0, 8) })).toHaveCount(0);
});

test('accommodation: create a room, house a new participant, room capacity enforced', async () => {
  // a fresh malade to house and care for
  await go('Účastníci');
  await page.getByRole('button', { name: 'Nový účastník' }).click();
  await page.getByLabel('Jméno', { exact: true }).fill('Test');
  await page.getByLabel('Příjmení').fill(malade);
  await page.getByLabel('Kategorie', { exact: true }).selectOption('malade');
  await page.getByRole('button', { name: 'Uložit' }).click();
  await expect(page.getByRole('complementary').getByRole('heading', { name: `Test ${malade}` })).toBeVisible();

  await go('Ubytování');
  await page.locator('.timetable h3').filter({ hasText: 'HOTEL' }).getByRole('button', { name: /pokoj/ }).click();
  await page.getByLabel('Číslo', { exact: true }).fill(`T${tag}`.slice(0, 10));
  await page.getByLabel('Lůžek', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Uložit' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`pokoj T${tag}`.slice(0, 16)) })).toBeVisible();
  // editing the room goes through the same form with optimistic locking
  await page.getByRole('button', { name: 'Upravit pokoj' }).click();
  await page.getByRole('form', { name: /^Upravit pokoj/ }).getByLabel('Patro').fill('3');
  await page.getByRole('form', { name: /^Upravit pokoj/ }).getByRole('button', { name: 'Uložit' }).click();
  await expect(page.getByRole('region', { name: /^Pokoj T/ })).toContainText('3. patro');
  await page.getByLabel('Ubytovat').fill(malade);
  await page.getByRole('listitem').filter({ hasText: malade }).getByRole('button', { name: 'Přidat' }).click();
  await expect(page.getByRole('alert')).toContainText('je plný'); // 0 beds: the database refuses
  await a11y();
});

test('care: assign a primary carer, gap disappears, then remove', async () => {
  await go('Péče');
  const row = page.getByRole('row').filter({ hasText: malade });
  await expect(row).toContainText('Chybí hlavní asistent');
  await row.getByRole('combobox').first().selectOption({ label: 'Asistentní Alena (pečuje o 1)' });
  await row.getByRole('button', { name: 'Přidat' }).click();
  await expect(row).toContainText('Alena Asistentní');
  await expect(row).not.toContainText('Chybí hlavní asistent');
  await a11y();
  await row.getByRole('button', { name: /Odebrat Alena/ }).click();
  await expect(row).toContainText('Chybí hlavní asistent');
});

test('programme: add an item for pilgrims; the pilgrim sees it; an edit marks it changed', async () => {
  await go('Program');
  await page.getByRole('button', { name: 'Nový bod programu' }).click();
  await page.getByLabel('Název', { exact: true }).fill(`Testovací bod ${tag}`);
  await page.getByLabel('Místo na mapě').selectOption({ label: 'Jeskyně Massabielle' });
  await page.getByRole('button', { name: 'Poutníci', exact: true }).click();
  await page.getByRole('button', { name: 'Uložit' }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací bod ${tag}` })).toBeVisible();
  const pilgrim = await codeClient(PILGRIM, DEV.pilgrimSecret);
  const find = async () => ((await pilgrim.rpc('my_pilgrimage')).data as { events: { title: string; changed: boolean; place_id: string | null }[] })
    .events.find((e) => e.title.startsWith(`Testovací bod ${tag}`));
  expect((await find())?.place_id).toBeTruthy();
  expect((await find())?.changed).toBe(false);
  await page.getByRole('row').filter({ hasText: `Testovací bod ${tag}` }).click();
  await page.getByLabel('Název', { exact: true }).fill(`Testovací bod ${tag} (posunuto)`);
  await page.getByRole('button', { name: 'Uložit' }).click();
  await expect.poll(async () => (await find())?.changed).toBe(true);
  await a11y();
  await page.getByRole('row').filter({ hasText: `Testovací bod ${tag}` }).click();
  await page.getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací bod ${tag}` })).toHaveCount(0);
});

test('contacts and announcements reach the pilgrim', async () => {
  await go('Kontakty a oznámení');
  await page.getByLabel('Kdo (funkce)').fill(`Testovací kontakt ${tag}`);
  await page.getByLabel('Telefon', { exact: true }).fill('+420 000 000 099');
  await page.getByRole('button', { name: 'Přidat kontakt' }).click();
  await page.getByLabel('Nadpis', { exact: true }).fill(`Testovací oznámení ${tag}`);
  await page.getByLabel('Důležité – vyžádat potvrzení „Přečetl(a) jsem“').check();
  await page.getByRole('button', { name: 'Zveřejnit', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` })).toContainText('zveřejněno');
  await a11y();
  const pilgrim = await codeClient(PILGRIM, DEV.pilgrimSecret);
  const mine = (await pilgrim.rpc('my_pilgrimage')).data as { contacts: { label: string }[]; announcements: { title: string; critical: boolean }[] };
  expect(mine.contacts.map((c) => c.label)).toContain(`Testovací kontakt ${tag}`);
  expect(mine.announcements.find((a) => a.title === `Testovací oznámení ${tag}`)?.critical).toBe(true);
  // a contact is edited in place; a published announcement can be taken back (stays as a draft)
  await page.getByRole('row').filter({ hasText: `Testovací kontakt ${tag}` }).getByRole('button', { name: 'Upravit' }).click();
  await page.getByRole('form', { name: /^Upravit kontakt/ }).getByLabel('Jméno', { exact: true }).fill('Testovací Osoba');
  await page.getByRole('form', { name: /^Upravit kontakt/ }).getByRole('button', { name: 'Uložit' }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací kontakt ${tag}` })).toContainText('Testovací Osoba');
  await page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` }).getByRole('button', { name: 'Stáhnout' }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` })).not.toContainText('zveřejněno');
  await expect.poll(async () => ((await pilgrim.rpc('my_pilgrimage')).data as typeof mine).announcements.some((a) => a.title === `Testovací oznámení ${tag}`)).toBe(false);
  await page.getByRole('row').filter({ hasText: `Testovací kontakt ${tag}` }).getByRole('button', { name: 'Smazat' }).click();
  await page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` }).getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` })).toHaveCount(0);
});

test('reports print with edition stamp; manifests one leg per page', async () => {
  await go('Tisk');
  const reports = ['Seznam účastníků (abecedně)', 'Seznam podle kategorií', 'Manifesty spojů (autobusy, lety)', 'Rozdělení pokojů',
    'Péče – nemocní a asistenti', 'Program', 'Kontakty'];
  for (const r of reports) {
    await page.getByLabel('Sestava').selectOption({ label: r });
    await expect(page.getByRole('article', { name: r })).toContainText('vytištěno');
  }
  await a11y();
  await page.getByLabel('Sestava').selectOption({ label: 'Manifesty spojů (autobusy, lety)' });
  const article = page.getByRole('article');
  await expect(article).toContainText('Autobus C');
  await expect(article).toContainText('Vzorová');
  for (const word of ['diagnó', 'alergi', 'lék ']) await expect(article).not.toContainText(word);
  const legs = await page.locator('.report-section').count();
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pages).toBe(legs); // one page per leg in the dev data (all fit on one page)
  if (process.env.SHOTS) writeFileSync(`${process.env.SHOTS}/manifests.pdf`, pdf);
});

test('reports download as CSV', async () => {
  await page.getByLabel('Sestava').selectOption({ label: 'Manifesty spojů (autobusy, lety)' });
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stáhnout CSV' }).click()]);
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const csv = readFileSync((await file.path())!, 'utf8');
  expect(csv).toContain('Vzorová');
  for (const word of ['diagnó', 'alergi']) expect(csv.toLowerCase()).not.toContain(word);
});

test('archive: upload a list (health column skipped), duplicates skipped, export, delete', async () => {
  const last = `Archivní${tag}`;
  const csv = `Příjmení,Jméno,Datum narození,E-mail,Diagnóza\n${last},Anna,3.4.1950,anna@example.test,fiktivní\n${last},Karel,,,\n`;
  const upload = async () => {
    await page.getByRole('button', { name: 'Nahrát seznam (CSV, Excel)' }).click();
    await page.getByRole('combobox', { name: 'Seznam' }).selectOption({ label: 'Nemocní' });
    await page.getByLabel('Rok pouti').fill('2019');
    await page.getByLabel('Soubor').setInputFiles({ name: 'archiv.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  };
  await go('Archiv');
  await a11y();
  await upload();
  await expect(page.getByText('Sloupce se zdravotními údaji se do archivu nečtou a neukládají: Diagnóza.')).toBeVisible();
  await page.getByRole('button', { name: 'Přidat do archivu (2)' }).click();
  await expect(page.getByText('Do archivu přidáno 2 osob.')).toBeVisible();
  await upload(); // the same file again: everyone is already archived
  await expect(page.getByRole('button', { name: 'Přidat do archivu (0)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Zavřít' }).click();
  await page.getByLabel('Hledat').fill(last);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportovat CSV' }).click()]);
  const out = readFileSync((await file.path())!, 'utf8');
  expect(out).toContain('anna@example.test');
  expect(out).not.toContain('fiktivní');
  for (const name of ['Anna', 'Karel']) await page.getByRole('button', { name: `Smazat ${last} ${name} (2019)` }).click();
  await expect(page.getByRole('button', { name: new RegExp(`Smazat ${last}`) })).toHaveCount(0);
});

test('CSV import flags exactly the planted duplicates and errors; export contains the result', async () => {
  // 150 fictional people + 1 broken row; 5 planted duplicates: 3 of existing dev people, 2 within the file.
  const lines = ['Příjmení;Jméno;Kategorie;Telefon;Vozík'];
  for (let i = 1; i <= 145; i++) lines.push(`Importovaný${i};Test;${i % 7 === 0 ? 'nemocný' : 'poutník'};;${i % 11 === 0 ? 'ano' : ''}`);
  lines.push('Poutnický;Petr;poutník;;', 'VZOROVÁ;marie;nemocná;;', 'Někdo;Jiný;poutník;+420 000 000 002;'); // existing: 2 by name, 1 by phone
  lines.push('Importovaný7;Test;nemocný;;', 'Importovaný8;Test;poutník;;'); // repeated within the file
  lines.push('Chybný;Řádek;kuchař;;'); // unknown category
  await go('Účastníci');
  await page.getByRole('button', { name: 'Hromadný import (Excel, CSV)' }).click();
  await page.getByLabel('Soubor', { exact: true }).setInputFiles({ name: 'prihlasky.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf8') });
  await expect(page.getByRole('status').filter({ hasText: 'řádků' })).toHaveText(/151 řádků · 145 nových · 5 možná již existuje · 1 s chybou/);
  await a11y();
  await page.getByRole('button', { name: 'Importovat 145 osob' }).click();
  await expect(page.getByText('Importováno 145 osob.')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Hledat').fill('Importovaný145');
  const row = page.getByRole('row').filter({ hasText: 'Importovaný145' });
  await expect(row).toHaveCount(1);
  await expect(row).not.toContainText(/\b\d{4}\b/); // the list never shows sign-in codes
  await row.getByRole('button').first().click();
  const panel = page.getByRole('complementary');
  await expect(panel.locator('.mono').first()).toHaveText(/^\d{4}$/); // the editor fetches the one code on request
  const code = (await panel.locator('.mono').first().textContent())!.trim();
  await panel.getByRole('button', { name: 'Zavřít' }).click();
  await page.getByLabel('Hledat').fill(code); // searching by code goes through the database
  await expect(page.getByRole('row').filter({ hasText: 'Importovaný145' })).toHaveCount(1);
  await page.getByLabel('Hledat').fill('');
  // export: without codes by default, with codes only on request
  await page.getByRole('button', { name: 'Exportovat CSV' }).click();
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout CSV' }).click();
  const read = async (d: Promise<import('@playwright/test').Download>) => Buffer.concat((await (await (await d).createReadStream()).toArray()) as Buffer[]).toString('utf8');
  let text = await read(download);
  expect(text.startsWith('\uFEFFPříjmení;Jméno')).toBe(true);
  expect(text.split('\r\n')[0]).not.toContain('Kód z pozvánky');
  expect(text).toContain('Importovaný145;Test');
  expect(text.split('\r\n').filter((l) => l.startsWith('Importovaný')).length).toBe(145);
  await page.getByRole('button', { name: 'Exportovat CSV' }).click();
  await page.getByLabel('Včetně přihlašovacích kódů').check();
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stáhnout CSV' }).click();
  text = await read(download);
  expect(text.split('\r\n')[0]).toContain(';Číslo;Kód z pozvánky;Odkaz pozvánky;');
  expect(text).toMatch(new RegExp(`Importovaný145;Test;[^\\r\\n]*;${code};`));
});

test('Excel template, AI prompt for an unknown layout, .xlsx preview (nothing imported)', async () => {
  await go('Účastníci');
  await page.getByRole('button', { name: 'Hromadný import (Excel, CSV)' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Šablona (Excel)' }).click();
  const template = await readSheet(readFileSync(await (await download).path()));
  expect(template[0]).toEqual(['Příjmení', 'Jméno', 'Titul', 'Oslovení', 'Kategorie', 'Telefon', 'E-mail', 'Jazyk', 'Pohyblivost', 'Poznámka']);

  // a sheet in someone's own layout: not readable, so the AI instructions open, quoting its headers
  const own = await writeXlsxFile([[{ value: 'Celé jméno' }, { value: 'Autobus' }], [{ value: 'Ing. Jan Fiktivní' }, { value: 'A' }]]).toBuffer();
  await page.getByLabel('Soubor', { exact: true }).setInputFiles({ name: 'vlastni.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: own });
  await expect(page.getByText('V souboru chybí sloupce Jméno a Příjmení')).toBeVisible();
  const prompt = page.getByLabel(/Zkopírujte tento text/);
  await expect(prompt).toHaveValue(/Celé jméno \| Autobus/);
  await expect(prompt).toHaveValue(/Zdravotní údaje/);
  await a11y();

  // the template filled in: two people, numbers as numbers
  const filled = await writeXlsxFile([template[0]!.map((h) => ({ value: String(h) })),
    [{ value: 'Fiktivní' }, { value: 'Jan' }, null, null, { value: 'poutník' }, { value: 420601000999 }, null, null, { value: 'vozík' }, null],
    [{ value: 'Smyšlená' }, { value: 'Eva' }, null, null, { value: 'asistent' }, null, null, { value: 'en' }, null, null]]).toBuffer();
  await page.getByLabel('Soubor', { exact: true }).setInputFiles({ name: 'sablona.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: filled });
  await expect(page.getByRole('status').filter({ hasText: 'řádků' })).toHaveText(/2 řádků · 2 nových · 0 možná již existuje · 0 s chybou/);
  await expect(page.getByRole('button', { name: 'Importovat 2 osoby' })).toBeEnabled();
  await page.getByRole('button', { name: 'Zrušit' }).click();
});

test('clean up the test participant and room', async () => {
  await go('Ubytování');
  await page.locator('.timetable button').filter({ hasText: `T${tag}`.slice(0, 10) }).click();
  await page.getByRole('button', { name: 'Smazat pokoj' }).click();
  await expect(page.locator('.timetable button').filter({ hasText: `T${tag}`.slice(0, 10) })).toHaveCount(0);
  await go('Účastníci');
  await page.getByLabel('Hledat').fill(malade);
  await page.getByRole('button', { name: new RegExp(malade) }).click();
  await page.getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByText('Nikdo neodpovídá hledání.')).toBeVisible();
});
