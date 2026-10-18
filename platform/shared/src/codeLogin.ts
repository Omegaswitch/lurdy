// Calls the code-login Edge Function. Each client stores the returned tokens with its own supabase-js instance.
export type CodeLoginError = 'invalid' | 'throttled' | 'offline' | 'error';
export type CodeLoginTokens = { access_token: string; refresh_token: string };

export async function requestCodeLogin(
  supabaseUrl: string, publishableKey: string, code: string, eventCode?: string,
): Promise<CodeLoginTokens | CodeLoginError> {
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
  return (await res.json()) as CodeLoginTokens;
}
