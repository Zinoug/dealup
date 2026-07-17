import { router } from 'expo-router';
import { Check, Circle, RotateCcw } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeviceThumbnail } from '@/components/device-thumbnail';
import { DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';
import type { PlanId } from '@/types/domain';

export default function PaywallScreen() {
  const { selectedPlan, choosePlan, purchasePlan, restorePurchases, identification, isBusy } = useAppStore();
  const device = identification?.compatibility?.device;
  const deviceLabel = device?.category === 'MACBOOK' ? 'ce MacBook' : 'cet iPhone';
  const buy = async () => { await purchasePlan(); router.replace(identification ? '/analysis-setup' : '/(tabs)'); };
  return <DarkSafeScreen variant="tag" edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.listing}><DeviceThumbnail category={device?.category} size={62} /><View style={styles.listingCopy}><Text numberOfLines={1} style={styles.listingTitle}>{device?.displayName ?? identification?.title ?? 'Annonce identifiée'}</Text><Text style={styles.listingMeta}>{identification ? `${Math.round(identification.priceCents / 100).toLocaleString('fr-FR')} € · ${identification.location}` : 'Leboncoin'}</Text></View></View>
    <Text style={styles.title}>Débloque l’analyse complète{`\n`}de {deviceLabel}.</Text><Text style={styles.subtitle}>Sache quoi vérifier, combien proposer{`\n`}et jusqu’où monter avant de payer.</Text>
    <View style={styles.benefits}>{['Score, verdict et risques détaillés','Prix cible et offre d’ouverture','Messages vendeur prêts à envoyer','Réanalyses et checklist incluses'].map((x) => <View key={x} style={styles.benefit}><View style={styles.check}><Check size={12} color={colors.brand900} strokeWidth={3} /></View><Text style={styles.benefitText}>{x}</Text></View>)}</View>
    <View style={styles.plans}><Plan id="monthly" selected={selectedPlan === 'monthly'} onPress={choosePlan} title="Monthly" price="12,99 € / mois" quota="60 nouvelles annonces par mois" badge="LE PLUS AVANTAGEUX" /><Plan id="weekly" selected={selectedPlan === 'weekly'} onPress={choosePlan} title="Weekly" price="4,99 € / semaine" quota="15 nouvelles annonces par semaine" /></View>
    <LimeButton label={isBusy ? 'Abonnement…' : 'S’abonner et analyser cette annonce'} onPress={() => void buy()} />
    <Text style={styles.legal}>Sans essai gratuit · Renouvellement automatique{`\n`}Résiliable dans les réglages Apple</Text>
    <Pressable onPress={() => void restorePurchases()} style={styles.restore}><RotateCcw size={14} color={colors.lime} /><Text style={styles.restoreText}>Restaurer mes achats</Text></Pressable><Text style={styles.links}>Conditions d’utilisation · Confidentialité</Text>
  </ScrollView></DarkSafeScreen>;
}
function Plan({ id, selected, onPress, title, price, quota, badge }: { id: PlanId; selected: boolean; onPress: (id: PlanId) => void; title: string; price: string; quota: string; badge?: string }) { return <Pressable onPress={() => onPress(id)}><GlassCard style={[styles.plan, selected && styles.planSelected]}><View style={styles.planCopy}><View style={styles.planTitleRow}><Text style={styles.planTitle}>{title}</Text>{badge ? <Text style={styles.badge}>{badge}</Text> : null}</View><Text style={styles.planPrice}>{price}</Text><Text style={styles.quota}>{quota}</Text></View>{selected ? <View style={styles.selected}><Check size={14} color={colors.brand900} strokeWidth={3} /></View> : <Circle size={25} color={colors.inkMuted} />}</GlassCard></Pressable>; }
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter, paddingTop: 10, paddingBottom: 24 }, listing: { flexDirection: 'row', alignItems: 'center', gap: 12 }, listingCopy: { flex: 1 }, listingTitle: { ...type.bodyStrong, color: colors.white }, listingMeta: { ...type.small, color: colors.inkMuted, marginTop: 2 },
  title: { ...type.h1, color: colors.white, marginTop: 24 }, subtitle: { ...type.small, color: '#C5D2CC', marginTop: 7 }, benefits: { gap: 9, marginTop: 18 }, benefit: { flexDirection: 'row', alignItems: 'center', gap: 9 }, check: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, benefitText: { color: colors.white, fontSize: 13 },
  plans: { gap: 10, marginTop: 20, marginBottom: 12 }, plan: { minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 13 }, planSelected: { borderColor: colors.lime, borderWidth: 1.5 }, planCopy: { flex: 1 }, planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, planTitle: { ...type.bodyStrong, color: colors.white }, badge: { color: colors.brand900, backgroundColor: colors.lime, fontSize: 8, fontWeight: '800', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 }, planPrice: { color: colors.white, fontSize: 16, fontWeight: '700', marginTop: 3 }, quota: { color: colors.lime, fontSize: 11, marginTop: 3 }, selected: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  legal: { color: colors.inkMuted, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 10 }, restore: { minHeight: 34, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, restoreText: { color: colors.lime, fontSize: 11 }, links: { color: colors.inkMuted, fontSize: 9, textAlign: 'center' },
});
