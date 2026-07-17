import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, type } from '@/theme/tokens';
import { clamp } from '@/utils/format';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
}

export function ScoreGauge({ score, size = 236, label = 'Deal Score' }: ScoreGaugeProps) {
  const strokeWidth = 17;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const visibleArc = circumference * 0.75;
  const progress = visibleArc * (clamp(score, 0, 100) / 100);
  const color = score >= 75 ? colors.brand500 : score >= 55 ? colors.amber : colors.red;

  return (
    <View style={[styles.wrapper, { width: size, height: size * 0.88 }]} accessibilityLabel={`${label} ${score} sur 100`}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.border}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${visibleArc} ${circumference}`}
          rotation="135"
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          rotation="135"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.over}>/100</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute', top: 0 },
  copy: { alignItems: 'center', marginTop: 4 },
  label: { ...type.caption, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.9 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  score: { ...type.score, color: colors.ink },
  over: { ...type.bodyStrong, color: colors.inkMuted },
});
