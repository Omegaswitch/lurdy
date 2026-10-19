import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import { Banner, BigButton, Card, Screen, T } from '../lib/ui';

// Account and privacy: the privacy notice and deleting one's own account (required by both app stores).
// Two steps, big buttons, plain words; nothing happens on the first tap.
export default function Account() {
  const { session, deleteAccount } = useStore();
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'failed'>('idle');
  if (!session) return <Redirect href="/login" />;

  async function remove() {
    setStep('busy');
    const ok = await deleteAccount();
    if (ok) router.replace('/login');
    else setStep('failed');
  }

  return (
    <Screen title="Účet a soukromí">
      <BigButton icon="lock" label="Ochrana soukromí" hint="Jaké údaje aplikace používá" onPress={() => router.push('/privacy')} />
      <Card>
        <T kind="title" accessibilityRole="header">Smazat můj účet</T>
        <T>Smaže se váš přihlašovací účet a kód na obrazovce telefonu přestane platit. Se svým čtyřmístným kódem se už nepřihlásíte.</T>
        <T>Údaje o vaší účasti na pouti (autobus, ubytování) mají organizátoři; smažou je na vaši žádost nebo po skončení ročníku. Tištěná jmenovka platí, dokud ji organizátoři nezruší.</T>
        {step === 'failed' && (
          <Banner kind="bad" title="Účet se nepodařilo smazat">
            <T>Zkontrolujte připojení k internetu a zkuste to znovu, nebo se obraťte na organizátory.</T>
          </Banner>
        )}
        {step === 'idle' || step === 'failed' ? (
          <BigButton icon="trash" label="Smazat můj účet" tone="danger" onPress={() => setStep('confirm')} testID="delete-account" />
        ) : (
          <View style={{ gap: space.m }}>
            <Banner kind="warn" title="Opravdu smazat?"><T>Tento krok nejde vrátit zpět.</T></Banner>
            <BigButton icon="trash" label="Ano, smazat účet" tone="danger" onPress={remove} disabled={step === 'busy'} testID="delete-account-confirm" />
            <BigButton icon="x" label="Ne, ponechat" onPress={() => setStep('idle')} disabled={step === 'busy'} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
