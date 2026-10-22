import type { Role, Tables } from '@lurdy/shared';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

type Edition = Tables<'editions'>;
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsMfa'; enrolled: boolean }
  | { status: 'setup' } // signed in with the codes + authenticator: choose the e-mail and password for the admin
  | { status: 'recovery' } // opened from the "forgotten password" e-mail
  | { status: 'noAccess' }
  | { status: 'codeExpired' } // the event code used at sign-in no longer counts: rights lapsed
  | { status: 'error'; message: string }
  | { status: 'ready'; session: Session; edition: Edition; roles: Role[]; me: Tables<'participants'> | null; superAdmin: boolean;
      codeValidUntil: string | null; staffCodeId: string | null };

type Ctx = { state: AuthState; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<Ctx | null>(null);

// access_code is withheld from the API (sign-in codes are credentials), so participant queries name their columns.
export const participantColumns = 'id, edition_id, user_id, category, title, first_name, last_name, preferred_name, phone, email, language, mobility, logistics_note, staff_note, photo_path, account_deleted_at, version, created_at, updated_at, updated_by';

// The session stays until the user signs out (no idle sign-out, owner's decision 2026-10-22): the authenticator is
// asked once per sign-in on each device, not again while the session lasts.

// Admin is for organisers (and super admins). Their rights only count with MFA (aal2) — enforced by the database;
// this only decides which screen to show.
async function resolve(): Promise<AuthState> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { status: 'signedOut' };
  const uid = session.user.id;
  const [profile, mine, aal] = await Promise.all([
    supabase.from('profiles').select('is_super_admin,status,staff_code_id').eq('id', uid).maybeSingle(),
    supabase.from('participants').select(`${participantColumns}, role_grants(role)`).eq('user_id', uid),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const failed = profile.error ?? mine.error ?? aal.error;
  if (failed) return { status: 'error', message: failed.message };
  const granted = (mine.data ?? []).flatMap((p) => (p.role_grants as { role: Role }[]).map((g) => g.role));
  const superAdmin = !!profile.data?.is_super_admin;
  const privileged = superAdmin || granted.includes('organizer') || granted.includes('medical');
  if (!privileged) return { status: 'noAccess' };
  if (aal.data?.currentLevel !== 'aal2') return { status: 'needsMfa', enrolled: aal.data?.nextLevel === 'aal2' };
  // The admin is for password sessions only (the database agrees): a code session here is the one-time setup.
  const byPassword = (aal.data?.currentAuthenticationMethods ?? []).some((m) => (typeof m === 'string' ? m : m.method) === 'password');
  if (!byPassword) return { status: superAdmin && !granted.length ? 'noAccess' : 'setup' };
  const editions = await supabase.from('editions').select('*').order('status').order('year', { ascending: false });
  if (editions.error) return { status: 'error', message: editions.error.message };
  const edition = editions.data.find((e) => e.status === 'active') ?? editions.data[0];
  // grants exist but no edition is visible: the event code has expired (super admins need no code)
  if (!edition) return { status: superAdmin ? 'noAccess' : 'codeExpired' };
  const me = (mine.data ?? []).find((p) => p.edition_id === edition.id) ?? null;
  const roles = (me?.role_grants as { role: Role }[] | undefined)?.map((g) => g.role) ?? [];
  let codeValidUntil: string | null = null;
  if (profile.data?.staff_code_id) {
    const code = await supabase.from('staff_codes').select('valid_until').eq('id', profile.data.staff_code_id).maybeSingle();
    codeValidUntil = code.data?.valid_until ?? null;
  }
  return { status: 'ready', session, edition, roles, me: me ? { ...me, role_grants: undefined } as unknown as Tables<'participants'> : null, superAdmin, codeValidUntil,
    staffCodeId: profile.data?.staff_code_id ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const refresh = useCallback(async () => {
    try {
      const next = await resolve();
      setState((prev) => (prev.status === 'recovery' && next.status !== 'signedOut' ? prev : next));
    } catch (e) {
      setState({ status: 'error', message: (e as Error).message });
    }
  }, []);
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    // offline or already expired: the server could not be told, but this browser forgets the session anyway
    if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setState({ status: 'signedOut' });
  }, []);
  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState({ status: 'signedOut' });
      if (event === 'PASSWORD_RECOVERY') setState({ status: 'recovery' });
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  return <AuthContext.Provider value={{ state, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

export function useReady() {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('not ready');
  return state;
}
