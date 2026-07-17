import type { LucideIcon } from 'lucide-react-native';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';

interface OptionRowProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
  badge?: string;
}

export function OptionRow({ title, description, icon: Icon, selected, onPress, badge }: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      {Icon ? (
        <View style={[styles.iconShell, selected && styles.iconSelected]}>
          <Icon color={selected ? colors.brand900 : colors.inkMuted} size={22} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        </View>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Check size={16} color={colors.brand900} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selected: { borderColor: colors.lime, backgroundColor: 'rgba(73, 128, 60, 0.18)' },
  pressed: { opacity: 0.72 },
  iconShell: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.ivory, alignItems: 'center', justifyContent: 'center' },
  iconSelected: { backgroundColor: colors.lime },
  copy: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...type.bodyStrong, color: colors.ink },
  description: { ...type.small, color: colors.inkMuted },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.lime, borderColor: colors.brand600 },
  badge: { ...type.caption, color: colors.brand800, backgroundColor: colors.lime, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radii.pill },
});
