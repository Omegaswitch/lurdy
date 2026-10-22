// One-time setup of the admin sign-in (e-mail + password), like the school websites. The caller is an organiser or
// medical team member who has just signed in the simple way (attendee number + invitation code + event code) AND
// confirmed with the authenticator app. This sets an e-mail and a password on that same account; from then on the
// admin is opened with e-mail + password + authenticator (the database refuses organiser rights to code sessions).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return reply(401, { error: 'session' });

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'invalid' });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return reply(400, { error: 'email' });
  if (password.length < 12 || password.length > 128) return reply(400, { error: 'password' });

  // Who is calling, as the caller (their own token): a second factor in this session, and an organiser/medical grant.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoError } = await caller.auth.getUser(token);
  if (whoError || !who.user) return reply(401, { error: 'session' });
  const claims = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
  if (claims.aal !== 'aal2') return reply(403, { error: 'mfa' });
  const { data: granted, error: grantError } = await caller.rpc('my_admin_grant');
  if (grantError) return reply(500, { error: 'server' });
  if (!granted) return reply(403, { error: 'forbidden' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.updateUserById(who.user.id, { email, password, email_confirm: true });
  if (error) return reply(error.code === 'email_exists' ? 409 : 400, { error: error.code === 'email_exists' ? 'taken' : error.code === 'weak_password' ? 'weak' : 'invalid' });
  return reply(200, { ok: true });
});
