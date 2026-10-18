import { Linking, View } from 'react-native';
import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import { BigButton, Card, Screen, T } from '../lib/ui';

const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);

export default function Help() {
  const { data, t } = useStore();
  if (!data) return null;
  return (
    <Screen title={t('home.help')}>
      <Card>
        <T kind="label">{t('help.emergency')}</T>
        <BigButton icon="phone" tone="danger" label="112" hint="Evropské tísňové číslo" onPress={() => call('112')} />
        {data.edition.emergency_phone && (
          <BigButton icon="phone" tone="primary" label={data.edition.emergency_phone} hint="Nouzová linka pouti" onPress={() => call(data.edition.emergency_phone!)} />
        )}
      </Card>
      {data.carers.length > 0 && (
        <View style={{ gap: space.m }}>
          <T kind="title" accessibilityRole="header">Moji asistenti</T>
          {data.carers.map((c) => (
            <BigButton key={c.name} icon="heart" label={c.name} hint={c.phone ?? t(`care.${c.kind}`)} onPress={() => c.phone && call(c.phone)} disabled={!c.phone} />
          ))}
        </View>
      )}
      <T kind="title" accessibilityRole="header">{t('help.contacts')}</T>
      {data.contacts.map((c) => (
        <BigButton key={c.label + c.phone} icon="phone" label={c.label} hint={[c.name, c.phone].filter(Boolean).join(' · ')}
          tone={c.is_emergency ? 'primary' : 'plain'} onPress={() => c.phone && call(c.phone)} disabled={!c.phone} />
      ))}
    </Screen>
  );
}
