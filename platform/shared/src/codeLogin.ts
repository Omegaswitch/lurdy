// Calls the code-login Edge Function. Each client stores the returned tokens with its own supabase-js instance.
// Sign-in = attendee number (4 digits) + invitation code (8 characters) [+ event code for the team].
export type CodeLoginError = 'invalid' | 'throttled' | 'offline' | 'error';
export type CodeLoginTokens = { access_token: string; refresh_token: string };

// The invitation code as people type it: case and separators do not matter; shown as XXXX-XXXX.
export const INVITATION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normaliseInvitationCode = (s: string) => s.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
export const formatInvitationCode = (s: string) => normaliseInvitationCode(s).replace(/^(.{4})(.+)$/, '$1-$2');
// The invitation QR / link payload: LRDL.<number>.<code>
export const invitationPayload = (code: string, secret: string) => `LRDL.${code}.${secret}`;
export function parseInvitation(text: string): { code: string; secret: string } | null {
  const m = text.trim().match(/(?:^|[?&]k=)LRDL\.(\d{4})\.([A-Z2-9]{8})(?:$|[&#])/i);
  return m ? { code: m[1]!, secret: m[2]!.toUpperCase() } : null;
}

export async function requestCodeLogin(
  supabaseUrl: string, publishableKey: string, code: string, secret: string, eventCode?: string,
): Promise<CodeLoginTokens | CodeLoginError> {
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/code-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publishableKey },
      body: JSON.stringify({ code, secret: normaliseInvitationCode(secret), eventCode: eventCode || undefined }),
    });
  } catch {
    return 'offline';
  }
  if (res.status === 401) return 'invalid';
  if (res.status === 429) return 'throttled';
  if (!res.ok) return 'error';
  try {
    const tokens = (await res.json()) as Partial<CodeLoginTokens>;
    return tokens.access_token && tokens.refresh_token ? (tokens as CodeLoginTokens) : 'error';
  } catch {
    return 'error'; // e.g. a hotel Wi-Fi portal answering 200 with a web page
  }
}
