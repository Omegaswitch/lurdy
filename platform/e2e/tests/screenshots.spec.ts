// Visual review captures (SHOTS=dir npx playwright test screenshots). Skipped in normal runs.
import { test } from '@playwright/test';
import { adminLogin, removeMfa } from './helpers';

test.skip(!process.env.SHOTS, 'set SHOTS=<dir> to capture');

test('admin screens', async ({ browser }) => {
  const dir = process.env.SHOTS!;
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage();
  await page.addInitScript(() => { window.print = () => {}; });
  await page.goto('/');
  await page.screenshot({ path: `${dir}/admin-login.png` });
  const secret = await adminLogin(page);
  try {
    await capture(page, dir);
  } finally {
    await removeMfa(secret);
  }
});

async function capture(page: import('@playwright/test').Page, dir: string) {
  await page.screenshot({ path: `${dir}/admin-overview.png`, fullPage: true });
  await page.getByRole('link', { name: 'Účastníci' }).click();
  await page.getByRole('row').nth(2).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/admin-participants.png`, fullPage: true });
  await page.getByRole('link', { name: 'Doprava' }).click();
  await page.locator('.timetable button').nth(2).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/admin-transport.png`, fullPage: true });
  await page.getByRole('link', { name: 'Jmenovky' }).click();
  await page.getByRole('combobox').first().selectOption('all');
  await page.locator('tbody tr').first().waitFor();
  await page.getByRole('button', { name: /Vybrat vše/ }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Vytisknout jmenovky' }).click();
  await page.locator('.sheet').first().waitFor();
  await page.waitForTimeout(500);
  await page.locator('.sheet').first().screenshot({ path: `${dir}/admin-badges-sheet.png` });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${dir}/badges.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
}

test('app screens', async ({ browser }) => {
  const dir = process.env.SHOTS!;
  const APP = 'http://localhost:8081';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 43.0981, longitude: -0.0535 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  await p.goto(APP);
  await p.getByTestId('code').waitFor();
  await p.screenshot({ path: `${dir}/app-login.png` });
  await p.getByTestId('code').fill(process.env.E2E_PILGRIM_CODE ?? '3672');
  await p.getByTestId('submit').click();
  await p.getByText(/Dobrý den/).waitFor({ timeout: 20_000 });
  await p.screenshot({ path: `${dir}/app-home.png`, fullPage: true });
  await p.getByTestId('go-journey').click();
  await p.getByText('Cesta tam').first().waitFor();
  await p.screenshot({ path: `${dir}/app-journey.png`, fullPage: true });
  await p.goBack();
  await p.getByRole('button', { name: 'Program' }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${dir}/app-programme.png`, fullPage: true });
  await p.goBack();
  await p.getByRole('button', { name: 'Mapa Lurd' }).click();
  await p.locator('.pin').first().waitFor({ state: 'attached', timeout: 15_000 });
  await p.getByRole('button', { name: /Jeskyně Massabielle/ }).last().click();
  await p.getByRole('button', { name: /Zapnout moji polohu/ }).click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${dir}/app-map.png`, fullPage: true });
  await p.goBack();
  await p.getByRole('button', { name: 'Můj kód' }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${dir}/app-badge.png`, fullPage: true });
  await p.goBack();
  await p.getByRole('button', { name: 'Pomoc a kontakty' }).click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}/app-help.png`, fullPage: true });
  await ctx.close();

  const s = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await s.goto(APP);
  await s.getByTestId('code').fill(process.env.E2E_STAFF_CODE ?? '0505');
  await s.getByRole('switch', { name: 'Jsem člen týmu' }).click();
  await s.getByTestId('eventCode').fill('DEV123');
  await s.getByTestId('submit').click();
  await s.getByTestId('go-scan').waitFor({ timeout: 20_000 });
  await s.screenshot({ path: `${dir}/app-staff-home.png`, fullPage: true });
  await s.getByTestId('go-scan').click();
  await s.getByRole('radio', { name: 'Nástup' }).click();
  await s.waitForTimeout(800);
  await s.screenshot({ path: `${dir}/app-scan.png`, fullPage: true });
  await s.getByRole('radio', { name: /Autobus C/ }).click();
  await s.getByPlaceholder('Jméno nebo čtyřmístný kód').fill('Vzor');
  await s.getByRole('button', { name: 'Marie Vzorová' }).click();
  await s.getByTestId('scan-name').waitFor();
  await s.screenshot({ path: `${dir}/app-scan-result.png`, fullPage: true });
});
