// The core operational loop, on real infrastructure (dev project, fictional data):
// create participant → assign Bus A → print badge (pending) → scan says not active → activate → scan → move to Bus C → same badge scans as Bus C
// → the participant's own view shows Bus C. Also: the scan latency is measured.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminLogin, codeClient, DEV, organiserClient } from './helpers';

test.describe.configure({ mode: 'serial' });

let page: Page;
let mfaSecret = '';
const surname = `Testovací${Date.now().toString(36)}`;
let qrPayload = '';
let accessCode = '';
let inviteCode = '';

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await page.addInitScript(() => { window.print = () => {}; });
});

test.afterAll(async () => {
  await page.close();
  // whatever happened above, remove this test's participants (also leftovers of interrupted runs)
  if (mfaSecret) await (await organiserClient(mfaSecret)).from('participants').delete().like('last_name', 'Testovací%').eq('first_name', 'Eliška');
});

const leg = (code: string) => page.locator('.timetable button').filter({ has: page.locator('.code', { hasText: new RegExp(`^${code}$`) }) });

test('organiser signs in with e-mail, password and authenticator (sets them up the first time)', async () => {
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
  await expect(panel.locator('.mono').first()).toHaveText(/^\d{4}$/); // fetched on request, never part of the list
  accessCode = (await panel.locator('.mono').first().textContent())!.trim();
  await expect(panel.getByTestId('invite-code')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  inviteCode = (await panel.getByTestId('invite-code').textContent())!.trim();
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
  const issued = page.waitForResponse((r) => r.url().includes('/rpc/issue_pending_credential'));
  await page.getByRole('button', { name: 'Vytisknout jmenovky' }).click();
  qrPayload = (await (await issued).json()) as string;
  expect(qrPayload).toMatch(/^LRD1\.[0-9A-F]{32}$/);
  await expect(page.locator('.sheet .badge').filter({ hasText: surname })).toBeVisible();
  // the print is a pending batch until the organiser confirms it came out of the printer
  await expect(page.getByTestId('pending-batch').filter({ hasText: surname })).toBeVisible();
  // the printout carries the edition and a timestamp; the badge shows the bus and the attendee type, both large
  await expect(page.locator('.print-meta').first()).toContainText('Vytištěno');
  await expect(page.locator('.print-meta').first()).toContainText('Vývojový ročník');
  const badge = page.locator('.badge').filter({ hasText: surname });
  await expect(badge.locator('.bus')).toHaveText(/^BUS\s*A$/);
  await expect(badge.locator('.cat')).toHaveText(/poutník/i);
});

test('scan → Bus A; move to Bus C; same badge scans as Bus C; participant app updates live', async ({ browser }) => {
  const APP = 'http://localhost:8081';
  // The participant opens the app with their own 4-digit code.
  const pilgrim = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  await pilgrim.goto(APP);
  await pilgrim.getByTestId('code').fill(accessCode);
  await pilgrim.getByTestId('invite').fill(inviteCode);
  await pilgrim.getByTestId('submit').click();
  await expect(pilgrim.getByText('Dobrý den, Eliška')).toBeVisible({ timeout: 20_000 });
  await pilgrim.getByTestId('go-journey').click();
  await expect(pilgrim.getByText('Autobus A')).toBeVisible();

  // A team member opens the scanner with code + event code and checks the printed badge.
  const staffPage = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  await staffPage.goto(APP);
  await staffPage.getByTestId('code').fill(DEV.staff);
  await staffPage.getByTestId('invite').fill(DEV.staffSecret);
  await staffPage.getByRole('switch', { name: 'Jsem člen týmu' }).click();
  await staffPage.getByTestId('eventCode').fill(DEV.event);
  await staffPage.getByTestId('submit').click();
  await staffPage.getByTestId('go-scan').click({ timeout: 20_000 });
  const scanInApp = async () => {
    await staffPage.getByTestId('payload').fill(qrPayload);
    await staffPage.getByTestId('submit-payload').click();
    await expect(staffPage.getByTestId('scan-name')).toContainText(surname);
  };
  // Before the organiser confirms the print, the badge is known but not yet valid.
  await staffPage.getByTestId('payload').fill(qrPayload);
  await staffPage.getByTestId('submit-payload').click();
  await expect(staffPage.getByText('Jmenovka ještě není aktivní')).toBeVisible();
  await staffPage.getByTestId('scan-next').click();

  // The organiser confirms the print; from now on the badge scans.
  await page.getByRole('link', { name: 'Jmenovky' }).click();
  const activated = page.waitForResponse((r) => r.url().includes('/rpc/activate_batch'));
  await page.getByTestId('pending-batch').filter({ hasText: surname }).getByRole('button', { name: 'Aktivovat – vytištěno v pořádku' }).click();
  expect(await (await activated).json()).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('pending-batch').filter({ hasText: surname })).toHaveCount(0);

  await scanInApp();
  await expect(staffPage.getByTestId('scan-leg').filter({ hasText: 'Autobus' })).toHaveText(/Autobus A/);

  // The organiser moves the participant to Bus C in the admin.
  await page.getByRole('link', { name: 'Doprava' }).click();
  await leg('A').click();
  const row = page.getByRole('row').filter({ hasText: surname });
  await row.getByRole('button', { name: /Přesunout do/ }).click(); // the leg choice opens per row
  await row.getByRole('combobox').selectOption({ label: 'Autobus C' });
  await expect(page.getByRole('status')).toContainText('přesunut');

  // The participant's open app shows Bus C without any reload (Realtime) …
  await expect(pilgrim.getByText('Autobus C')).toBeVisible({ timeout: 15_000 });
  await expect(pilgrim.getByText('Autobus A')).toHaveCount(0);
  // … and scanning the same printed badge now shows Bus C.
  await staffPage.getByTestId('scan-next').click();
  await scanInApp();
  await expect(staffPage.getByTestId('scan-leg').filter({ hasText: 'Autobus' })).toHaveText(/Autobus C/);

  // Scan latency measured on the API the scanner uses.
  const staff = await codeClient(DEV.staff, DEV.staffSecret, DEV.event);
  const timings: number[] = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    const { data, error } = await staff.rpc('scan_badge', { p_payload: qrPayload });
    timings.push(performance.now() - t0);
    expect(error).toBeNull();
    expect((data as { participant: { legs: { code: string }[] } }).participant.legs.map((l) => l.code)).toContain('C');
  }
  timings.sort((a, b) => a - b);
  const p50 = timings[Math.floor(timings.length / 2)]!;
  const p95 = timings[Math.ceil(timings.length * 0.95) - 1]!;
  console.log(`scan RPC round trip from CI: p50 ${p50.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms (n=${timings.length})`);
  expect(p95).toBeLessThan(2000);
  await pilgrim.context().close();
  await staffPage.context().close();
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
