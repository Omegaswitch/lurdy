import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Runs `load`, and runs it again whenever any of `tables` changes in this edition (Supabase Realtime,
// which applies the same row-level security as queries). Simple refetch: data sets are small.
export function useLive<T>(load: () => Promise<T>, tables: string[], editionId: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    const channel = supabase.channel(`live:${tables.join(',')}:${Math.random().toString(36).slice(2)}`);
    for (const table of tables) {
      for (const event of ['INSERT', 'UPDATE'] as const)
        channel.on('postgres_changes', { event, schema: 'public', table, filter: `edition_id=eq.${editionId}` }, () => reload());
      // Realtime cannot filter deletes by column (their payload has only the id), so listen to all; nothing else is sent.
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => reload());
    }
    channel.subscribe();
    return () => {
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
