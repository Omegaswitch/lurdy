import { Linking, View } from 'react-native';
import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import { BigButton, Card, Screen, T, NoData } from '../lib/ui';

const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {}); // no phone app (tablet, desktop): the number is on screen

export default function Help() {
  const { data, t } = useStore();
  if (!data) return <NoData />;
  return (
    <Screen title={t('home.help')}>
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
      {/* emergency numbers last, set apart at the bottom of the screen */}
      <Card>
        <T kind="label">{t('help.emergency')}</T>
        <BigButton icon="phone" tone="danger" label="112" hint={t('help.eu112')} onPress={() => call('112')} />
        {data.edition.emergency_phone && (
          <BigButton icon="phone" tone="primary" label={data.edition.emergency_phone} hint={t('help.pilgrimageLine')} onPress={() => call(data.edition.emergency_phone!)} />
        )}
      </Card>
    </Screen>
  );
}
