import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock3, Laptop, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { compatibleDevicesCatalog } from '@/data/mock';
import { dealupApi } from '@/services/dealup-api';
import { colors, layout, type } from '@/theme/tokens';
import type { CompatibleDevicesCatalog } from '@/types/domain';

export default function CompatibleDevicesScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const [catalog, setCatalog] = useState<CompatibleDevicesCatalog>(compatibleDevicesCatalog);
  useEffect(() => { void dealupApi.compatibleDevices().then(setCatalog).catch(() => undefined); }, []);
  return (
    <DarkSafeScreen variant="tag" edges={['top', 'left', 'right']}>
      <DarkHeader title="Appareils compatibles" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {status ? <View style={styles.notice}><Text style={styles.noticeTitle}>Cet appareil n’est pas encore pris en charge</Text><Text style={styles.noticeBody}>Aucun abonnement ni quota n’a été consommé.</Text></View> : null}
        <Text style={styles.title}>Deux familles, une analyse vraiment spécialisée.</Text>
        <Text style={styles.subtitle}>DealUp applique des risques et une checklist différents selon l’appareil.</Text>
        <View style={styles.cards}>
          {catalog.categories.map((category) => {
            const Icon = category.code === 'MACBOOK' ? Laptop : Smartphone;
            return <GlassCard key={category.code} style={styles.card}><View style={styles.icon}><Icon size={30} color={colors.lime} /></View><View style={styles.copy}><Text style={styles.cardTitle}>{category.label}</Text><Text style={styles.range}>{category.supportedRange}</Text>{category.models.map((model) => <View key={model} style={styles.model}><Check size={13} color={colors.lime} /><Text style={styles.modelText}>{model}</Text></View>)}</View></GlassCard>;
          })}
        </View>
        <View style={styles.soon}><Clock3 size={18} color={colors.inkMuted} /><View><Text style={styles.soonTitle}>Pas encore compatibles</Text><Text style={styles.soonText}>{catalog.comingLater.join(' · ')}</Text></View></View>
        <LimeButton label="Analyser une annonce compatible" onPress={() => router.replace('/(tabs)')} style={styles.button} />
      </ScrollView>
    </DarkSafeScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 18 }, notice: { borderRadius: 14, backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: 'rgba(255,170,37,.3)', padding: 14, marginBottom: 18 }, noticeTitle: { color: colors.amber, fontSize: 13, fontWeight: '700' }, noticeBody: { color: colors.inkMuted, fontSize: 11, marginTop: 4 }, title: { ...type.h1, color: colors.white, fontSize: 27 }, subtitle: { color: colors.inkMuted, fontSize: 13, lineHeight: 19, marginTop: 8 }, cards: { gap: 10, marginTop: 22 }, card: { flexDirection: 'row', gap: 14, padding: 16 }, icon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(196,245,42,.10)', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, cardTitle: { color: colors.white, fontSize: 18, fontWeight: '700' }, range: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 9 }, model: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }, modelText: { color: '#DCE7E1', fontSize: 10, flex: 1 }, soon: { flexDirection: 'row', gap: 10, marginTop: 20, paddingHorizontal: 6 }, soonTitle: { color: colors.white, fontSize: 12, fontWeight: '700' }, soonText: { color: colors.inkMuted, fontSize: 10, lineHeight: 15, marginTop: 2, maxWidth: 300 }, button: { marginTop: 24 },
});
