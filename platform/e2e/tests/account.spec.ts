// App-store requirements on the real backend: the privacy notice opens without signing in, and a participant
// deletes their own account in the app; afterwards the code no longer signs in and the organisers see it.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { codeClient, knownSecret, organiserClient } from './helpers';

const APP = 'http://localhost:8081';
const surname = `Smazatelný${Date.now().toString(36)}`;

test.afterAll(async () => {
  const secret = knownSecret();
  if (secret) await (await organiserClient(secret)).from('participants').delete().like('last_name', 'Smazatelný%');
});

test('privacy notice is public and accessible', async ({ page }) => {
  await page.goto(APP);
  await page.getByRole('link', { name: 'Ochrana soukromí' }).click();
  await expect(page.getByRole('heading', { name: 'Poloha a fotoaparát' })).toBeVisible();
  await expect(page.getByText('Aplikace nesleduje vaše chování')).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await page.goto(`${APP}/privacy`); // the address given to the stores
  await expect(page.getByRole('heading', { name: 'Vaše práva' })).toBeVisible();
});

test('a participant deletes their account in the app', async ({ browser }) => {
  const secret = knownSecret();
  test.skip(!secret, 'needs the test organiser (run admin tests once)');
  const org = await organiserClient(secret!);
  const { data: edition } = await org.from('editions').select('id').eq('status', 'active').single();
  const { data: created, error } = await org.from('participants')
    .insert({ edition_id: edition!.id, category: 'pilgrim', first_name: 'Dana', last_name: surname }).select('id').single();
  expect(error).toBeNull();
  const { data: login } = await org.rpc('participant_login', { p_participant: created!.id });
  const p = { id: created!.id, ...(login as { access_code: string; login_secret: string }) };

  const page = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  await page.goto(APP);
  await page.getByTestId('code').fill(p!.access_code);
  await page.getByTestId('invite').fill(p!.login_secret);
  await page.getByTestId('submit').click();
  await expect(page.getByText('Dobrý den, Dana')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Účet a soukromí' }).click();
  await page.getByTestId('delete-account').click();
  await expect(page.getByText('Tento krok nejde vrátit zpět.')).toBeVisible();
  await page.getByTestId('delete-account-confirm').click();
  await expect(page.getByTestId('code')).toBeVisible({ timeout: 20_000 });

  await expect(codeClient(p!.access_code, p!.login_secret)).rejects.toThrow('code-login 401');
  const { data: after } = await org.from('participants').select('user_id, account_deleted_at').eq('id', p!.id).single();
  expect(after).toMatchObject({ user_id: null });
  expect(after!.account_deleted_at).not.toBeNull();
});
