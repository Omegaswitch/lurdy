import { router } from 'expo-router';
import { useStore } from '../lib/store';
import { BigButton, Card, Empty, Field, Screen, T } from '../lib/ui';

export default function Room() {
  const { data, t } = useStore();
  if (!data) return null;
  const a = data.accommodation;
  return (
    <Screen title={t('home.room')}>
      {!a ? <Empty>{t('room.none')}</Empty> : (
        <>
          <Card>
            <T kind="title">{a.facility}</T>
            {a.address ? <T>{a.address}</T> : null}
            <Field label={t('room.room')} value={<T kind="huge">{a.room}</T>} />
            {a.floor ? <Field label={t('room.floor')} value={a.floor} /> : null}
            {a.zone ? <Field label="Zóna" value={a.zone} /> : null}
            {a.note ? <T>{a.note}</T> : null}
          </Card>
          {a.lat != null && a.lng != null && <BigButton icon="map" label={t('home.map')} onPress={() => router.push('/map')} />}
        </>
      )}
    </Screen>
  );
}
