import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, fonts, space } from '../lib/theme';
import { Banner, BigButton, Card, Screen, T, NoData } from '../lib/ui';

const kinds = ['missing_person', 'care', 'medical', 'operational', 'other'] as const;

export default function Report() {
  const { data, t } = useStore();
  const [kind, setKind] = useState<(typeof kinds)[number] | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [summary, setSummary] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  if (!data) return <NoData />;

  async function send() {
    setState('sending');
    const { error } = await supabase.from('incidents').insert({
      edition_id: data!.edition.id, kind: kind!, severity: urgent ? 'high' : 'normal', summary: summary.trim(),
    });
    setState(error ? 'error' : 'sent');
  }

  if (state === 'sent')
    return (
      <Screen title={t('home.report')}>
        <Banner kind="ok" title={t('report.sent')}><T>{t('report.sent.help')}</T></Banner>
        <BigButton icon="home" label={t('common.home')} onPress={() => router.back()} />
      </Screen>
    );

  return (
    <Screen title={t('home.report')}>
      <T kind="label">{t('report.what')}</T>
      {kinds.map((k) => <BigButton key={k} label={t(`report.kind.${k}`)} tone={kind === k ? 'primary' : 'plain'} icon={kind === k ? 'check' : undefined} onPress={() => setKind(k)} />)}
      {kind && (
        <Card>
          <T kind="label">{t('report.describe')}</T>
          <TextInput value={summary} onChangeText={setSummary} multiline accessibilityLabel="Popis" maxLength={1000}
            style={{ minHeight: 120, borderWidth: 2, borderColor: colors.rule, borderRadius: 12, padding: space.m, fontFamily: fonts.regular, fontSize: 20, textAlignVertical: 'top' }} />
          <T kind="label">{t('report.noMedical')}</T>
          <BigButton label={urgent ? t('report.urgent') : t('report.markUrgent')} icon={urgent ? 'check' : 'alert'} tone={urgent ? 'danger' : 'plain'} onPress={() => setUrgent(!urgent)} />
          {state === 'error' && <Banner kind="bad" title={t('report.failed')}><T>{t('report.failed.help')}</T></Banner>}
          <View>
            <BigButton label="Odeslat" icon="arrow" tone="primary" onPress={send} disabled={summary.trim().length < 3 || state === 'sending'} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
