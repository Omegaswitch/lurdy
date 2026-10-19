import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanAction } from '@lurdy/shared';
import { supabase } from './supabase';

// Scans made without signal wait here and are sent when the phone is back online. Each carries the idempotency
// key the server records once, so a scan that did reach the server but whose answer was lost is not applied twice.
// The queue holds badge payloads (opaque tokens) and participant ids, never names.
export type QueuedScan = {
  id: string; // client_scan_id
  at: string;
  action: ScanAction;
  legId?: string;
  payload?: string; // badge token (camera / typed)
  participantId?: string; // manual search
};
const KEY = 'scanQueue:v1';

export async function readQueue(): Promise<QueuedScan[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  } catch {
    return [];
  }
}

export async function enqueue(item: QueuedScan) {
  const q = await readQueue();
  if (!q.some((x) => x.id === item.id)) await AsyncStorage.setItem(KEY, JSON.stringify([...q, item]));
}

// Sends what it can, oldest first; stops at the first network failure. Returns how many were sent and how many wait.
export async function flushQueue(): Promise<{ sent: number; left: number }> {
  const q = await readQueue();
  let sent = 0;
  for (const item of q) {
    const call = item.payload
      ? supabase.rpc('scan_badge', { p_payload: item.payload, p_action: item.action, p_leg: item.legId, p_client_scan_id: item.id })
      : supabase.rpc('staff_action', { p_participant: item.participantId!, p_action: item.action, p_leg: item.legId, p_client_scan_id: item.id });
    const { error } = await call;
    if (error) break; // still offline (or the server is down): keep this and everything after it
    sent++;
  }
  const left = q.slice(sent);
  await AsyncStorage.setItem(KEY, JSON.stringify(left));
  return { sent, left: left.length };
}

export async function clearQueue() {
  await AsyncStorage.removeItem(KEY);
}
