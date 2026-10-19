import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { deleteSecret, getSecret, setSecret } from '../lib/secret';
import { credentialKey, useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, space } from '../lib/theme';
import { Banner, Card, NoData, Screen, T } from '../lib/ui';

// Full screen brightness while the code is on screen, so scanners read it in sunlight; the previous level comes back
// when the person leaves, and (iOS keeps the level system-wide) also when the app goes to the background.
// App-level only (no permission). Browsers cannot change brightness: on the web the screen just stays awake.
function useMaxBrightness() {
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    let previous: number | null = null;
    let left = false;
    const restore = () => {
      if (Platform.OS === 'android') Brightness.restoreSystemBrightnessAsync().catch(() => {});
      else if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
    const raise = async () => {
      try {
        if (previous === null) previous = await Brightness.getBrightnessAsync();
        if (!left) await Brightness.setBrightnessAsync(1);
      } catch { /* unavailable on this device: the code still shows */ }
    };
    raise();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? raise() : restore()));
    return () => {
      left = true;
      sub.remove();
      restore();
    };
  }, []));
}

// The on-screen code: a personal digital credential, kept in the phone's keychain. Getting a new one (new phone,
// reinstall, a revocation by the organisers) cancels the previous digital code; the printed badge keeps working.
export default function Badge() {
  const { data, t, session } = useStore();
  useKeepAwake();
  useMaxBrightness();
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const inFlight = useRef(false);
  const uid = session?.user.id;
  const editionId = data?.edition.id;
  const meId = data?.me?.id;

  useEffect(() => {
    if (!uid || !editionId || !meId || inFlight.current) return;
    inFlight.current = true;
    const key = credentialKey(uid, editionId);
    (async () => {
      try {
        let stored = await getSecret(key);
        if (stored) {
          setPayload(stored);
          // still the valid one? (revoked by the organisers, or replaced from another phone)
          const { data: valid, error: e } = await supabase.rpc('my_digital_credential_valid');
          if (e || valid !== false) return;
          await deleteSecret(key);
          stored = null;
          setRenewed(true);
        }
        const { data: p, error: e } = await supabase.rpc('my_digital_credential');
        if (e || !p) return setError(true);
        await setSecret(key, p);
        setPayload(p);
      } finally {
        inFlight.current = false;
      }
    })();
  }, [uid, editionId, meId]);

  if (!data?.me) return <NoData />;
  const me = data.me;
  return (
    <Screen title={t('home.badge')}>
      <Card style={{ alignItems: 'center', gap: space.xl }}>
        <T kind="huge" style={{ textAlign: 'center' }}>{[me.title, me.first_name, me.last_name].filter(Boolean).join(' ')}</T>
        {payload ? (
          <View style={{ padding: space.l, backgroundColor: '#fff' }} accessible accessibilityLabel={t('badge.qrLabel')}>
            <QRCode value={payload} size={260} color={colors.ink} backgroundColor="#fff" ecl="M" />
          </View>
        ) : error ? (
          <Banner kind="warn" title={t('badge.unavailable')}>
            <T>{t('badge.unavailable.help')}</T>
          </Banner>
        ) : <ActivityIndicator size="large" color={colors.red} />}
        {renewed && <Banner kind="info" title={t('badge.renewed')}><T>{t('badge.renewed.help')}</T></Banner>}
        <T kind="big" style={{ textAlign: 'center' }}>{t('badge.show')}</T>
        {Platform.OS === 'web' && <T style={{ textAlign: 'center' }}>{t('badge.webBrightness')}</T>}
      </Card>
    </Screen>
  );
}
