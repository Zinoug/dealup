import { router } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard } from '@/components/reference-ui';
import { externalLinks, openExternalLink } from '@/services/external-links';
import type { TopUpQuantity } from '@/services/revenuecat';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

export default function QuotaScreen() {
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 760 || fontScale > 1.05;
  const { usage, purchaseTopUp, isBusy, billingProducts, choosePlan } = useAppStore();
  const isWeekly = usage.plan === 'weekly';
  const [selected, setSelected] = useState<TopUpQuantity>(40);
  const selectedProduct = selected === 15 ? billingProducts.topUp15 : billingProducts.topUp40;

  const buyTopUp = async () => {
    if (await purchaseTopUp(selected)) router.replace('/(tabs)');
  };

  return (
    <DarkSafeScreen variant="tag">
      <DarkHeader />
      <View style={[styles.content, compact && styles.contentCompact]}>
        <View>
          <Text maxFontSizeMultiplier={1.08} style={[styles.title, compact && styles.titleCompact]}>Continue sans attendre.</Text>
          <Text maxFontSizeMultiplier={1.08} style={[styles.subtitle, compact && styles.subtitleCompact]}>
            Ajoute des analyses à ton solde, sans changer de formule.
          </Text>
        </View>

        <GlassCard style={[styles.card, compact && styles.cardCompact]}>
          <View accessibilityRole="radiogroup" style={styles.selector}>
            <PackChoice
              price={billingProducts.topUp15?.priceString ?? '—'}
              quantity={15}
              selected={selected === 15}
              onPress={() => setSelected(15)}
            />
            <PackChoice
              price={billingProducts.topUp40?.priceString ?? '—'}
              quantity={40}
              selected={selected === 40}
              recommended
              onPress={() => setSelected(40)}
            />
          </View>

          <View style={[styles.summary, compact && styles.summaryCompact]}>
            <View>
              <Text style={styles.summaryQuantity}>+{selected}</Text>
              <Text style={styles.summaryLabel}>analyses disponibles</Text>
            </View>
            <View style={styles.summaryPrice}>
              <Text style={styles.price}>{selectedProduct?.priceString ?? '—'}</Text>
              <Text style={styles.priceDetail}>paiement unique</Text>
            </View>
          </View>

          <View style={[styles.benefits, compact && styles.benefitsCompact]}>
            <Benefit text="Ajoutées immédiatement" />
            <Benefit text="Ton solde n’expire pas" />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void buyTopUp()}
            style={({ pressed }) => [styles.cta, compact && styles.ctaCompact, (pressed || isBusy) && styles.pressed]}
          >
            {isBusy ? <ActivityIndicator color={colors.brand900} /> : (
              <>
                <Text style={styles.ctaText}>Ajouter {selected} analyses</Text>
                <ArrowRight size={21} color={colors.brand900} strokeWidth={2.4} />
              </>
            )}
          </Pressable>
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.appleNote}>Paiement sécurisé par Apple · Formule active requise.</Text>
          {isWeekly ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                choosePlan('monthly');
                router.replace('/paywall');
              }}
              style={({ pressed }) => [styles.monthlyLink, pressed && styles.pressed]}
            >
              <Text style={styles.monthlyText}>Besoin de plus chaque mois ? Découvrir le Mensuel</Text>
              <ArrowRight size={15} color={colors.lime} />
            </Pressable>
          ) : null}
          <LegalLinks />
        </View>
      </View>
    </DarkSafeScreen>
  );
}

