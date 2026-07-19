import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check, Heart, History, Home, UserRound } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBackground, type BrandBackgroundVariant } from '@/components/brand-background';
import { colors, layout, radii, shadows, spacing, type } from '@/theme/tokens';

export type BackgroundVariant = Exclude<BrandBackgroundVariant, 'light'>;

export function DarkBackground({ children, style, variant = 'soft' }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; variant?: BackgroundVariant }>) {
  return (
    <View style={[styles.flex, styles.dark, style]}>
      <BrandBackground variant={variant} />
      {children}
    </View>
  );
}

export function DarkSafeScreen({ children, style, edges = ['top', 'left', 'right', 'bottom'], variant = 'soft' }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; edges?: ('top' | 'left' | 'right' | 'bottom')[]; variant?: BackgroundVariant }>) {
  return <DarkBackground variant={variant}><SafeAreaView edges={edges} style={[styles.flex, style]}>{children}</SafeAreaView></DarkBackground>;
}

export function BrandLockup({ compact = false, centered = false }: { compact?: boolean; centered?: boolean }) {
  const size = compact ? 52 : 76;
  return (
    <View style={[styles.brand, centered && styles.brandCentered]}>
      <View style={{ width: size, height: size, borderRadius: compact ? 15 : 21, overflow: 'hidden' }}>
        <Image source={require('../../assets/images/dealup-app-icon.png')} style={{ width: size, height: size }} contentFit="contain" />
      </View>
      <Text style={[styles.brandText, !compact && styles.brandTextLarge]}>Deal<Text style={styles.lime}>Up</Text></Text>
    </View>
  );
}

export function GlassCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <LinearGradient colors={['rgba(11,58,44,.91)', 'rgba(3,31,24,.88)', 'rgba(0,20,16,.82)']} locations={[0, .58, 1]} style={[styles.card, style]}>{children}</LinearGradient>;
}

export function LimeButton({ label, onPress, icon, style }: { label: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.limeButton, shadows.floating, pressed && styles.pressed, style]}>
      <Text style={styles.limeButtonText}>{label}</Text>{icon}
    </Pressable>
  );
}

export function DarkHeader({ title, back = true, right }: { title?: string; back?: boolean; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {back ? <Pressable onPress={() => router.back()} style={styles.headerButton}><ArrowLeft size={22} color={colors.white} /></Pressable> : <View style={styles.headerButton} />}
      <Text style={styles.headerTitle}>{title}</Text><View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function TinyCheck({ dim = false, warning = false }: { dim?: boolean; warning?: boolean }) {
  return <View style={[styles.tinyCheck, dim && styles.tinyDim, warning && styles.tinyWarning]}><Check size={12} color={warning ? colors.amber : colors.brand900} strokeWidth={3} /></View>;
}

export function BottomDock({ dark = true }: { dark?: boolean }) {
  return (
    <View style={styles.dockShell} pointerEvents="box-none">
      <BlurView intensity={dark ? 28 : 45} tint={dark ? 'dark' : 'light'} style={[styles.dock, dark ? styles.dockDark : styles.dockLight]}>
        <DockItem icon={<Home size={25} color={colors.lime} />} active />
        <DockItem icon={<History size={25} color={dark ? '#87A699' : '#3D463F'} />} />
        <DockItem icon={<Heart size={25} color={dark ? '#87A699' : '#3D463F'} />} />
        <DockItem icon={<UserRound size={25} color={dark ? '#87A699' : '#3D463F'} />} />
      </BlurView>
    </View>
  );
}

function DockItem({ icon, active = false }: { icon: ReactNode; active?: boolean }) {
  return <View style={[styles.dockItem, active && styles.dockActive]}>{icon}{active ? <View style={styles.dockLine} /> : null}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, dark: { backgroundColor: colors.brand900 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, brandCentered: { justifyContent: 'center' },
  brandText: { color: colors.white, fontSize: 34, fontWeight: '700', letterSpacing: -1.3 }, brandTextLarge: { fontSize: 42 }, lime: { color: colors.lime },
  card: { backgroundColor: 'rgba(5,39,30,0.82)', borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  limeButton: { minHeight: 54, borderRadius: 13, backgroundColor: colors.lime, paddingHorizontal: spacing.lg, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  limeButtonText: { ...type.label, color: colors.brand900 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  header: { minHeight: 50, paddingHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }, headerRight: { width: 44, alignItems: 'flex-end' },
  headerTitle: { ...type.label, color: colors.white },
  tinyCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, tinyDim: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand500 }, tinyWarning: { backgroundColor: 'transparent', borderColor: colors.amber },
  dockShell: { position: 'absolute', left: 18, right: 18, bottom: 10 }, dock: { height: 72, borderRadius: 36, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: colors.border }, dockDark: { backgroundColor: 'rgba(3,48,34,0.74)' }, dockLight: { backgroundColor: 'rgba(248,248,242,0.76)', borderColor: 'rgba(90,100,92,0.18)' },
  dockItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, dockActive: { backgroundColor: 'rgba(143,255,57,0.08)' }, dockLine: { position: 'absolute', bottom: 4, width: 28, height: 3, borderRadius: 2, backgroundColor: colors.lime },
});
