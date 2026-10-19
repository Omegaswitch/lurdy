import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import { Banner, BigButton, Card, Screen, T } from '../lib/ui';

// Account and privacy: the privacy notice and deleting one's own account (required by both app stores).
// Two steps, big buttons, plain words; nothing happens on the first tap.
export default function Account() {
  const { session, deleteAccount, t } = useStore();
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'failed'>('idle');
  if (!session) return <Redirect href="/login" />;

  async function remove() {
    setStep('busy');
    const ok = await deleteAccount();
    if (ok) router.replace('/login');
    else setStep('failed');
  }

  return (
    <Screen title={t('account.title')}>
      <BigButton icon="lock" label={t('account.privacy')} hint={t('account.privacy.hint')} onPress={() => router.push('/privacy')} />
      <Card>
        <T kind="title" accessibilityRole="header">{t('account.delete')}</T>
        <T>{t('account.delete.what')}</T>
        <T>Údaje o vaší účasti na pouti (autobus, ubytování) mají organizátoři; smažou je na vaši žádost nebo po skončení ročníku. Tištěná jmenovka platí, dokud ji organizátoři nezruší.</T>
        {step === 'failed' && (
          <Banner kind="bad" title={t('account.delete.failed')}>
            <T>{t('account.delete.failed.help')}</T>
          </Banner>
        )}
        {step === 'idle' || step === 'failed' ? (
          <BigButton icon="trash" label={t('account.delete')} tone="danger" onPress={() => setStep('confirm')} testID="delete-account" />
        ) : (
          <View style={{ gap: space.m }}>
            <Banner kind="warn" title={t('account.delete.confirm')}><T>{t('account.delete.irreversible')}</T></Banner>
            <BigButton icon="trash" label={t('account.delete.yes')} tone="danger" onPress={remove} disabled={step === 'busy'} testID="delete-account-confirm" />
            <BigButton icon="x" label="Ne, ponechat" onPress={() => setStep('idle')} disabled={step === 'busy'} />
          </View>
        )}
      </Card>
    </Screen>
  );
}