function PackChoice({ onPress, price, quantity, recommended, selected }: {
  onPress: () => void;
  price: string;
  quantity: TopUpQuantity;
  recommended?: boolean;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
    >
      {recommended ? <Text style={[styles.recommended, selected && styles.recommendedSelected]}>MEILLEURE VALEUR</Text> : null}
      <View style={styles.choiceTitleRow}>
        <Text style={[styles.choiceQuantity, selected && styles.choiceQuantitySelected]}>{quantity}</Text>
        {selected ? <View style={styles.selectedCheck}><Check size={11} color={colors.brand900} strokeWidth={3} /></View> : null}
      </View>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>analyses</Text>
      <Text style={[styles.choicePrice, selected && styles.choicePriceSelected]}>{price}</Text>
    </Pressable>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefit}>
      <Check size={16} color={colors.lime} strokeWidth={2.7} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function LegalLinks() {
  return (
    <View style={styles.links}>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void openExternalLink(externalLinks.terms)}><Text style={styles.linkText}>Conditions</Text></Pressable>
      <Text style={styles.separator}>·</Text>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void openExternalLink(externalLinks.privacy)}><Text style={styles.linkText}>Confidentialité</Text></Pressable>
      <Text style={styles.separator}>·</Text>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => void openExternalLink(externalLinks.support)}><Text style={styles.linkText}>Aide et contact</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    justifyContent: 'space-between',
  },
  contentCompact: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
  title: { ...type.h1, color: colors.white },
  titleCompact: { fontSize: 29, lineHeight: 34 },
  subtitle: { ...type.body, color: '#A9BDB5', marginTop: spacing.sm, maxWidth: 400 },
  subtitleCompact: { fontSize: 14, lineHeight: 19, marginTop: 5 },
  card: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderColor: 'rgba(181,255,31,0.30)',
  },
  cardCompact: { padding: spacing.md },
  selector: {
    minHeight: 118,
    padding: 5,
    borderRadius: 19,
    backgroundColor: 'rgba(0,18,14,.58)',
    borderWidth: 1,
    borderColor: 'rgba(140,190,169,.18)',
    flexDirection: 'row',
    gap: 5,
  },
  choice: {
    flex: 1,
    minWidth: 0,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  choiceSelected: {
    backgroundColor: 'rgba(181,255,31,.11)',
    borderWidth: 1.5,
    borderColor: colors.lime,
  },
  recommended: { fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: .65, color: '#779087', marginBottom: 2 },
  recommendedSelected: { color: colors.lime },
  choiceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  choiceQuantity: { fontSize: 30, lineHeight: 32, fontWeight: '700', color: '#95A9A0', letterSpacing: -1 },
  choiceQuantitySelected: { color: colors.white },
  selectedCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { ...type.caption, color: '#789087' },
  choiceLabelSelected: { color: '#C9D8D1' },
  choicePrice: { ...type.small, color: '#8BA198', marginTop: 4 },
  choicePriceSelected: { color: colors.lime, fontWeight: '700' },
  summary: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  summaryCompact: { marginTop: spacing.md },
  summaryQuantity: { fontSize: 45, lineHeight: 47, fontWeight: '700', letterSpacing: -1.8, color: colors.white },
  summaryLabel: { ...type.small, color: '#A9BDB5', marginTop: 1 },
  summaryPrice: { alignItems: 'flex-end', paddingBottom: 1 },
  price: { ...type.h2, color: colors.lime },
  priceDetail: { ...type.caption, color: '#91A99F', marginTop: 1 },
  benefits: { gap: spacing.sm, marginTop: spacing.lg },
  benefitsCompact: { marginTop: spacing.md, gap: 5 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitText: { ...type.small, color: '#D8E3DE' },
  cta: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: colors.lime,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  ctaCompact: { minHeight: 54, marginTop: spacing.md },
  ctaText: { ...type.label, color: colors.brand900 },
  footer: { alignItems: 'center' },
  appleNote: { ...type.caption, color: '#81968E', textAlign: 'center' },
  monthlyLink: { minHeight: 35, marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  monthlyText: { ...type.caption, color: colors.lime, textAlign: 'center' },
  links: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 7 },
  linkText: { ...type.caption, color: '#8FA39A', textDecorationLine: 'underline' },
  separator: { ...type.caption, color: '#637970' },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
});
