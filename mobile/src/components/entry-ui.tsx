import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { colors } from '@/theme/tokens';

export function EntryScreen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={styles.screen}>
      <Image source={require('../../assets/backgrounds/entry-auth-background.png')} contentFit="cover" contentPosition="center" style={StyleSheet.absoluteFill} />
      <SafeAreaView style={[styles.safe, style]}>{children}</SafeAreaView>
    </View>
  );
}

export function EntryBrand({ size = 94 }: { size?: number }) {
  return <View style={styles.brand}><AppLogo size={size} elevated /><Text style={styles.wordmark}>Deal<Text style={styles.lime}>Up</Text></Text></View>;
}

export function EntryPrimaryButton({ label, onPress, icon = <ArrowRight size={21} color={colors.brand900} />, loading = false, style }: { label: string; onPress: () => void; icon?: ReactNode; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.buttonShell, pressed && styles.pressed, style]}>
      <LinearGradient colors={['#E4FF57', '#C5F52B', '#9EE61F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
        <View style={styles.iconSpacer} /><Text style={styles.buttonText}>{label}</Text><View style={styles.buttonIcon}>{loading ? <ActivityIndicator color={colors.brand900} /> : icon}</View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#001510' },
  safe: { flex: 1 },
  brand: { alignItems: 'center' },
  wordmark: { color: colors.white, fontSize: 31, lineHeight: 36, fontWeight: '700', letterSpacing: -1.2, marginTop: 5 },
  lime: { color: colors.lime },
  buttonShell: { minHeight: 64, borderRadius: 32, shadowColor: colors.lime, shadowOpacity: .34, shadowRadius: 22, shadowOffset: { width: 0, height: 6 } },
  buttonGradient: { flex: 1, minHeight: 64, borderRadius: 32, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center' },
  iconSpacer: { width: 28 },
  buttonText: { flex: 1, textAlign: 'center', color: colors.brand900, fontSize: 17, fontWeight: '700' },
  buttonIcon: { width: 28, alignItems: 'flex-end' },
  pressed: { opacity: .78, transform: [{ scale: .985 }] },
});
