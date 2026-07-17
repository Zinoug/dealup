import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandBackground } from '@/components/brand-background';
import { colors, layout } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  backgroundColor?: string;
}

export function Screen({
  children,
  scroll = false,
  style,
  contentStyle,
  keyboard = false,
  edges = ['top', 'right', 'bottom', 'left'],
  backgroundColor = colors.brand900,
}: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor }, style]}>
      {backgroundColor === colors.brand900 ? <BrandBackground variant="soft" /> : null}
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: layout.contentMax, alignSelf: 'center' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: layout.contentMax, alignSelf: 'center' },
});
