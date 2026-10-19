import type { Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://vcfrcczyqpsbmewcuskc.supabase.co';
export const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_6aqvmALLqpY4ijdE0vETzQ_q5fxMqWc';
// Fictional dev seed (supabase/seed-dev.sql): the test organiser, a staff member, the event code. Codes are random
// per database; override with E2E_ORGANISER_CODE / E2E_STAFF_CODE when running against another project.
export const DEV = { organiser: process.env.E2E_ORGANISER_CODE ?? '2936', staff: process.env.E2E_STAFF_CODE ?? '0505', event: 'DEV123' };

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
export async function codeClient(code: string, eventCode?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/code-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY },
    body: JSON.stringify({ code, eventCode }),
  });
  if (!res.ok) throw new Error(`code-login ${res.status}`);
  const s = await res.json();
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return client;
}

// The test organiser keeps one enrolled authenticator factor. Its secret lives in a git-ignored file (or the
// E2E_ORGANISER_TOTP variable in CI): the first run enrols and saves it, later runs reuse it. Never unenrol —
// a factor whose secret is lost locks the account until someone deletes it in the database.
const SECRETS = new URL('../.mfa-secrets.json', import.meta.url);
const secrets = (): Record<string, string> => (existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : {});
export const knownSecret = () => process.env.E2E_ORGANISER_TOTP ?? secrets()[DEV.organiser];
const saveSecret = (code: string, secret: string) => writeFileSync(SECRETS, JSON.stringify({ ...secrets(), [code]: secret }, null, 2));
// Supabase refuses a second TOTP verification for the same user within one 30-second step.
const nextStep = () => new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)));

// Signs the test organiser into the admin, enrolling MFA the first time. Returns the TOTP secret.
export async function adminLogin(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Váš čtyřmístný kód').fill(DEV.organiser);
  await page.getByLabel('Kód pouti (6 znaků)').fill(DEV.event);
  await page.getByRole('button', { name: 'Přihlásit' }).click();
  // first call may hit a cold Edge Function
  await page.getByRole('heading', { name: 'Ověření aplikací' }).waitFor({ timeout: 20_000 });
  const shown = page.locator('code');
  const enrolling = await shown.waitFor({ timeout: knownSecret() ? 5_000 : 20_000 }).then(() => true, () => false);
  const secret = enrolling ? (await shown.textContent())!.trim() : knownSecret();
  if (!secret) throw new Error('The test organiser has an authenticator factor but its secret is unknown (set E2E_ORGANISER_TOTP).');
  if (enrolling) saveSecret(DEV.organiser, secret);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Šestimístné číslo z aplikace').fill(totp(secret));
    await page.getByRole('button', { name: 'Ověřit' }).click();
    if (await page.getByRole('heading', { name: 'Přehled' }).waitFor({ timeout: 10_000 }).then(() => true, () => false)) return secret;
    await nextStep();
  }
  throw new Error('MFA verification failed twice');
}

// The test organiser as an API client with MFA (aal2), e.g. to clean up test data whatever happened in the UI.
export async function organiserClient(secret: string) {
  const org = await codeClient(DEV.organiser, DEV.event);
  const { data } = await org.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === 'verified');
  if (!factor) throw new Error('test organiser has no verified factor');
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await org.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(secret) });
    if (!error) {
      // the tests create and delete people: refuse to run anywhere but the fictional development edition
      const { data: editions } = await org.from('editions').select('title').eq('status', 'active');
      if (!editions?.some((e) => e.title === 'Vývojový ročník (fiktivní data)')) throw new Error('not the development edition: refusing to run tests here');
      return org;
    }
    await nextStep();
  }
  throw new Error('MFA verification failed twice');
}
