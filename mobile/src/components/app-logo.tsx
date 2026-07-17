import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radii, shadows } from '@/theme/tokens';

interface AppLogoProps {
  size?: number;
  elevated?: boolean;
}

export function AppLogo({ size = 72, elevated = false }: AppLogoProps) {
  return (
    <View style={[styles.shell, { width: size, height: size, borderRadius: size * 0.24 }, elevated && shadows.floating]}>
      <Image
        source={require('../../assets/images/dealup-app-icon.png')}
        style={[styles.image, { width: size, height: size, borderRadius: size * 0.24 }]}
        contentFit="cover"
        accessibilityLabel="Logo DealUp"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderRadius: radii.lg,
  },
  image: { backgroundColor: 'transparent' },
});
