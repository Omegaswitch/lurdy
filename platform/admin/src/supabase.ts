import { requestCodeLogin, type CodeLoginError, type Database } from '@lurdy/shared';
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
export const supabase = createClient<Database>(supabaseUrl, publishableKey);

export type { CodeLoginError } from '@lurdy/shared';

// Signs in through the code-login Edge Function, then stores the returned session in supabase-js.
export async function signInWithCode(code: string, secret: string, eventCode?: string): Promise<CodeLoginError | null> {
  const r = await requestCodeLogin(supabaseUrl, publishableKey, code, secret, eventCode);
  if (typeof r === 'string') return r;
  const { error } = await supabase.auth.setSession(r);
  return error ? 'error' : null;
}
