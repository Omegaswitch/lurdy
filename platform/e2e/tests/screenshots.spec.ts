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
