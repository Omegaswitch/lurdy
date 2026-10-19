// Encrypted key-value storage for the phone's Supabase session (Supabase's documented React Native pattern):
// each value is AES-256-CTR encrypted with its own random key; the key lives in the device keychain/keystore
// (small values only), the ciphertext in ordinary app storage. Without the keychain entry the ciphertext is noise,
// so a backup or a file browser on a lost phone does not hold a usable refresh token.
// Not exported from the package index: only the app needs it (aes-js would otherwise reach the admin bundle).
import aesjs from 'aes-js';

export type KeyValue = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const hex = aesjs.utils.hex;

export function encryptedStorage(plain: KeyValue, secure: KeyValue, randomBytes: (n: number) => Uint8Array): KeyValue {
  return {
    async getItem(key) {
      const [keyHex, cipherHex] = await Promise.all([secure.getItem(key), plain.getItem(key)]);
      if (!keyHex || !cipherHex) return null;
      try {
        const aes = new aesjs.ModeOfOperation.ctr(hex.toBytes(keyHex), new aesjs.Counter(1));
        return aesjs.utils.utf8.fromBytes(aes.decrypt(hex.toBytes(cipherHex)));
      } catch {
        return null; // a value written with a key that is gone: treated as absent (the person signs in again)
      }
    },
    async setItem(key, value) {
      const k = randomBytes(32);
      const aes = new aesjs.ModeOfOperation.ctr(k, new aesjs.Counter(1));
      const cipherHex = hex.fromBytes(aes.encrypt(aesjs.utils.utf8.toBytes(value)));
      await secure.setItem(key, hex.fromBytes(k));
      await plain.setItem(key, cipherHex);
    },
    async removeItem(key) {
      await Promise.all([plain.removeItem(key), secure.removeItem(key)]);
    },
  };
}
