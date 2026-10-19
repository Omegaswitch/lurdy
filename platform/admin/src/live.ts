import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Runs `load`, and runs it again whenever any of `tables` changes in this edition (Supabase Realtime,
// which applies the same row-level security as queries). Simple refetch: data sets are small.
// A burst of changes (an import of hundreds of rows) is coalesced into one refetch, and a slow older
// response never overwrites a newer one.
export function useLive<T>(load: () => Promise<T>, tables: string[], editionId: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const result = await loadRef.current();
      if (mine !== seq.current) return; // a newer load is already on its way
      setData(result);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; reload(); }, 300);
    };
    const channel = supabase.channel(`live:${tables.join(',')}:${Math.random().toString(36).slice(2)}`);
    for (const table of tables) {
      for (const event of ['INSERT', 'UPDATE'] as const)
        channel.on('postgres_changes', { event, schema: 'public', table, filter: `edition_id=eq.${editionId}` }, soon);
      // Realtime cannot filter deletes by column (their payload has only the id), so listen to all; nothing else is sent.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, soon);
    }
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Živé aktualizace teď nefungují – obnovte stránku, než budete pokračovat.');
    });
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, editionId, tables.join(',')]);

  return { data, error, reload };
}

// Throws the Supabase error so useLive can report it.
export async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// For updates and deletes: PostgREST answers "ok" with zero rows when row-level security filtered the row away
// (e.g. the event code expired meanwhile). Pass a query ending in `.select('id')`; zero rows is reported as an error.
export async function affected(p: PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>) {
  const { data, error } = await p;
  if (error) return { error };
  if (!data?.length) return { error: { message: 'no rows', code: 'NO_ROWS' } };
  return { error: null };
}
