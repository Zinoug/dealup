import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppLogo } from '@/components/app-logo';
import { Screen } from '@/components/screen';
import { useAppStore } from '@/store/app-store';
import { colors, spacing, type } from '@/theme/tokens';

export default function IndexScreen() {
  const { isReady, onboardingComplete, isSignedIn } = useAppStore();

  if (!isReady) {
    return (
      <Screen>
        <View style={styles.splash}>
          <AppLogo size={112} elevated />
          <Text style={styles.name}>DealUp</Text>
          <ActivityIndicator color={colors.lime} style={styles.loader} />
        </View>
      </Screen>
    );
  }

  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  if (!isSignedIn) return <Redirect href="/auth" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.h1, color: colors.white, marginTop: spacing.lg },
  loader: { marginTop: spacing.lg },
});
