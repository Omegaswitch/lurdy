import AsyncStorage from '@react-native-async-storage/async-storage';
import { canScan, t as translate, type MessageKey, type MyPilgrimage } from '@lurdy/shared';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { deleteSecret } from './secret';
import { supabase } from './supabase';

type Store = {
  ready: boolean; // session restored from storage
  session: Session | null;
  data: MyPilgrimage | null; // last known payload (possibly from the offline cache)
  offline: boolean; // the last refresh failed; `data` is the cached copy
  noAccess: boolean; // signed in, but no pilgrimage to show (e.g. the edition is not started yet)
  scale: number; // larger-text setting
  setScale: (s: number) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  t: (key: MessageKey) => string;
  isStaff: boolean;
};
const Ctx = createContext<Store | null>(null);
const cacheKey = (uid: string) => `pilgrimage:v1:${uid}`;
export const credentialKey = (uid: string, editionId: string) => `digitalCredential:${uid}:${editionId}`;

// Everything personal this phone holds for one person: the offline copy and the badge code.
async function forget(uid: string, editionId: string | undefined) {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k === cacheKey(uid) || k.startsWith('digitalCredential:')));
  if (editionId) await deleteSecret(credentialKey(uid, editionId));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<MyPilgrimage | null>(null);
  const [offline, setOffline] = useState(false);
  const [noAccess, setNoAccess] = useState(false);
  const [scale, setScaleState] = useState(1);
  const uid = session?.user.id;
  const editionId = data?.edition.id;

  useEffect(() => {
    AsyncStorage.getItem('textScale').then((v) => v && setScaleState(Number(v)));
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const id = uid;
    if (!id) return;
    const { data: fresh, error } = await supabase.rpc('my_pilgrimage');
    if (error) {
      setOffline(true); // no network, or the server refused: either way the cached copy is what we have
      return;
    }
    setOffline(false);
    setNoAccess(fresh == null);
    if (fresh == null) return;
    setData(fresh as unknown as MyPilgrimage);
    await AsyncStorage.setItem(cacheKey(id), JSON.stringify(fresh));
  }, [uid]);

  // Show the cached copy at once, then refresh; refresh again on changes and when the app comes back.
  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(cacheKey(uid)).then((cached) => cached && setData((d) => d ?? JSON.parse(cached)));
    // refresh() sets state only after its network await, i.e. as a callback from an external system
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const timer = setInterval(refresh, 5 * 60_000);
    return () => {
      appState.remove();
      clearInterval(timer);
    };
  }, [uid, refresh]);

  useEffect(() => {
    if (!editionId) return;
    // Row-level security decides which changes reach this device. A burst of changes (an import, a reshuffle of
    // buses) becomes one refetch a couple of seconds later, not one per row.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; refresh(); }, 2000);
    };
    const channel = supabase.channel(`me:${editionId}`);
    for (const table of ['leg_assignments', 'transport_legs', 'room_assignments', 'rooms', 'events', 'announcements', 'contacts', 'care_assignments', 'participants'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [editionId, refresh]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    if (uid) await forget(uid, editionId); // nothing personal stays on a shared phone
    setData(null);
    setNoAccess(false);
  }, [uid, editionId]);

  // Deletes the sign-in account on the server (delete-account Edge Function), then forgets everything on this phone.
  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    // 401 after a lost reply: the account is already gone, which is what was asked for
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    if (error && status !== 401) return false;
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    if (uid) await forget(uid, editionId);
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k !== 'textScale'));
    setData(null);
    return true;
  }, [uid, editionId]);

  const setScale = useCallback((s: number) => {
    setScaleState(s);
    AsyncStorage.setItem('textScale', String(s));
  }, []);

  const lang = data?.me?.language ?? 'cs';
  const value = useMemo<Store>(() => ({
    ready, session, data: uid ? data : null, offline, noAccess, scale, setScale, refresh, signOut, deleteAccount,
    t: (key) => translate(key, lang), isStaff: canScan(data?.roles ?? []),
  }), [ready, session, uid, data, offline, noAccess, scale, setScale, refresh, signOut, deleteAccount, lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}
