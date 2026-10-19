import { formatInvitationCode, normaliseInvitationCode, parseInvitation, type CodeLoginError, type MessageKey } from '@lurdy/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Link, Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Shield } from '../lib/brand';
import { Banner, BigButton, T } from '../lib/ui';
import { useStore } from '../lib/store';
import { signInWithCode } from '../lib/supabase';
import { colors, fonts, space } from '../lib/theme';

const errors: Record<CodeLoginError, MessageKey> = { invalid: 'login.invalid', throttled: 'login.throttled', offline: 'login.offline', error: 'login.error' };

// Sign-in = attendee number + the code from the invitation (+ the event code for the team). The invitation's QR
// code (or its link, ?k=LRDL.<number>.<code>) fills both at once, so nobody has to type eight characters.
export default function Login() {
  const { session, t } = useStore();
  const params = useLocalSearchParams<{ k?: string }>();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [team, setTeam] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [error, setError] = useState<CodeLoginError | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const linked = params.k ? parseInvitation(`?k=${params.k}`) : null;
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    if (!linked || applied === params.k) return;
    // the link's values become the form's values exactly once; the person can still edit them
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(params.k ?? null);
    setCode(linked.code);
    setSecret(linked.secret);
    setScanned(true);
  }, [linked, applied, params.k]);

  if (session) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    try {
      setError(await signInWithCode(code, secret, team ? eventCode : undefined));
    } catch {
      setError('error');
    } finally {
      setBusy(false);
    }
  }

  function onScan(text: string) {
    const inv = parseInvitation(text);
    if (!inv) return;
    setCode(inv.code);
    setSecret(inv.secret);
    setScanned(true);
    setScanning(false);
  }

  async function startScan() {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) return;
    }
    setScanning(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.red }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={{ alignSelf: 'center' }}><Shield /></View>
          <T kind="title" style={{ textAlign: 'center' }} accessibilityRole="header">{t('app.name')}</T>
          {error && <Banner kind="bad" title={t('login.title')}><T>{t(errors[error])}</T></Banner>}
          {scanned && !error && <Banner kind="ok" title={t('login.scanned')}><T>{t('login.submit')} →</T></Banner>}
          {scanning ? (
            <View style={{ gap: space.m }}>
              <View style={{ height: 280, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => onScan(data)} accessibilityLabel={t('login.scan')} />
              </View>
              <BigButton icon="x" label={t('common.cancel')} onPress={() => setScanning(false)} />
            </View>
          ) : (
            <BigButton icon="scan" label={t('login.scan')} hint={t('login.scan.help')} onPress={startScan} testID="scan-invite" />
          )}
          <View style={{ gap: space.s }}>
            <T kind="label" nativeID="codeLabel">{t('login.code')}</T>
            <TextInput style={s.code} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad"
              maxLength={4} accessibilityLabel={t('login.code')} accessibilityLabelledBy="codeLabel" testID="code" textContentType="oneTimeCode" />
            <T kind="label">{t('login.code.help')}</T>
          </View>
          <View style={{ gap: space.s }}>
            <T kind="label" nativeID="inviteLabel">{t('login.secret')}</T>
            <TextInput style={s.invite} value={formatInvitationCode(secret)} onChangeText={(v) => setSecret(normaliseInvitationCode(v))}
              autoCapitalize="characters" autoCorrect={false} maxLength={9} accessibilityLabel={t('login.secret')} accessibilityLabelledBy="inviteLabel" testID="invite" />
            <T kind="label">{t('login.secret.help')}</T>
          </View>
          {/* the whole row is tappable; the switch itself is the one control assistive technology announces */}
          <Pressable style={s.toggle} onPress={() => setTeam(!team)} accessible={false}>
            <T kind="big" style={{ flex: 1 }} importantForAccessibility="no">{t('login.team')}</T>
            <Switch value={team} onValueChange={setTeam} trackColor={{ true: colors.red, false: colors.rule }} accessibilityLabel={t('login.team')} />
          </Pressable>
          {team && (
            <View style={{ gap: space.s }}>
              <T kind="label">{t('login.eventCode')}</T>
              <TextInput style={s.code} value={eventCode} onChangeText={(v) => setEventCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                autoCapitalize="characters" autoCorrect={false} maxLength={6} accessibilityLabel={t('login.eventCode')} testID="eventCode" />
              <T kind="label">{t('login.eventCode.help')}</T>
            </View>
          )}
          <BigButton label={busy ? t('common.loading') : t('login.submit')} tone="primary" icon="arrow" onPress={submit}
            disabled={busy || code.length !== 4 || secret.length !== 8 || (team && eventCode.length !== 6)} testID="submit" />
        </View>
        <Link href="/privacy" style={s.privacy}>{t('account.privacy')}</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.l },
  privacy: { color: '#fff', fontFamily: fonts.semibold, fontSize: 20, textAlign: 'center', textDecorationLine: 'underline', padding: space.l, minHeight: 48 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: space.xl, gap: space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 40, letterSpacing: 12, textAlign: 'center', borderWidth: 2, borderColor: colors.rule, borderRadius: 12, paddingVertical: space.m, color: colors.ink, backgroundColor: '#fff' },
  invite: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: 4, textAlign: 'center', borderWidth: 2, borderColor: colors.rule, borderRadius: 12, paddingVertical: space.m, color: colors.ink, backgroundColor: '#fff' },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: space.m },
});
