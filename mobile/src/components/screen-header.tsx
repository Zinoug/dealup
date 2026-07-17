import { router } from 'expo-router';
import { ArrowLeft, MoreHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, spacing, type } from '@/theme/tokens';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
  compact?: boolean;
}

export function ScreenHeader({ title, subtitle, back = false, onBack, rightLabel, onRightPress, compact = false }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, compact && styles.compact]}>
      <View style={styles.topline}>
        {back ? (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Revenir en arrière"
            hitSlop={8}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.ink} size={22} strokeWidth={2.2} />
          </Pressable>
        ) : <View style={styles.spacer} />}
        {rightLabel && onRightPress ? (
          <Pressable
            onPress={onRightPress}
            accessibilityRole="button"
            accessibilityLabel={rightLabel}
            style={({ pressed }) => [styles.rightAction, pressed && styles.pressed]}
          >
            <Text style={styles.rightLabel}>{rightLabel}</Text>
          </Pressable>
        ) : onRightPress ? (
          <Pressable onPress={onRightPress} accessibilityRole="button" accessibilityLabel="Plus d’options" style={styles.iconButton}>
            <MoreHorizontal color={colors.ink} size={24} />
          </Pressable>
        ) : <View style={styles.spacer} />}
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingTop: spacing.xs, paddingBottom: spacing.lg, gap: spacing.xs },
  compact: { paddingBottom: spacing.md },
  topline: { minHeight: layout.touchTarget, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: layout.touchTarget, height: layout.touchTarget, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
  spacer: { width: layout.touchTarget },
  pressed: { opacity: 0.55 },
  rightAction: { minHeight: layout.touchTarget, justifyContent: 'center', paddingLeft: spacing.md },
  rightLabel: { ...type.small, color: colors.brand700, fontWeight: '700' },
  title: { ...type.h1, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted, maxWidth: 430 },
});
