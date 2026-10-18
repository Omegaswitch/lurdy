import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestCodeLogin, type CodeLoginError, type Database } from '@lurdy/shared';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
export const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Supabase's recommended pattern for React Native: refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export async function signInWithCode(code: string, eventCode?: string): Promise<CodeLoginError | null> {
  const r = await requestCodeLogin(supabaseUrl, publishableKey, code, eventCode);
  if (typeof r === 'string') return r;
  const { error } = await supabase.auth.setSession(r);
  return error ? 'error' : null;
}
