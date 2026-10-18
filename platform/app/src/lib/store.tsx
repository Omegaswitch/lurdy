import AsyncStorage from '@react-native-async-storage/async-storage';
import { canScan, t as translate, type MessageKey, type MyPilgrimage } from '@lurdy/shared';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

type Store = {
  ready: boolean; // session restored from storage
  session: Session | null;
  data: MyPilgrimage | null; // last known payload (possibly from the offline cache)
  offline: boolean; // the last refresh failed; `data` is the cached copy
  scale: number; // larger-text setting
  setScale: (s: number) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  t: (key: MessageKey) => string;
  isStaff: boolean;
};
const Ctx = createContext<Store | null>(null);
const cacheKey = (uid: string) => `pilgrimage:v1:${uid}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<MyPilgrimage | null>(null);
  const [offline, setOffline] = useState(false);
  const [scale, setScaleState] = useState(1);
  const uid = session?.user.id;

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
      setOffline(true);
      return;
    }
    setOffline(false);
    setData(fresh as unknown as MyPilgrimage | null);
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

  const editionId = data?.edition.id;
  useEffect(() => {
    if (!editionId) return;
    // Row-level security decides which changes reach this device; any of them triggers one refetch.
    const channel = supabase.channel(`me:${editionId}`);
    for (const table of ['leg_assignments', 'transport_legs', 'room_assignments', 'rooms', 'events', 'announcements', 'contacts', 'care_assignments', 'participants'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh());
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [editionId, refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    if (uid) await AsyncStorage.removeItem(cacheKey(uid)); // nothing personal stays on a shared phone
    setData(null);
  }, [uid]);

  const setScale = useCallback((s: number) => {
    setScaleState(s);
    AsyncStorage.setItem('textScale', String(s));
  }, []);

  const lang = data?.me?.language ?? 'cs';
  const value = useMemo<Store>(() => ({
    ready, session, data: uid ? data : null, offline, scale, setScale, refresh, signOut,
    t: (key) => translate(key, lang), isStaff: canScan(data?.roles ?? []),
  }), [ready, session, uid, data, offline, scale, setScale, refresh, signOut, lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}
