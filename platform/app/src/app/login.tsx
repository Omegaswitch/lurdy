import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Shield } from '../lib/brand';
import { Banner, BigButton, T } from '../lib/ui';
import { useStore } from '../lib/store';
import { signInWithCode } from '../lib/supabase';
import { colors, fonts, space } from '../lib/theme';
import type { CodeLoginError, MessageKey } from '@lurdy/shared';

const errors: Record<CodeLoginError, MessageKey> = { invalid: 'login.invalid', throttled: 'login.throttled', offline: 'login.offline', error: 'login.error' };

export default function Login() {
  const { session, t } = useStore();
  const [code, setCode] = useState('');
  const [team, setTeam] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [error, setError] = useState<CodeLoginError | null>(null);
  const [busy, setBusy] = useState(false);
  if (session) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    const e = await signInWithCode(code, team ? eventCode : undefined);
    setBusy(false);
    setError(e);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.red }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={{ alignSelf: 'center' }}><Shield /></View>
          <T kind="title" style={{ textAlign: 'center' }} accessibilityRole="header">{t('app.name')}</T>
          {error && <Banner kind="bad" title={t('login.title')}><T>{t(errors[error])}</T></Banner>}
          <View style={{ gap: space.s }}>
            <T kind="label" nativeID="codeLabel">{t('login.code')}</T>
            <TextInput style={s.code} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad"
              maxLength={4} autoFocus accessibilityLabel={t('login.code')} accessibilityLabelledBy="codeLabel" testID="code" textContentType="oneTimeCode" />
            <T kind="label">{t('login.code.help')}</T>
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
            disabled={busy || code.length !== 4 || (team && eventCode.length !== 6)} testID="submit" />
        </View>
        <Link href="/privacy" style={s.privacy}>Ochrana soukromí</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: space.l },
  privacy: { color: '#fff', fontFamily: fonts.semibold, fontSize: 20, textAlign: 'center', textDecorationLine: 'underline', padding: space.l, minHeight: 48 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: space.xl, gap: space.xl, maxWidth: 520, width: '100%', alignSelf: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 40, letterSpacing: 12, textAlign: 'center', borderWidth: 2, borderColor: colors.rule, borderRadius: 12, paddingVertical: space.m, color: colors.ink, backgroundColor: '#fff' },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: space.m },
});
