import { Asap_400Regular, Asap_500Medium, Asap_600SemiBold, Asap_700Bold, useFonts } from '@expo-google-fonts/asap';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StoreProvider, useStore } from '../lib/store';
import { colors, fonts } from '../lib/theme';

// Everything but the sign-in and the privacy notice needs a session: a deep link (web) or a cold start lands on
// the sign-in screen instead of an empty page.
function Routes() {
  const { session } = useStore();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.red },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 22 },
        headerBackTitle: 'Zpět',
        contentStyle: { backgroundColor: colors.ground },
      }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" />
      <Stack.Protected guard={!!session}>
        {['index', 'journey', 'programme', 'room', 'help', 'badge', 'scan', 'duty', 'report', 'map', 'account'].map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Asap_400Regular, Asap_500Medium, Asap_600SemiBold, Asap_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.red }} />;
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Routes />
    </StoreProvider>
  );
}
