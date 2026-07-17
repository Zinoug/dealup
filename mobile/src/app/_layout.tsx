import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppStoreProvider } from '@/store/app-store';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <AppStoreProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.brand900 },
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="paywall" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="analysis-progress" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="analysis/[id]" options={{ animation: 'fade' }} />
      </Stack>
      <StatusBar style="light" />
    </AppStoreProvider>
  );
}
