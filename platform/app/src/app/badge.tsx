import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, space } from '../lib/theme';
import { Banner, Card, Screen, T } from '../lib/ui';

// Full screen brightness while the code is on screen, so scanners read it in sunlight; the previous level comes back
// when the person leaves. App-level only (no permission). Browsers cannot change brightness: on the web the screen
// just stays awake and the code is shown black on white at full size.
function useMaxBrightness() {
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    let previous: number | null = null;
    let left = false;
    (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!left) await Brightness.setBrightnessAsync(1);
      } catch { /* unavailable on this device: the code still shows */ }
    })();
    return () => {
      left = true;
      if (Platform.OS === 'android') Brightness.restoreSystemBrightnessAsync().catch(() => {});
      else if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
  }, []));
}

// The on-screen code: a personal digital credential, stored only on this phone. Getting a new one (new phone,
// reinstall) cancels the previous digital code; the printed badge keeps working.
export default function Badge() {
  const { data, t, session } = useStore();
  useKeepAwake();
  useMaxBrightness();
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const key = `digitalCredential:${session?.user.id}:${data?.edition.id}`;

  useEffect(() => {
    if (!data?.me) return;
    (async () => {
      const stored = await AsyncStorage.getItem(key);
      if (stored) return setPayload(stored);
      const { data: p, error: e } = await supabase.rpc('my_digital_credential');
      if (e || !p) return setError(true);
      await AsyncStorage.setItem(key, p);
      setPayload(p);
    })();
  }, [data?.me, key]);

  if (!data?.me) return null;
  const me = data.me;
  return (
    <Screen title={t('home.badge')}>
      <Card style={{ alignItems: 'center', gap: space.xl }}>
        <T kind="huge" style={{ textAlign: 'center' }}>{[me.title, me.first_name, me.last_name].filter(Boolean).join(' ')}</T>
        {payload ? (
          <View style={{ padding: space.l, backgroundColor: '#fff' }} accessible accessibilityLabel="Váš osobní QR kód">
            <QRCode value={payload} size={260} color={colors.ink} backgroundColor="#fff" ecl="M" />
          </View>
        ) : error ? (
          <Banner kind="warn" title="Kód teď nelze načíst">
            <T>Připojte se k internetu a otevřete tuto obrazovku znovu. Tištěná jmenovka platí dál.</T>
          </Banner>
        ) : <ActivityIndicator size="large" color={colors.red} />}
        <T kind="big" style={{ textAlign: 'center' }}>{t('badge.show')}</T>
        {Platform.OS === 'web' && <T style={{ textAlign: 'center' }}>{t('badge.webBrightness')}</T>}
      </Card>
    </Screen>
  );
}
