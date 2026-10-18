import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import LourdesMap, { type MapPlace } from '../components/LourdesMap';
import { useStore } from '../lib/store';
import { colors, space } from '../lib/theme';
import { Banner, BigButton, Card, Screen, T } from '../lib/ui';

// OpenStreetMap's standard tiles; set EXPO_PUBLIC_MAP_TILES to another provider for heavy use (OSM tile usage policy).
const TILES = process.env.EXPO_PUBLIC_MAP_TILES ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180, R = 6371e3;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r;
  return Math.round(Math.sqrt(x * x + y * y) * R);
};

// Hands over to the phone's own maps app for walking directions.
function navigate(p: MapPlace, me: { lat: number; lng: number } | null) {
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=w`,
    android: `geo:0,0?q=${p.lat},${p.lng}(${encodeURIComponent(p.name)})`,
    default: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${me ? `${me.lat},${me.lng}` : ''};${p.lat},${p.lng}`,
  });
  Linking.openURL(url);
}

export default function MapScreen() {
  const { data, t } = useStore();
  const params = useLocalSearchParams<{ place?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(params.place ?? null);
  const [me, setMe] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState<'off' | 'asking' | 'on' | 'denied'>('off');
  const [follow, setFollow] = useState(0);

  const places = useMemo<MapPlace[]>(() => {
    const list: MapPlace[] = (data?.places ?? []).filter((p) => p.lat != null && p.lng != null && p.kind !== 'transport')
      .map((p) => ({ id: p.id, name: p.name, lat: p.lat!, lng: p.lng! }));
    const a = data?.accommodation;
    if (a?.lat != null && a.lng != null) list.unshift({ id: 'home', name: `${a.facility} (vaše ubytování)`, lat: a.lat, lng: a.lng, home: true });
    return list;
  }, [data]);

  // Live position: only after the person asks, only while this screen is open, never sent anywhere.
  useEffect(() => {
    if (locating !== 'on') return;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5 }, (pos) =>
      setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 30 }),
    ).then((s) => { sub = s; });
    return () => sub?.remove();
  }, [locating]);

  async function locate() {
    if (locating === 'on') return setFollow((n) => n + 1);
    setLocating('asking');
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setLocating(granted ? 'on' : 'denied');
    if (granted) setTimeout(() => setFollow((n) => n + 1), 1500);
  }

  const onSelect = useCallback(async (id: string) => setSelectedId(id), []);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const usedByProgramme = new Set((data?.events ?? []).map((e) => e.place_id));

  return (
    <Screen title={t('home.map')}>
      <View style={{ height: 380, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
        <LourdesMap places={places} me={me} selectedId={selectedId} followMe={follow} tileUrl={TILES} onSelect={onSelect}
          dom={{ style: { flex: 1 }, scrollEnabled: false }} />
      </View>
      <BigButton icon="locate" label={locating === 'on' ? 'Ukázat, kde jsem' : 'Zapnout moji polohu'}
        hint="Poloha zůstane jen ve vašem telefonu" onPress={locate} disabled={locating === 'asking'} />
      {locating === 'denied' && <Banner kind="info" title="Poloha je vypnutá"><T>Mapa funguje i bez ní. Polohu lze povolit v nastavení telefonu.</T></Banner>}

      {selected && (
        <Card>
          <T kind="title">{selected.name}</T>
          {(() => {
            const p = data?.places.find((x) => x.id === selected.id);
            return (
              <>
                {p?.description ? <T>{p.description}</T> : null}
                {p?.accessibility ? <T><T kind="label">Bezbariérovost: </T>{p.accessibility}</T> : null}
                {p?.directions ? <T>{p.directions}</T> : null}
              </>
            );
          })()}
          {me && <T kind="label">Vzdušnou čarou asi {metres(me, selected)} m</T>}
          <BigButton icon="navigation" label="Navigovat" hint="Otevře mapy v telefonu (pěšky)" tone="primary" onPress={() => navigate(selected, me)} />
        </Card>
      )}

      <T kind="title" accessibilityRole="header">Místa</T>
      {places.map((p) => (
        <BigButton key={p.id} icon={p.home ? 'bed' : 'map'} label={p.name}
          hint={usedByProgramme.has(p.id) ? 'V programu pouti' : undefined}
          tone={p.id === selectedId ? 'primary' : 'plain'} onPress={() => setSelectedId(p.id)} />
      ))}
      <T kind="label" style={{ marginTop: space.l }}>Mapové podklady © přispěvatelé OpenStreetMap.</T>
    </Screen>
  );
}
