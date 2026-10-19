import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestCodeLogin, type CodeLoginError, type Database } from '@lurdy/shared';
import { encryptedStorage } from '@lurdy/shared/src/encryptedStorage';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
export const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

// On a phone the session (refresh token) is encrypted with a key held in the keychain/keystore; a browser has no
// keychain, so the web build keeps the session in the page's storage as before.
const keychain = {
  getItem: (k: string) => SecureStore.getItemAsync(k.replace(/[^A-Za-z0-9._-]/g, '_')),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k.replace(/[^A-Za-z0-9._-]/g, '_'), v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k.replace(/[^A-Za-z0-9._-]/g, '_')).catch(() => {}),
};
const sessionStorage = Platform.OS === 'web' ? AsyncStorage : encryptedStorage(AsyncStorage, keychain, (n) => Crypto.getRandomBytes(n));

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Supabase's recommended pattern for React Native: refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export async function signInWithCode(code: string, secret: string, eventCode?: string): Promise<CodeLoginError | null> {
  const r = await requestCodeLogin(supabaseUrl, publishableKey, code, secret, eventCode);
  if (typeof r === 'string') return r;
  const { error } = await supabase.auth.setSession(r);
  return error ? 'error' : null;
}
