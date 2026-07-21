import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { AppStoreProvider } from '@/store/app-store';
import { AppErrorToast } from '@/components/app-error-toast';
import { colors } from '@/theme/tokens';
import { ensureDailyReminderIfAuthorized } from '@/services/notifications';
import { missingRequiredConfiguration, runtime } from '@/services/runtime';

Sentry.init({
  dsn: runtime.sentryDsn,
  enabled: Boolean(runtime.sentryDsn),
  environment: runtime.appEnv,
  sendDefaultPii: false,
  tracesSampleRate: runtime.appEnv === 'production' ? 0.1 : 0,
});

function LocalReminderBootstrap() {
  useEffect(() => {
    void ensureDailyReminderIfAuthorized();
  }, []);

  return null;
}

function RootLayout() {
  const missing = missingRequiredConfiguration();
  if (missing.length) {
    return (
      <View style={styles.configurationError}>
        <Text style={styles.configurationTitle}>Configuration incomplète</Text>
        <Text style={styles.configurationBody}>Ajoute {missing.join(' et ')} dans mobile/.env puis reconstruis l’application.</Text>
      </View>
    );
  }
  return (
    <ClerkProvider publishableKey={runtime.clerkPublishableKey} tokenCache={tokenCache}>
      <AppStoreProvider>
        <LocalReminderBootstrap />
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
          <Stack.Screen name="auth" options={{ presentation: 'card', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="paywall" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="analysis-progress" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="analysis/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
        <AppErrorToast />
        <StatusBar style="light" />
      </AppStoreProvider>
    </ClerkProvider>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  configurationError: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colors.brand900 },
  configurationTitle: { color: colors.white, fontSize: 24, fontWeight: '700' },
  configurationBody: { color: '#B7C7BF', fontSize: 15, lineHeight: 22, marginTop: 10 },
});
