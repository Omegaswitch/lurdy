import { Asap_400Regular, Asap_500Medium, Asap_600SemiBold, Asap_700Bold, useFonts } from '@expo-google-fonts/asap';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StoreProvider } from '../lib/store';
import { colors, fonts } from '../lib/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Asap_400Regular, Asap_500Medium, Asap_600SemiBold, Asap_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.red }} />;
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.red },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 22 },
          headerBackTitle: 'Zpět',
          contentStyle: { backgroundColor: colors.ground },
        }}
      />
    </StoreProvider>
  );
}
