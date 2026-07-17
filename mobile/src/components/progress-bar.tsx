import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';
import { clamp } from '@/utils/format';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  detail?: string;
  tone?: 'brand' | 'amber';
}

export function ProgressBar({ value, max, label, detail, tone = 'brand' }: ProgressBarProps) {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
  return (
    <View style={styles.wrapper} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      {label || detail ? (
        <View style={styles.labels}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
      ) : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: tone === 'amber' ? colors.amber : colors.brand500 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  label: { ...type.small, color: colors.ink, fontWeight: '600' },
  detail: { ...type.caption, color: colors.inkMuted },
  track: { height: 8, borderRadius: radii.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.pill },
});
