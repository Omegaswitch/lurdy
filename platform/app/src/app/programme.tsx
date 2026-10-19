import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useStore } from '../lib/store';
import { colors, space, touch } from '../lib/theme';
import { Card, Empty, fmtTime, Icon, Screen, T, NoData } from '../lib/ui';

export default function Programme() {
  const { data, t } = useStore();
  const tz = data?.edition.timezone ?? 'Europe/Paris';
  const dayOf = (iso: string) => new Intl.DateTimeFormat('cs-CZ', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(iso));
  const days = useMemo(() => [...new Set((data?.events ?? []).map((e) => dayOf(e.starts_at)))], [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = dayOf(new Date().toISOString());
  const [picked, setDay] = useState<string | null>(null);
  const day = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0]; // data may arrive after mount
  if (!data) return <NoData />;
  const events = data.events.filter((e) => dayOf(e.starts_at) === day);
  return (
    <Screen title={t('home.programme')}>
      {days.length === 0 ? <Empty>{t('programme.empty')}</Empty> : (
        <>
          <ScrollView horizontal contentContainerStyle={{ gap: space.s }} accessibilityRole="tablist">
            {days.map((d) => (
              <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="tab" accessibilityState={{ selected: d === day }}
                style={{ minHeight: touch, paddingHorizontal: space.l, justifyContent: 'center', borderRadius: 32, borderWidth: 2,
                  borderColor: d === day ? colors.red : colors.rule, backgroundColor: d === day ? colors.red : colors.surface }}>
                <T kind="big" style={{ color: d === day ? '#fff' : colors.ink }}>{d}</T>
              </Pressable>
            ))}
          </ScrollView>
          {events.map((e) => {
            const place = data.places.find((p) => p.id === e.place_id);
            return (
              <Card key={e.id}>
                <View style={{ flexDirection: 'row', gap: space.l }}>
                  <T kind="big" style={{ width: 72 }}>{fmtTime(e.starts_at, tz)}</T>
                  <View style={{ flex: 1, gap: space.xs }}>
                    <T kind="big">{e.title}</T>
                    {e.location ? <T>{e.location}</T> : null}
                    {e.description ? <T>{e.description}</T> : null}
                    {e.changed && (
                      <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
                        <Icon name="alert" color={colors.warn} size={22} /><T kind="label" style={{ color: colors.warn }}>{t('programme.changed')}</T>
                      </View>
                    )}
                    {place && (
                      <Pressable onPress={() => router.push({ pathname: '/map', params: { place: place.id } })} accessibilityRole="button"
                        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                        <Icon name="map" color={colors.redStrong} size={24} />
                        <T kind="label" style={{ color: colors.redStrong }}>Ukázat na mapě</T>
                      </Pressable>
                    )}
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
