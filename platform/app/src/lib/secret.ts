import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Small secrets (the phone's badge code) go to the device keychain/keystore, not to plain app storage, so a
// backup or a file browser on a lost phone does not hold a working badge. Browsers have no keychain: there the
// value stays in the page's storage, which the sign-out wipes.
const ok = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export async function getSecret(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(ok(key));
  } catch {
    return null;
  }
}

export async function setSecret(key: string, value: string) {
  if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
  await SecureStore.setItemAsync(ok(key), value);
}

export async function deleteSecret(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
  await SecureStore.deleteItemAsync(ok(key)).catch(() => {});
}
