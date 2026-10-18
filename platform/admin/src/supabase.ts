import type { Database } from '@lurdy/shared';
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
export const supabase = createClient<Database>(supabaseUrl, publishableKey);

export type CodeLoginError = 'invalid' | 'throttled' | 'offline' | 'error';

// Signs in through the code-login Edge Function, then stores the returned session in supabase-js.
export async function signInWithCode(code: string, eventCode?: string): Promise<CodeLoginError | null> {
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/code-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publishableKey },
      body: JSON.stringify({ code, eventCode: eventCode || undefined }),
    });
  } catch {
    return 'offline';
  }
  if (res.status === 401) return 'invalid';
  if (res.status === 429) return 'throttled';
  if (!res.ok) return 'error';
  const s = await res.json();
  const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return error ? 'error' : null;
}
