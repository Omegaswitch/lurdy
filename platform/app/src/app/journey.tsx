import { View } from 'react-native';
import { useStore } from '../lib/store';
import { colors, space } from '../lib/theme';
import { Card, Empty, Field, fmtDay, fmtTime, Icon, Screen, T } from '../lib/ui';

export default function Journey() {
  const { data, t } = useStore();
  if (!data) return null;
  const tz = data.edition.timezone;
  return (
    <Screen title={t('home.journey')}>
      {data.legs.length === 0 && <Empty>{t('journey.none')}</Empty>}
      {(['outbound', 'local', 'return'] as const).map((dir) => {
        const legs = data.legs.filter((l) => l.direction === dir);
        if (!legs.length) return null;
        return (
          <View key={dir} style={{ gap: space.m }}>
            <T kind="title" accessibilityRole="header">{t(`direction.${dir}`)}</T>
            {legs.map((l) => (
              <Card key={l.leg_id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                  <Icon name="bus" size={34} />
                  <T kind="huge" testID={`leg-${l.kind}`}>{t(`leg.${l.kind}`)} {l.code}</T>
                </View>
                {l.label ? <T kind="big">{l.label}</T> : null}
                {(l.origin || l.destination) && <T>{[l.origin, l.destination].filter(Boolean).join(' → ')}</T>}
                {l.departs_at && <Field label="Odjezd" value={`${fmtDay(l.departs_at, tz)} ${fmtTime(l.departs_at, tz)}`} />}
                {l.meeting_point && <Field label={t('journey.meeting')} value={`${l.meeting_point}${l.meeting_at ? ` · ${fmtTime(l.meeting_at, tz)}` : ''}`} />}
                {l.responsible && <Field label={t('journey.responsible')} value={l.responsible} />}
                {l.note ? <T>{l.note}</T> : null}
                {l.boarded_at && (
                  <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
                    <Icon name="check" color={colors.ok} /><T kind="big" style={{ color: colors.ok }}>{t('journey.boarded')}</T>
                  </View>
                )}
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
