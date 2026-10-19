// In-app account deletion, started by the signed-in person from the app ("Smazat můj účet").
// The database marks the registration and revokes the phone's digital code (public.delete_my_account, run with
// the caller's own session), then the Auth user is deleted with the service key, which never leaves this function.
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
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'unauthorized' });

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: whoError } = await asCaller.auth.getUser(authorization.slice(7));
  if (whoError || !who.user) return reply(401, { error: 'unauthorized' });

  const { error: markError } = await asCaller.rpc('delete_my_account');
  if (markError) return reply(500, { error: 'server' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: deleteError } = await admin.auth.admin.deleteUser(who.user.id);
  if (deleteError) return reply(500, { error: 'server' });
  return reply(200, { deleted: true });
});
