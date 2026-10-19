import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, fonts, space } from '../lib/theme';
import { Banner, BigButton, Card, Screen, T, NoData } from '../lib/ui';

const kinds = [
  { kind: 'missing_person', label: 'Někdo chybí' },
  { kind: 'care', label: 'Péče o nemocného' },
  { kind: 'medical', label: 'Zdravotní problém' },
  { kind: 'operational', label: 'Doprava, ubytování, organizace' },
  { kind: 'other', label: 'Jiné' },
] as const;

export default function Report() {
  const { data, t } = useStore();
  const [kind, setKind] = useState<(typeof kinds)[number]['kind'] | null>(null);
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
        <Banner kind="ok" title="Odesláno"><T>Organizátoři a zodpovědní lidé hlášení vidí. V naléhavém případě volejte.</T></Banner>
        <BigButton icon="home" label="Domů" onPress={() => router.back()} />
      </Screen>
    );

  return (
    <Screen title={t('home.report')}>
      <T kind="label">Co se děje?</T>
      {kinds.map((k) => <BigButton key={k.kind} label={k.label} tone={kind === k.kind ? 'primary' : 'plain'} icon={kind === k.kind ? 'check' : undefined} onPress={() => setKind(k.kind)} />)}
      {kind && (
        <Card>
          <T kind="label">Krátce popište (kdo, kde)</T>
          <TextInput value={summary} onChangeText={setSummary} multiline accessibilityLabel="Popis" maxLength={1000}
            style={{ minHeight: 120, borderWidth: 2, borderColor: colors.rule, borderRadius: 12, padding: space.m, fontFamily: fonts.regular, fontSize: 20, textAlignVertical: 'top' }} />
          <T kind="label">Nepište sem diagnózy ani léky – jen co je potřeba, aby někdo mohl pomoci.</T>
          <BigButton label={urgent ? 'Naléhavé' : 'Označit jako naléhavé'} icon={urgent ? 'check' : 'alert'} tone={urgent ? 'danger' : 'plain'} onPress={() => setUrgent(!urgent)} />
          {state === 'error' && <Banner kind="bad" title="Neodesláno"><T>Zkontrolujte připojení a zkuste to znovu.</T></Banner>}
          <View>
            <BigButton label="Odeslat" icon="arrow" tone="primary" onPress={send} disabled={summary.trim().length < 3 || state === 'sending'} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
