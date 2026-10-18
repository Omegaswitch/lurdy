import type { Role, Tables } from '@lurdy/shared';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

type Edition = Tables<'editions'>;
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsMfa'; enrolled: boolean }
  | { status: 'noAccess' }
  | { status: 'ready'; session: Session; edition: Edition; roles: Role[]; me: Tables<'participants'> | null; superAdmin: boolean };

type Ctx = { state: AuthState; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthContext = createContext<Ctx | null>(null);

// Admin is for organisers (and super admins). Their rights only count with MFA (aal2) — enforced by the database;
// this only decides which screen to show.
async function resolve(): Promise<AuthState> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { status: 'signedOut' };
  const uid = session.user.id;
  const [{ data: profile }, { data: mine }, { data: aal }] = await Promise.all([
    supabase.from('profiles').select('is_super_admin,status').eq('id', uid).maybeSingle(),
    supabase.from('participants').select('*, role_grants(role)').eq('user_id', uid),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const granted = (mine ?? []).flatMap((p) => (p.role_grants as { role: Role }[]).map((g) => g.role));
  const superAdmin = !!profile?.is_super_admin;
  const privileged = superAdmin || granted.includes('organizer') || granted.includes('medical');
  if (!privileged) return { status: 'noAccess' };
  if (aal?.currentLevel !== 'aal2') return { status: 'needsMfa', enrolled: aal?.nextLevel === 'aal2' };
  const { data: editions } = await supabase.from('editions').select('*').order('status').order('year', { ascending: false });
  const edition = editions?.find((e) => e.status === 'active') ?? editions?.[0];
  if (!edition) return { status: 'noAccess' };
  const me = (mine ?? []).find((p) => p.edition_id === edition.id) ?? null;
  const roles = (me?.role_grants as { role: Role }[] | undefined)?.map((g) => g.role) ?? [];
  return { status: 'ready', session, edition, roles, me: me ? { ...me, role_grants: undefined } as unknown as Tables<'participants'> : null, superAdmin };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const refresh = useCallback(async () => setState(await resolve()), []);
  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState({ status: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ status: 'signedOut' });
  }, []);
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
