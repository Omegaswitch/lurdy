// Sign-in with the 4-digit attendee number + the 8-character code from the invitation (+ the 6-character event
// code for team members).
// The database decides (public.code_login_check: throttling, suspension, event-code validity);
// this function only turns a positive answer into a normal Supabase Auth session.
// Each participant gets one Auth user, created on first sign-in, with a synthetic address that never receives mail.
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

  let body: { code?: unknown; secret?: unknown; eventCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'invalid' });
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const secret = typeof body.secret === 'string' ? body.secret.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const eventCode = typeof body.eventCode === 'string' ? body.eventCode.trim().toUpperCase() : '';
  if (!/^\d{4}$/.test(code) || !/^[A-Z2-9]{8}$/.test(secret) || (eventCode && !/^[A-Z0-9]{6}$/.test(eventCode))) return reply(401, { error: 'invalid' });
  // The connecting address as the gateway saw it. Supabase's edge gateway rewrites X-Forwarded-For (verified: a forged
  // header is not reflected into the log), and Cloudflare names the client in cf-connecting-ip; the last hop is the
  // one a client cannot forge should a proxy ever append instead of replace.
  const forwarded = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const ip = req.headers.get('cf-connecting-ip')?.trim() || forwarded[forwarded.length - 1] || 'unknown';

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: check, error: checkError } = await admin.rpc('code_login_check', {
    p_code: code,
    p_secret: secret,
    p_staff_code: eventCode || null,
    p_ip: ip,
  });
  if (checkError) return reply(500, { error: 'server' });
  if (!check?.ok) return reply(check?.reason === 'throttled' ? 429 : 401, { error: check?.reason ?? 'invalid' });

  const email = `${check.participant_id}@login.lurdy.eu`;
  if (!check.user_id) {
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    // A previous attempt may have created the user but failed before linking; generateLink below finds it.
    if (error && error.code !== 'email_exists') return reply(500, { error: 'server' });
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkError || !link.user) return reply(500, { error: 'server' });

  const { error: bindError } = await admin.rpc('code_login_link', {
    p_participant: check.participant_id,
    p_user: link.user.id,
    p_staff_code: check.staff_code_id,
  });
  if (bindError) return reply(500, { error: 'server' });

  const pub = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await pub.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !verified.session) return reply(500, { error: 'server' });

  const s = verified.session;
  return reply(200, { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, team: check.team });
});
