import { privacySections, privacyUpdated } from '../lib/privacy';
import { space } from '../lib/theme';
import { Card, Screen, T } from '../lib/ui';
import { View } from 'react-native';

// Readable without signing in: the app stores link to this page (on the web: /privacy).
export default function Privacy() {
  return (
    <Screen title="Ochrana soukromí">
      {privacySections.map((s) => (
        <Card key={s.title}>
          <T kind="title" accessibilityRole="header">{s.title}</T>
          <View style={{ gap: space.m }}>{s.body.map((p) => <T key={p}>{p}</T>)}</View>
        </Card>
      ))}
      <T kind="label">Platné od {new Date(privacyUpdated).toLocaleDateString('cs-CZ')}.</T>
    </Screen>
  );
}
