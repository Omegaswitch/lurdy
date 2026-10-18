import type { Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://vcfrcczyqpsbmewcuskc.supabase.co';
export const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_6aqvmALLqpY4ijdE0vETzQ_q5fxMqWc';
// Fictional dev seed (supabase/seed-dev.sql): the test organiser, a staff member, the event code. Codes are random
// per database; override with E2E_ORGANISER_CODE / E2E_STAFF_CODE when running against another project.
export const DEV = { organiser: process.env.E2E_ORGANISER_CODE ?? '7700', staff: process.env.E2E_STAFF_CODE ?? '0505', event: 'DEV123' };

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

// The TOTP secret of the test organiser is kept in a git-ignored file from the moment it is shown, so that a run
// that dies half-way does not leave a factor nobody can use (the next run signs in with it and cleans up).
const SECRETS = new URL('../.mfa-secrets.json', import.meta.url);
const secrets = (): Record<string, string> => (existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : {});
const saveSecret = (code: string, secret: string | null) => {
  const all = secrets();
  if (secret) all[code] = secret; else delete all[code];
  writeFileSync(SECRETS, JSON.stringify(all, null, 2));
};

// Signs the test organiser into the admin, enrolling MFA if needed. Returns the TOTP secret.
export async function adminLogin(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Váš čtyřmístný kód').fill(DEV.organiser);
  await page.getByLabel('Kód pouti (6 znaků)').fill(DEV.event);
  await page.getByRole('button', { name: 'Přihlásit' }).click();
  // first call may hit a cold Edge Function
  await page.getByRole('heading', { name: 'Ověření aplikací' }).waitFor({ timeout: 20_000 });
  // A fresh enrolment shows its secret; an account that is already enrolled does not.
  const shown = page.locator('code');
  const enrolling = await shown.waitFor({ timeout: secrets()[DEV.organiser] ? 5_000 : 20_000 }).then(() => true, () => false);
  const secret = enrolling ? (await shown.textContent())!.trim() : secrets()[DEV.organiser]!;
  if (enrolling) saveSecret(DEV.organiser, secret);
  // Supabase refuses a second TOTP verification for the same user within one 30-second step, so retry once in the next.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByLabel('Šestimístné číslo z aplikace').fill(totp(secret));
    await page.getByRole('button', { name: 'Ověřit' }).click();
    const ok = await page.getByRole('heading', { name: 'Přehled' }).waitFor({ timeout: 10_000 }).then(() => true, () => false);
    if (ok) return secret;
    await page.waitForTimeout(31_000 - (Date.now() % 30_000));
  }
  throw new Error('MFA verification failed twice');
}

// Removes the organiser's MFA factor so the next run enrols afresh.
export async function removeMfa(secret: string) {
  const org = await codeClient(DEV.organiser, DEV.event);
  const { data } = await org.auth.mfa.listFactors();
  for (const f of data?.totp ?? []) {
    await org.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(secret) });
    await org.auth.mfa.unenroll({ factorId: f.id });
  }
  saveSecret(DEV.organiser, null);
}
