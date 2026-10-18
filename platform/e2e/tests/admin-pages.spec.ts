// Every admin screen beyond the core loop: edition & event codes, accommodation, care, programme, contacts and
// announcements. Each step checks the effect where it matters (database rules, the participant's own view)
// and runs axe. Everything created here is removed again.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminLogin, codeClient, DEV, removeMfa } from './helpers';

test.describe.configure({ mode: 'serial' });
let page: Page;
let secret = '';
const tag = Date.now().toString(36);
const malade = `Nemocná${tag}`;
const PILGRIM = process.env.E2E_PILGRIM_CODE ?? '3672';

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
  if (secret) await removeMfa(secret);
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
  const pilgrim = await codeClient(PILGRIM);
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
  const pilgrim = await codeClient(PILGRIM);
  const mine = (await pilgrim.rpc('my_pilgrimage')).data as { contacts: { label: string }[]; announcements: { title: string; critical: boolean }[] };
  expect(mine.contacts.map((c) => c.label)).toContain(`Testovací kontakt ${tag}`);
  expect(mine.announcements.find((a) => a.title === `Testovací oznámení ${tag}`)?.critical).toBe(true);
  await page.getByRole('row').filter({ hasText: `Testovací kontakt ${tag}` }).getByRole('button', { name: 'Smazat' }).click();
  await page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` }).getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByRole('row').filter({ hasText: `Testovací oznámení ${tag}` })).toHaveCount(0);
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
