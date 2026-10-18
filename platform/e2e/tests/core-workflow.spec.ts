// The core operational loop, on real infrastructure (dev project, fictional data):
// create participant → assign Bus A → print badge → scan → move to Bus C → same badge scans as Bus C
// → the participant's own view shows Bus C. Also: the scan latency is measured.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminLogin, codeClient, DEV, removeMfa } from './helpers';

test.describe.configure({ mode: 'serial' });

let page: Page;
let mfaSecret = '';
const surname = `Testovací${Date.now().toString(36)}`;
let qrPayload = '';
let accessCode = '';

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.addInitScript(() => { window.print = () => {}; });
});

test.afterAll(async () => {
  await page.close();
  if (mfaSecret) await removeMfa(mfaSecret);
});

const leg = (code: string) => page.locator('.timetable button').filter({ has: page.locator('.code', { hasText: new RegExp(`^${code}$`) }) });

test('organiser signs in with code + event code, then enrols MFA', async () => {
  mfaSecret = await adminLogin(page);
  expect(mfaSecret).toMatch(/^[A-Z2-7]{16,}$/);
});

test('the admin overview passes an automated accessibility check', async () => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " — " + n.failureSummary).join(" | ")}`)).toEqual([]);
});

test('create a participant', async () => {
  await page.getByRole('link', { name: 'Účastníci' }).click();
  await page.getByRole('button', { name: 'Nový účastník' }).click();
  await page.getByLabel('Jméno', { exact: true }).fill('Eliška');
  await page.getByLabel('Příjmení').fill(surname);
  await page.getByLabel('Kategorie', { exact: true }).selectOption('pilgrim');
  await page.getByRole('button', { name: 'Uložit' }).click();
  const panel = page.getByRole('complementary');
  await expect(panel.getByRole('heading', { name: `Eliška ${surname}` })).toBeVisible();
  accessCode = (await panel.locator('.mono').first().textContent())!.trim();
  expect(accessCode).toMatch(/^\d{4}$/);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " — " + n.failureSummary).join(" | ")}`)).toEqual([]);
});

test('assign to Bus A', async () => {
  await page.getByRole('link', { name: 'Doprava' }).click();
  await leg('A').click();
  await page.getByLabel('Přidat cestujícího').fill(surname);
  await page.getByRole('listitem').filter({ hasText: surname }).getByRole('button', { name: 'Přidat' }).click();
  await expect(page.getByRole('row').filter({ hasText: surname })).toBeVisible();
});

test('print the badge (QR holds an opaque token only)', async () => {
  await page.getByRole('link', { name: 'Jmenovky' }).click();
  await page.getByRole('row').filter({ hasText: surname }).click();
  const issued = page.waitForResponse((r) => r.url().includes('/rpc/issue_credential'));
  await page.getByRole('button', { name: 'Vytisknout jmenovky' }).click();
  qrPayload = (await (await issued).json()) as string;
  expect(qrPayload).toMatch(/^LRD1\.[0-9A-F]{32}$/);
  await expect(page.locator('.sheet .badge').filter({ hasText: surname })).toBeVisible();
  // the printout carries the edition and a timestamp; the badge shows BUS A and no category
  await expect(page.locator('.print-meta').first()).toContainText('Vytištěno');
  await expect(page.locator('.print-meta').first()).toContainText('Vývojový ročník');
  await expect(page.locator('.badge').filter({ hasText: surname })).toContainText('BUS A');
});

test('scan → Bus A; move to Bus C; same badge scans as Bus C; participant view shows Bus C', async () => {
  const staff = await codeClient(DEV.staff, DEV.event);
  const timings: number[] = [];
  const scan = async () => {
    const t0 = performance.now();
    const { data, error } = await staff.rpc('scan_badge', { p_payload: qrPayload });
    timings.push(performance.now() - t0);
    expect(error).toBeNull();
    return data as { result: string; participant: { last_name: string; legs: { code: string; kind: string }[] } };
  };
  const first = await scan();
  expect(first.result).toBe('ok');
  expect(first.participant.last_name).toBe(surname);
  expect(first.participant.legs.map((l) => l.code)).toContain('A');

  // move in the admin UI
  await page.getByRole('link', { name: 'Doprava' }).click();
  await leg('A').click();
  const row = page.getByRole('row').filter({ hasText: surname });
  await row.getByRole('combobox').selectOption({ label: 'Autobus C' });
  await expect(page.getByRole('status')).toContainText('přesunut');

  const second = await scan();
  expect(second.participant.legs.map((l) => l.code)).toContain('C');
  expect(second.participant.legs.map((l) => l.code)).not.toContain('A');

  for (let i = 0; i < 8; i++) await scan();
  timings.sort((a, b) => a - b);
  const p50 = timings[Math.floor(timings.length / 2)]!;
  const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;
  console.log(`scan RPC round trip from CI: p50 ${p50.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms (n=${timings.length})`);
  expect(p95).toBeLessThan(2000);

  // the participant signs in with their code and sees Bus C
  const me = await codeClient(accessCode);
  const { data: mine } = await me.rpc('my_pilgrimage');
  expect((mine as { legs: { code: string }[] }).legs.map((l) => l.code)).toEqual(['C']);
});

test('clean up', async () => {
  // delete the test participant in the UI (also exercises the delete path)
  await page.getByRole('link', { name: 'Účastníci' }).click();
  await page.getByLabel('Hledat').fill(surname);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: new RegExp(surname) }).click();
  await page.getByRole('button', { name: 'Smazat' }).click();
  await expect(page.getByText('Nikdo neodpovídá hledání.')).toBeVisible();
});
