import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radii, spacing, type } from '@/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface BrandButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function BrandButton({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
  accessibilityHint,
}: BrandButtonProps) {
  const inactive = loading || disabled;
  const palette = buttonPalettes[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        void onPress();
      }}
      style={({ pressed }) => [
          styles.base,
          compact ? styles.compact : styles.regular,
          { backgroundColor: palette.background, borderColor: palette.border },
          inactive && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} />
      ) : (
        <>
          {Icon ? <Icon color={palette.foreground} size={compact ? 18 : 20} strokeWidth={2.4} /> : null}
          <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonPalettes = {
  primary: { background: colors.lime, foreground: colors.brand900, border: colors.lime },
  secondary: { background: colors.lime, foreground: colors.brand900, border: colors.lime },
  ghost: { background: 'transparent', foreground: colors.white, border: colors.borderStrong },
  danger: { background: colors.redSoft, foreground: colors.red, border: colors.redSoft },
} satisfies Record<ButtonVariant, { background: string; foreground: string; border: string }>;

const styles = StyleSheet.create({
  base: {
    minHeight: layout.touchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  regular: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  compact: {
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...type.label,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.98 }],
  },
});
