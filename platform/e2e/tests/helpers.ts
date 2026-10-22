import type { Page } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://vcfrcczyqpsbmewcuskc.supabase.co';
export const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_6aqvmALLqpY4ijdE0vETzQ_q5fxMqWc';
// Fictional dev seed (supabase/seed-dev.sql): the test organiser, a staff member, the event code. Codes are random
// per database; override with E2E_ORGANISER_CODE / E2E_STAFF_CODE when running against another project.
// Numbers are random per database; the invitation codes of the fictional people are fixed in seed-dev.sql.
export const DEV = {
  organiser: process.env.E2E_ORGANISER_CODE ?? '2936', organiserSecret: process.env.E2E_ORGANISER_SECRET ?? 'DEVTEST3',
  staff: process.env.E2E_STAFF_CODE ?? '0505', staffSecret: process.env.E2E_STAFF_SECRET ?? 'DEVSTAFF',
  pilgrim: process.env.E2E_PILGRIM_CODE ?? '3672', pilgrimSecret: process.env.E2E_PILGRIM_SECRET ?? 'DEVPUTNK',
  event: 'DEV123',
};

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret, as an authenticator app computes it.
export function totp(secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

// A signed-in API client, through the same code-login function the apps use.
export async function codeClient(code: string, secret: string, eventCode?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/code-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY },
    body: JSON.stringify({ code, secret, eventCode }),
  });
  if (!res.ok) throw new Error(`code-login ${res.status}`);
  const s = await res.json();
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return client;
}

// The test organiser keeps one enrolled authenticator factor and an admin e-mail + password. Both live in a
// git-ignored file (or E2E_ORGANISER_TOTP / E2E_ORGANISER_EMAIL / E2E_ORGANISER_PASSWORD in CI): the first run
// enrols the factor and sets the e-mail and a random password through the one-time setup, later runs reuse them.
// Never unenrol — a factor whose secret is lost locks the account until someone deletes it in the database.
const SECRETS = new URL('../.mfa-secrets.json', import.meta.url);
const secrets = (): Record<string, string> => (existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : {});
export const knownSecret = () => process.env.E2E_ORGANISER_TOTP ?? secrets()[DEV.organiser];
const save = (key: string, value: string) => writeFileSync(SECRETS, JSON.stringify({ ...secrets(), [key]: value }, null, 2));
const knownLogin = () => {
  const email = process.env.E2E_ORGANISER_EMAIL ?? secrets()[`${DEV.organiser}:email`];
  const password = process.env.E2E_ORGANISER_PASSWORD ?? secrets()[`${DEV.organiser}:password`];
  return email && password ? { email, password } : null;
};
const newLogin = () => {
  const login = { email: 'e2e-organizator@example.invalid', password: `E2e-${randomBytes(12).toString('base64url')}` };
  save(`${DEV.organiser}:email`, login.email);
  save(`${DEV.organiser}:password`, login.password);
  return login;
};
// Supabase refuses a second TOTP verification for the same user within one 30-second step.
const nextStep = () => new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)));

// The authenticator step of the admin sign-in, enrolling MFA the first time. Returns the TOTP secret.
async function mfaStep(page: Page, done: () => Promise<boolean>): Promise<string> {
  await page.getByRole('heading', { name: 'Ověření aplikací' }).waitFor({ timeout: 20_000 }); // first call may hit a cold Edge Function
  const shown = page.locator('code');
  const enrolling = await shown.waitFor({ timeout: knownSecret() ? 5_000 : 20_000 }).then(() => true, () => false);
  const secret = enrolling ? (await shown.textContent())!.trim() : knownSecret();
  if (!secret) throw new Error('The test organiser has an authenticator factor but its secret is unknown (set E2E_ORGANISER_TOTP).');
  if (enrolling) save(DEV.organiser, secret);
  for (let attempt = 0; attempt < 3; attempt++) { // a verification by a previous spec's cleanup may fall in the same 30 s step
    await page.getByLabel('Šestimístné číslo z aplikace').fill(totp(secret));
    await page.getByRole('button', { name: 'Ověřit' }).click();
    if (await done()) return secret;
    await nextStep();
  }
  throw new Error('MFA verification failed three times');
}

// Signs the test organiser into the admin with e-mail, password and authenticator. The first time, it goes through
// the one-time setup (invitation codes + event code + authenticator, then e-mail and password). Returns the TOTP secret.
export async function adminLogin(page: Page): Promise<string> {
  await page.goto('/');
  let login = knownLogin();
  if (!login) {
    await page.getByRole('button', { name: 'První přihlášení: nastavit e-mail a heslo' }).click();
    await page.getByLabel('Vaše číslo účastníka').fill(DEV.organiser);
    await page.getByLabel('Kód z pozvánky').fill(DEV.organiserSecret);
    await page.getByLabel('Kód pouti (6 znaků)').fill(DEV.event);
    await page.getByRole('button', { name: 'Pokračovat' }).click();
    const setup = page.getByRole('heading', { name: 'Nastavte si přihlášení' });
    await mfaStep(page, () => setup.waitFor({ timeout: 10_000 }).then(() => true, () => false));
    login = newLogin();
    await page.getByLabel('E-mail').fill(login.email);
    await page.getByLabel('Nové heslo').fill(login.password);
    await page.getByLabel('Heslo znovu').fill(login.password);
    await page.getByRole('button', { name: 'Uložit a přihlásit se znovu' }).click();
    await page.getByText('Přístup je nastaven.').waitFor({ timeout: 20_000 });
  }
  await page.getByLabel('E-mail').fill(login.email);
  await page.getByLabel('Heslo', { exact: true }).fill(login.password);
  await page.getByRole('button', { name: 'Přihlásit' }).click();
  return mfaStep(page, () => page.getByRole('heading', { name: 'Přehled' }).waitFor({ timeout: 10_000 }).then(() => true, () => false));
}

// The test organiser as an API client with a password session and MFA (aal2), e.g. to clean up test data whatever
// happened in the UI. Sets up the e-mail and password through the setup function if no run has done it yet.
export async function organiserClient(secret: string) {
  const verify = async (client: Awaited<ReturnType<typeof codeClient>>) => {
    const { data } = await client.auth.mfa.listFactors();
    const factor = data?.totp.find((f) => f.status === 'verified');
    if (!factor) throw new Error('test organiser has no verified factor');
    for (let attempt = 0; attempt < 3; attempt++) { // a verification by a previous spec's cleanup may fall in the same 30 s step
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(secret) });
      if (!error) return;
      await nextStep();
    }
    throw new Error('MFA verification failed three times');
  };
  let login = knownLogin();
  if (!login) {
    const viaCode = await codeClient(DEV.organiser, DEV.organiserSecret, DEV.event);
    await verify(viaCode);
    login = newLogin();
    const { error } = await viaCode.functions.invoke('admin-login-setup', { body: login });
    if (error) throw new Error(`admin-login-setup: ${error.message}`);
    await nextStep();
  }
  const org = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await org.auth.signInWithPassword(login);
  if (error) throw new Error(`organiser sign-in: ${error.message}`);
  await verify(org);
  // the tests create and delete people: refuse to run anywhere but the fictional development edition
  const { data: editions } = await org.from('editions').select('title').eq('status', 'active');
  if (!editions?.some((e) => e.title === 'Vývojový ročník (fiktivní data)')) throw new Error('not the development edition: refusing to run tests here');
  return org;
}
