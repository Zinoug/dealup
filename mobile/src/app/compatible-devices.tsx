import { Image, type ImageSource } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { compatibleDevicesFallback } from '@/data/compatible-devices';
import { dealupApi } from '@/services/dealup-api';
import { colors, layout, shadows } from '@/theme/tokens';
import type { CompatibleDeviceCategory, CompatibleDevicesCatalog } from '@/types/domain';

const images: Record<'IPHONE' | 'MACBOOK', ImageSource> = {
  IPHONE: require('../../assets/devices/iphone-family-apple.webp'),
  MACBOOK: require('../../assets/devices/macbook-family-apple.webp'),
};

export default function CompatibleDevicesScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const [catalog, setCatalog] = useState<CompatibleDevicesCatalog>(compatibleDevicesFallback);
  const [selected, setSelected] = useState<CompatibleDeviceCategory | null>(null);
  useEffect(() => { void dealupApi.compatibleDevices().then(setCatalog).catch(() => undefined); }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.header}><Pressable accessibilityLabel="Retour" hitSlop={10} onPress={() => router.back()} style={styles.back}><ArrowLeft color={colors.lightInk} size={23} /></Pressable><Text style={styles.headerTitle}>Appareils compatibles</Text><View style={styles.headerSpacer} /></View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {status ? <View style={styles.notice}><Text style={styles.noticeTitle}>Cet appareil n’est pas encore pris en charge</Text></View> : null}
        <Text style={styles.title}>Les appareils que DealUp sait analyser.</Text>
        <Text style={styles.subtitle}>Deux familles Apple pour commencer, avec des vérifications adaptées à chacune.</Text>
        <View style={styles.cards}>
          {catalog.categories.map((category) => (
            <Pressable key={category.code} onPress={() => setSelected(category)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.visual}><Image contentFit="contain" source={images[category.code]} style={StyleSheet.absoluteFill} /></View>
              <View style={styles.cardBottom}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{category.label}</Text><Text style={styles.range}>{category.supportedRange}</Text></View><ChevronRight color={colors.brand700} size={22} /></View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.soon}>Télephones Android, iPad, Apple Watch arrivent bientôt.</Text>
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setSelected(null)} presentationStyle="pageSheet" visible={Boolean(selected)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>Appareils compatibles</Text><Text style={styles.modalTitle}>{selected?.label}</Text></View><Pressable accessibilityLabel="Fermer" onPress={() => setSelected(null)} style={styles.close}><X color={colors.lightInk} size={21} /></Pressable></View>
          <View style={styles.modalVisual}>{selected ? <Image contentFit="contain" source={images[selected.code]} style={StyleSheet.absoluteFill} /> : null}</View>
          <View style={styles.models}>{selected?.models.map((model) => <View key={model} style={styles.model}><View style={styles.check}><Check color={colors.brand900} size={14} strokeWidth={3} /></View><Text style={styles.modelText}>{model}</Text></View>)}</View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.lightSurface },
  header: { height: 54, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.lightInk, fontSize: 15, fontWeight: '700' },
  headerSpacer: { width: 44 },
  body: { paddingHorizontal: layout.gutter, paddingTop: 14, paddingBottom: 35 },
  notice: { borderRadius: 16, backgroundColor: '#FFF2D9', borderWidth: 1, borderColor: '#F0D4A2', padding: 14, marginBottom: 20 },
  noticeTitle: { color: '#8C5712', fontSize: 13, fontWeight: '700' },
  noticeBody: { color: '#8B7351', fontSize: 11, marginTop: 4 },
  title: { color: colors.lightInk, fontSize: 29, lineHeight: 34, fontWeight: '700', letterSpacing: -.8 },
  subtitle: { color: colors.lightMuted, fontSize: 14, lineHeight: 20, marginTop: 9 },
  cards: { gap: 14, marginTop: 25 },
  card: { borderRadius: 25, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E3DC', ...shadows.subtle },
  pressed: { opacity: .7, transform: [{ scale: .993 }] },
  visual: { height: 194, backgroundColor: '#F2F4ED' },
  cardBottom: { minHeight: 84, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.lightInk, fontSize: 20, fontWeight: '700' },
  range: { color: colors.lightMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  soon: { color: '#7B857F', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 22, paddingHorizontal: 12 },
  modalSafe: { flex: 1, backgroundColor: colors.lightSurface, paddingHorizontal: layout.gutter },
  modalHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalEyebrow: { color: colors.lightMuted, fontSize: 12, fontWeight: '600' },
  modalTitle: { color: colors.lightInk, fontSize: 26, fontWeight: '700', marginTop: 2 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lightBorder },
  modalVisual: { height: 245, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F0F2EA', marginTop: 10 },
  models: { marginTop: 22, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.lightBorder, paddingHorizontal: 16 },
  model: { minHeight: 57, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lightBorder, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  modelText: { flex: 1, color: colors.lightInk, fontSize: 14, lineHeight: 19 },
  modalNote: { color: colors.lightMuted, fontSize: 12, textAlign: 'center', marginTop: 18 },
});
