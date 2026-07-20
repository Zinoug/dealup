import { router, useLocalSearchParams } from 'expo-router';
import { Check, Circle, RotateCcw, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeviceThumbnail } from '@/components/device-thumbnail';
import { DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';
import type { PlanId } from '@/types/domain';
import { formatMonthlyPricePerWeek } from '@/utils/pricing';

export default function PaywallScreen() {
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const { selectedPlan, choosePlan, purchasePlan, restorePurchases, identification, purchaseMode, alreadyContacted, startAnalysis, isBusy, billingProducts } = useAppStore();
  const device = identification?.compatibility?.device;
  const target = device?.category === 'MACBOOK' ? 'ce MacBook' : device?.category === 'IPHONE' ? 'cet iPhone' : 'cet appareil';
  const continueAfterAccess = async () => {
    if (intent === 'analysis' && identification && purchaseMode) {
      const id = await startAnalysis();
      if (id) {
        router.replace({ pathname: '/analysis-progress', params: { id } });
      } else {
        router.replace(alreadyContacted ? '/seller-context' : '/analysis-setup');
      }
      return;
    }
    router.replace('/(tabs)');
  };
  const buy = async () => {
    if (await purchasePlan()) await continueAfterAccess();
  };
  const restore = async () => {
    if (await restorePurchases()) await continueAfterAccess();
  };
  const monthly = billingProducts.monthly;
  const weekly = billingProducts.weekly;
  const close = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

  return (
    <DarkSafeScreen variant="tag" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View />
          <Pressable accessibilityLabel="Fermer" hitSlop={10} onPress={close} style={styles.close}><X color={colors.white} size={21} /></Pressable>
        </View>
        {identification ? (
          <View style={styles.listing}>
            <DeviceThumbnail uri={identification.thumbnailUrl} size={58} />
            <View style={styles.listingCopy}>
              <Text numberOfLines={1} style={styles.listingTitle}>{device?.displayName ?? identification.title}</Text>
              <Text numberOfLines={1} style={styles.listingMeta}>{Math.round(identification.priceCents / 100).toLocaleString('fr-FR')} € · {identification.location}</Text>
            </View>
          </View>
        ) : null}

        <Text style={[styles.title, !identification && styles.genericTitle]}>{identification ? `Sache si ${target}\nvaut vraiment le coup.` : 'Prends la bonne décision,\nannonce après annonce.'}</Text>
        <Text style={styles.subtitle}>Prix juste, risques, preuves à demander{`\n`}et offre prête avant de payer.</Text>

        <View style={styles.benefits}>
          {['Score et verdict personnalisés', 'Prix cible et économie possible', 'Messages vendeur prêts à envoyer', 'Réanalyses et checklist incluses'].map((item) => (
            <View key={item} style={styles.benefit}><View style={styles.check}><Check size={12} color={colors.brand900} strokeWidth={3} /></View><Text style={styles.benefitText}>{item}</Text></View>
          ))}
        </View>

        <View style={styles.plans}>
          <Plan id="monthly" selected={selectedPlan === 'monthly'} onPress={choosePlan} title="Mensuel" price={monthly ? `${formatMonthlyPricePerWeek(Math.round(monthly.price * 100))} / semaine` : 'Chargement du prix…'} billing={monthly ? `Facturé ${monthly.priceString} par mois` : 'Prix App Store indisponible'} quota="60 nouvelles annonces par mois" badge="Le plus populaire" />
          <Plan id="weekly" selected={selectedPlan === 'weekly'} onPress={choosePlan} title="Hebdomadaire" price={weekly ? `${weekly.priceString} / semaine` : 'Chargement du prix…'} billing="Facturé chaque semaine" quota="15 nouvelles annonces par semaine" />
        </View>

        <LimeButton label={isBusy ? 'Activation…' : 'Continuer'} onPress={() => void buy()} style={styles.cta} />
        <Text style={styles.trust}>Paiement sécurisé par Apple · Annulable à tout moment.</Text>
        <Pressable onPress={() => void restore()} style={styles.restore}><RotateCcw size={14} color={colors.lime} /><Text style={styles.restoreText}>Restaurer mes achats</Text></Pressable>
        <Text style={styles.links}>Conditions d’utilisation · Confidentialité</Text>
      </ScrollView>
    </DarkSafeScreen>
  );
}

function Plan({ id, selected, onPress, title, price, billing, quota, badge }: { id: PlanId; selected: boolean; onPress: (id: PlanId) => void; title: string; price: string; billing: string; quota: string; badge?: string }) {
  return (
    <Pressable onPress={() => onPress(id)}>
      <GlassCard style={[styles.plan, selected && styles.planSelected]}>
        <View style={styles.planCopy}>
          <View style={styles.planTitleRow}><Text style={styles.planTitle}>{title}</Text>{badge ? <Text style={styles.badge}>{badge}</Text> : null}</View>
          <Text style={styles.planPrice}>{price}</Text>
          <Text style={styles.billing}>{billing}</Text>
          <Text style={styles.quota}>{quota}</Text>
        </View>
        {selected ? <View style={styles.selected}><Check size={14} color={colors.brand900} strokeWidth={3} /></View> : <Circle size={25} color={colors.inkMuted} />}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter, paddingTop: 2, paddingBottom: 24 },
  topBar: { minHeight: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: 42, height: 42, marginRight: -9, alignItems: 'center', justifyContent: 'center' },
  listing: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  listingCopy: { flex: 1 },
  listingTitle: { ...type.bodyStrong, color: colors.white },
  listingMeta: { ...type.small, color: colors.inkMuted, marginTop: 2 },
  title: { ...type.h1, color: colors.white, marginTop: 24 },
  genericTitle: { marginTop: 36 },
  subtitle: { ...type.small, color: '#C5D2CC', marginTop: 8, lineHeight: 20 },
  benefits: { gap: 9, marginTop: 19 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  check: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  benefitText: { color: colors.white, fontSize: 13 },
  plans: { gap: 10, marginTop: 20, marginBottom: 13 },
  plan: { minHeight: 105, flexDirection: 'row', alignItems: 'center', padding: 14 },
  planSelected: { borderColor: colors.lime, borderWidth: 1.5, shadowColor: colors.lime, shadowOpacity: .13, shadowRadius: 14 },
  planCopy: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  planTitle: { ...type.bodyStrong, color: colors.white },
  badge: { color: colors.brand900, backgroundColor: colors.lime, fontSize: 9, lineHeight: 12, fontWeight: '800', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  planPrice: { color: colors.white, fontSize: 19, fontWeight: '700', marginTop: 5 },
  billing: { color: colors.inkMuted, fontSize: 10, marginTop: 1 },
  quota: { color: colors.lime, fontSize: 11, marginTop: 5 },
  selected: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  cta: { minHeight: 48 },
  trust: { color: '#B4C5BC', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 10 },
  restore: { minHeight: 38, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  restoreText: { color: colors.lime, fontSize: 11 },
  links: { color: colors.inkMuted, fontSize: 9, textAlign: 'center' },
});
