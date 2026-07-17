import { router } from 'expo-router';
import { ArrowRight, MapPin, MessageSquareText, ShieldCheck, Store, Truck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { BrandButton } from '@/components/brand-button';
import { DeviceThumbnail } from '@/components/device-thumbnail';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';
import { formatEuros } from '@/utils/format';

export default function AnalysisConfirmScreen() {
  const { identification, purchaseMode, alreadyContacted, sellerMediaUris, sellerReply, startAnalysis, isBusy, usage } = useAppStore();
  if (!identification || !purchaseMode) return null;

  const start = async () => {
    const id = await startAnalysis();
    if (id) router.replace({ pathname: '/analysis-progress', params: { id } });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader back compact />
      <View style={styles.copy}><Text style={styles.eyebrow}>PRÊT À ANALYSER</Text><Text style={styles.title}>Un dernier coup d’œil.</Text><Text style={styles.subtitle}>DealUp va utiliser ces éléments pour adapter le verdict et les conseils.</Text></View>
      <View style={styles.listing}><DeviceThumbnail category={identification.compatibility?.device?.category} size={66} /><View style={styles.listingCopy}><Text numberOfLines={2} style={styles.product}>{identification.title}</Text><View style={styles.meta}><Text style={styles.price}>{formatEuros(identification.priceCents)}</Text><MapPin size={14} color={colors.inkSoft} /><Text style={styles.location}>{identification.location}</Text></View></View></View>
      <View style={styles.summary}>
        <SummaryLine icon={purchaseMode === 'delivery' ? Truck : Store} label="Mode d’achat" value={purchaseMode === 'face_to_face' ? 'Remise en main propre' : purchaseMode === 'delivery' ? 'Livraison' : 'Pas encore décidé'} />
        <SummaryLine icon={MessageSquareText} label="Contexte vendeur" value={alreadyContacted ? `${sellerReply ? 'Message ajouté' : 'Sans texte'}${sellerMediaUris.length ? ` · ${sellerMediaUris.length} image${sellerMediaUris.length > 1 ? 's' : ''}` : ''}` : 'Pas encore contacté'} />
        <SummaryLine icon={ShieldCheck} label="Quota après analyse" value={`${Math.max(0, usage.limit - usage.used - 1)} restantes`} />
      </View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>L’analyse prend généralement moins de 30 secondes.</Text><Text style={styles.noticeBody}>Tu peux laisser l’app ouverte. Plus tard, une notification pourra te prévenir si elle dure davantage.</Text></View>
      <View style={styles.footer}><BrandButton label="Lancer l’analyse" icon={ArrowRight} loading={isBusy} onPress={start} /><Text style={styles.disclaimer}>Cette nouvelle annonce consomme 1 unité de ton quota.</Text></View>
    </Screen>
  );
}

function SummaryLine({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return <View style={styles.summaryLine}><View style={styles.summaryIcon}><Icon size={20} color={colors.brand700} /></View><View style={styles.summaryCopy}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  copy: { paddingHorizontal: layout.gutter },
  eyebrow: { ...type.caption, color: colors.brand700, letterSpacing: 1 },
  title: { ...type.h1, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm },
  listing: { marginHorizontal: layout.gutter, marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listingCopy: { flex: 1, gap: spacing.xs },
  product: { ...type.bodyStrong, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  price: { ...type.small, color: colors.lime, fontWeight: '700', marginRight: spacing.xs },
  location: { ...type.caption, color: colors.inkMuted },
  summary: { marginHorizontal: layout.gutter, marginTop: spacing.xl, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  summaryLine: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: spacing.xxs },
  summaryLabel: { ...type.caption, color: colors.inkMuted },
  summaryValue: { ...type.bodyStrong, color: colors.ink },
  notice: { marginHorizontal: layout.gutter, marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.border, gap: spacing.xxs },
  noticeTitle: { ...type.bodyStrong, color: colors.ink },
  noticeBody: { ...type.small, color: colors.inkMuted },
  footer: { paddingHorizontal: layout.gutter, marginTop: spacing.xl, gap: spacing.sm },
  disclaimer: { ...type.caption, color: colors.inkSoft, textAlign: 'center' },
});
