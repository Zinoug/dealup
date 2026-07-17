import { router } from 'expo-router';
import { Camera, CheckSquare2, Laptop, LockKeyhole, ShieldQuestion, Smartphone, Tag } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';
import { formatEuros } from '@/utils/format';

export default function ListingPreviewScreen() {
  const { identification, hasSubscription } = useAppStore();
  if (!identification) return null;
  const device = identification.compatibility?.device;
  const DeviceIcon = device?.category === 'MACBOOK' ? Laptop : Smartphone;
  return (
    <DarkSafeScreen variant="tag" edges={['top', 'left', 'right']}>
      <DarkHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.deviceHero}><DeviceIcon size={70} color={colors.lime} /><Text style={styles.deviceKind}>{device?.category === 'MACBOOK' ? 'MACBOOK COMPATIBLE' : 'IPHONE COMPATIBLE'}</Text></View>
        <Text style={styles.title}>{device?.displayName ?? identification.title}</Text><Text style={styles.sub}>{Object.values(device?.specs ?? {}).join(' · ')}</Text>
        <View style={styles.priceRow}><Text style={styles.price}>{formatEuros(identification.priceCents)}</Text><Text style={styles.location}>⌖ {identification.location}</Text></View>
        <View style={styles.chips}>{[...identification.facts.slice(0, 3), `${identification.photoCount} photos`].map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</View>
        <GlassCard style={styles.verifyCard}><Text style={styles.cardTitle}>DealUp va maintenant vérifier :</Text>
          <CheckLine icon={<Tag size={15} color={colors.lime} />} text="Le juste prix et la marge de négociation" />
          <CheckLine icon={<Camera size={15} color={colors.lime} />} text="Les photos et incohérences visibles" />
          <CheckLine icon={<ShieldQuestion size={15} color={colors.lime} />} text="Les preuves encore manquantes" />
          <CheckLine icon={<CheckSquare2 size={15} color={colors.lime} />} text="Le vendeur et les signaux de confiance" />
        </GlassCard>
        <View style={styles.locked}>{['Score', 'Verdict', 'Prix cible'].map((label) => <View key={label} style={styles.lockCell}><Text style={styles.lockLabel}>{label}</Text><LockKeyhole size={20} color={colors.inkMuted} /></View>)}</View>
        <LimeButton label="Voir ce que DealUp en pense" onPress={() => router.push(hasSubscription ? '/analysis-setup' : '/paywall')} />
      </ScrollView>
    </DarkSafeScreen>
  );
}
function CheckLine({ icon, text }: { icon: React.ReactNode; text: string }) { return <View style={styles.line}><View style={styles.lineIcon}>{icon}</View><Text style={styles.lineText}>{text}</Text></View>; }
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter, paddingBottom: 24 }, deviceHero: { width: '72%', aspectRatio: 1.35, alignSelf: 'center', borderRadius: 20, backgroundColor: 'rgba(196,245,42,.08)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, deviceKind: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 10 }, title: { ...type.h1, color: colors.white, marginTop: 12 }, sub: { ...type.small, color: colors.white }, priceRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 }, price: { ...type.h2, color: colors.white }, location: { ...type.small, color: colors.inkMuted },
  chips: { flexDirection: 'row', gap: 6, marginTop: 13 }, chip: { flex: 1, minHeight: 47, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, chipText: { color: colors.white, fontSize: 10, textAlign: 'center' },
  verifyCard: { marginTop: 12, padding: 14, gap: 10 }, cardTitle: { ...type.small, color: colors.white, fontWeight: '600', marginBottom: 2 }, line: { flexDirection: 'row', alignItems: 'center', gap: 9 }, lineIcon: { width: 18, alignItems: 'center' }, lineText: { color: '#DAE5DF', fontSize: 12, flex: 1 },
  locked: { height: 72, marginVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, flexDirection: 'row', overflow: 'hidden' }, lockCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderRightWidth: 1, borderRightColor: colors.border }, lockLabel: { color: colors.inkMuted, fontSize: 10 },
});
