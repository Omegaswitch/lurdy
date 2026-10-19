import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Shield } from '../lib/brand';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { colors, space } from '../lib/theme';
import { Banner, BigButton, Card, fmtDay, fmtTime, NoData, Screen, T } from '../lib/ui';

export default function Home() {
  const { ready, session, data, t, isStaff, refresh, scale, setScale, signOut } = useStore();
  // "Next on the programme" moves on by itself
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!ready) return <ActivityIndicator style={{ flex: 1 }} color={colors.red} />;
  if (!session) return <Redirect href="/login" />;
  if (!data) return <NoData />;

  const tz = data.edition.timezone;
  const next = data.events.find((e) => new Date(e.ends_at ?? e.starts_at).getTime() >= now);
  const critical = data.announcements.filter((a) => a.critical && !a.acked);
  const name = data.me ? (data.me.preferred_name || data.me.first_name) : '';

  async function ack(id: string) {
    await supabase.from('announcement_acks').insert({ announcement_id: id });
    refresh();
  }

  return (
    <Screen title={`${t('app.name')} ${data.edition.year}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.l }}>
        <Shield width={48} />
        <View style={{ flex: 1 }}>
          {name ? <T kind="title" accessibilityRole="header">Dobrý den, {name}</T> : null}
          <T kind="label">{data.edition.title}</T>
        </View>
      </View>

      {critical.map((a) => (
        <Banner key={a.id} kind="warn" title={a.title}>
          {a.body ? <T>{a.body}</T> : null}
          <BigButton label="Přečetl(a) jsem" icon="check" onPress={() => ack(a.id)} />
        </Banner>
      ))}

      {next && (
        <Card>
          <T kind="label">{t('home.next')}</T>
          <T kind="huge">{fmtTime(next.starts_at, tz)}</T>
          <T kind="big">{next.title}</T>
          <T>{[fmtDay(next.starts_at, tz), next.location].filter(Boolean).join(' · ')}</T>
        </Card>
      )}

      {isStaff && (
        <>
          <BigButton icon="scan" label={t('home.scan')} tone="primary" onPress={() => router.push('/scan')} testID="go-scan" />
          <BigButton icon="flag" label={t('home.duty')} onPress={() => router.push('/duty')} />
        </>
      )}
      {!isStaff && data.in_care.length > 0 && <BigButton icon="heart" label={t('home.duty')} onPress={() => router.push('/duty')} />}
      <BigButton icon="bus" label={t('home.journey')} onPress={() => router.push('/journey')} testID="go-journey" />
      <BigButton icon="calendar" label={t('home.programme')} onPress={() => router.push('/programme')} />
      <BigButton icon="bed" label={t('home.room')} onPress={() => router.push('/room')} />
      <BigButton icon="map" label={t('home.map')} onPress={() => router.push('/map')} />
      <BigButton icon="qr" label={t('home.badge')} onPress={() => router.push('/badge')} />
      <BigButton icon="phone" label={t('home.help')} tone="danger" onPress={() => router.push('/help')} />
      {data.roles.length > 0 && <BigButton icon="alert" label={t('home.report')} onPress={() => router.push('/report')} />}

      <View style={{ gap: space.m, marginTop: space.xl }}>
        <BigButton icon="text" label={scale > 1 ? 'Běžné písmo' : 'Větší písmo'} onPress={() => setScale(scale > 1 ? 1 : 1.3)} />
        <BigButton icon="lock" label="Účet a soukromí" onPress={() => router.push('/account')} />
        <BigButton icon="logout" label={t('common.signOut')} onPress={signOut} />
      </View>
    </Screen>
  );
}
