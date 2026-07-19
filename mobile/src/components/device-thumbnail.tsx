import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { colors, radii } from '@/theme/tokens';

export function DeviceThumbnail({ uri, size = 64, label = 'Photo de l’annonce' }: { uri?: string | null; size?: number; label?: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) return null;
  return <Image accessibilityLabel={label} contentFit="cover" onError={() => setFailedUri(uri)} source={{ uri }} style={[styles.frame, { width: size, height: size, borderRadius: Math.min(radii.md, size * 0.22) }]} transition={180} />;
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
