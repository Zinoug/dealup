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
  const scale = size / 236;
  const strokeWidth = 17 * scale;
  const radius = (size - 32) / 2;
  const circumference = 2 * Math.PI * radius;
  const visibleArc = circumference * 0.75;
  const fraction = clamp(score, 0, 100) / 100;
  const progress = visibleArc * fraction;
  const color = score >= 75 ? colors.brand500 : score >= 55 ? colors.amber : colors.red;
  const endAngle = (135 + 270 * fraction) * (Math.PI / 180);
  const endX = size / 2 + radius * Math.cos(endAngle);
  const endY = size / 2 + radius * Math.sin(endAngle);

  return (
    <View style={[styles.wrapper, { width: size, height: size * 0.88 }]} accessibilityLabel={`${label} ${score} sur 100`}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeOpacity={0.12}
          strokeWidth={31 * scale}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          rotation="135"
          origin={`${size / 2}, ${size / 2}`}
        />
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
        {fraction > 0 ? (
          <>
            <Circle cx={endX} cy={endY} r={13 * scale} fill={color} fillOpacity={0.13} />
            <Circle cx={endX} cy={endY} r={7 * scale} fill={color} fillOpacity={0.34} />
            <Circle cx={endX} cy={endY} r={3.5 * scale} fill="#EEFF8B" />
            <Circle cx={endX - 7 * scale} cy={endY - 9 * scale} r={Math.max(1, 1.6 * scale)} fill="#F8FFD0" fillOpacity={0.92} />
          </>
        ) : null}
      </Svg>
      <View style={styles.copy}>
        {label ? <Text style={[styles.label, { fontSize: Math.max(8, 12 * scale), lineHeight: Math.max(11, 16 * scale) }]}>{label}</Text> : null}
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { fontSize: 62 * scale, lineHeight: 66 * scale, letterSpacing: -2 * scale }]}>{score}</Text>
          <Text style={[styles.over, { fontSize: Math.max(10, 16 * scale), lineHeight: Math.max(14, 22 * scale) }]}>/100</Text>
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
