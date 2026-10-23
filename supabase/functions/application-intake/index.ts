// Receives an application sent on the public website (lurdy.eu, api/prihlaska.js) and files it in the active
// edition for the organisers (admin → Přihlášky). Only the website calls this: it proves itself with a shared secret
// (INTAKE_SECRET here, LURDY_INTAKE_SECRET on the website). Identity, gender, contact, emergency contact, the ID / passport
// number and who they travel with; the website never sends health answers or attachments (they stay in the e-mail).
// The reply lists the addresses chosen to be told about new applications; the website sends them the notice.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const secret = Deno.env.get('INTAKE_SECRET') ?? '';
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// constant-time comparison, so the secret cannot be guessed byte by byte from response times
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.replace(/[\x00-\x1f\x7f]+/g, ' ').trim().slice(0, max) : null);
const FORMS = ['pilgrim', 'malade', 'team'];
const LANGS = ['cs', 'en', 'fr', 'it', 'de'];

// "Jan Novák" → first "Jan", last "Novák"; the organiser corrects it when accepting if needed
export function splitName(full: string): [string, string] {
  const parts = full.split(/\s+/).filter(Boolean);
  return parts.length < 2 ? [full, full] : [parts.slice(0, -1).join(' ').slice(0, 120), parts.at(-1)!.slice(0, 120)];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method' });
  if (secret.length < 32 || !same(req.headers.get('x-intake-secret') ?? '', secret)) return reply(401, { error: 'secret' });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply(400, { error: 'invalid' }); }
  const full = str(b.name, 200);
  const birth = typeof b.birth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.birth) ? b.birth : null;
  if (!full || !FORMS.includes(b.form as string)) return reply(400, { error: 'invalid' });
  // the active edition (the one being prepared); without one, the application stays in e-mail only
  const { data: ed, error: edError } = await admin.from('editions').select('id').eq('status', 'active').order('year', { ascending: false }).limit(1).maybeSingle();
  if (edError) return reply(500, { error: 'server' });
  if (!ed) return reply(409, { error: 'no_active_edition' });
  const [first, last] = splitName(full);
  const { data, error } = await admin.from('applications').insert({
    edition_id: ed.id, form: b.form, full_name: full, first_name: first, last_name: last, birth_date: birth,
    email: str(b.email, 200), phone: str(b.mobile, 40), phone2: str(b.phone, 40), address: str(b.address, 300),
    emergency_name: str(b.relname, 200), emergency_phone: str(b.relmobile, 40) ?? str(b.relphone, 40), times: str(b.times, 200),
    language: LANGS.includes(b.lang as string) ? b.lang : 'cs',
    gender: b.gender === 'male' ? 'M' : b.gender === 'female' ? 'F' : null, passport: str(b.idnum, 40), travels_with: str(b.companion, 200),
  }).select('id').single();
  if (error) { console.error(error.message); return reply(500, { error: 'server' }); }
  // who is to be told about it (admin → Přihlášky → Upozornění); the website sends the notice
  const { data: notify } = await admin.from('application_notify').select('email').order('email');
  return reply(201, { id: data.id, notify: (notify ?? []).map((r) => r.email) });
});
