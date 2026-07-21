import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Check, Copy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { LimeButton } from '@/components/reference-ui';
import { colors } from '@/theme/tokens';

export function CopyMessageButton({
  message,
  onCopied,
  style,
}: {
  message: string;
  onCopied?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCopied?.();
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <LimeButton
      label={copied ? 'Message copié' : 'Copier le message'}
      icon={copied
        ? <Check size={18} color={colors.brand900} strokeWidth={3} />
        : <Copy size={17} color={colors.brand900} />}
      onPress={() => void copy()}
      style={style}
    />
  );
}
