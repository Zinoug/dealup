import { AlertCircle, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/app-store';

export function AppErrorToast() {
  const { error, clearError } = useAppStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(clearError, 4200);
    return () => clearTimeout(timeout);
  }, [clearError, error]);

  if (!error) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutUp.duration(160)}
      pointerEvents="box-none"
      style={[styles.toast, { top: insets.top + 10 }]}
    >
      <AlertCircle color="#FFD6D1" size={17} />
      <Text numberOfLines={3} style={styles.text}>{error}</Text>
      <Pressable accessibilityLabel="Fermer le message" hitSlop={10} onPress={clearError}>
        <X color="#FFD6D1" size={16} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    zIndex: 100,
    left: 18,
    right: 18,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(64,16,14,.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,108,.34)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flex: 1, color: '#FFF4F2', fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
