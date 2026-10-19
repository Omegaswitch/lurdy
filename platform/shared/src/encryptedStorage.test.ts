import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptedStorage, type KeyValue } from './encryptedStorage';

const memory = (): KeyValue & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => { map.set(k, v); },
    removeItem: async (k) => { map.delete(k); },
  };
};

describe('encryptedStorage', () => {
  it('round-trips values, keeps the key out of plain storage and the plaintext out of both', async () => {
    const plain = memory(), secure = memory();
    const store = encryptedStorage(plain, secure, (n) => new Uint8Array(randomBytes(n)));
    const session = JSON.stringify({ access_token: 'eyJ.fictional.token', refresh_token: 'r-fictional-123', user: { id: 'u1' } });
    await store.setItem('sb-session', session);
    expect(await store.getItem('sb-session')).toBe(session);
    expect(plain.map.get('sb-session')).not.toContain('fictional');
    expect(secure.map.get('sb-session')).toHaveLength(64); // 32 random bytes as hex
    expect(secure.map.get('sb-session')).not.toContain('fictional');
  });
  it('is unreadable without the keychain entry, and clean after removal', async () => {
    const plain = memory(), secure = memory();
    const store = encryptedStorage(plain, secure, (n) => new Uint8Array(randomBytes(n)));
    await store.setItem('k', 'secret value');
    secure.map.delete('k');
    expect(await store.getItem('k')).toBeNull();
    await store.setItem('k', 'again');
    await store.removeItem('k');
    expect(plain.map.size + secure.map.size).toBe(0);
    expect(await store.getItem('k')).toBeNull();
  });
  it('uses a fresh key per write', async () => {
    const plain = memory(), secure = memory();
    const store = encryptedStorage(plain, secure, (n) => new Uint8Array(randomBytes(n)));
    await store.setItem('k', 'one');
    const first = secure.map.get('k');
    await store.setItem('k', 'one');
    expect(secure.map.get('k')).not.toBe(first);
    expect(await store.getItem('k')).toBe('one');
  });
});
