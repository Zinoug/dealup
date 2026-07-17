import { Laptop, Smartphone } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/theme/tokens';
import type { DeviceCategory } from '@/types/domain';

export function DeviceThumbnail({ category, size = 64 }: { category?: DeviceCategory | null; size?: number }) {
  const Icon = category === 'MACBOOK' ? Laptop : Smartphone;
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: Math.min(radii.md, size * 0.22) }]}>
      <Icon size={size * 0.46} color={colors.lime} strokeWidth={1.7} />
      <Text style={styles.label}>{category === 'MACBOOK' ? 'MAC' : 'IPHONE'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196,245,42,.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.lime, fontSize: 6, fontWeight: '800', letterSpacing: 0.7, marginTop: 3 },
});
