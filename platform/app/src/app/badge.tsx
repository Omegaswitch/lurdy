import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, space } from '../lib/theme';
import { Banner, Card, Screen, T } from '../lib/ui';

// The on-screen code: a personal digital credential, stored only on this phone. Getting a new one (new phone,
// reinstall) cancels the previous digital code; the printed badge keeps working.
export default function Badge() {
  const { data, t, session } = useStore();
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
      </Card>
    </Screen>
  );
}
