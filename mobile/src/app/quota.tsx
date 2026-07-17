import { router } from 'expo-router';
import { ArrowUpRight, Check, Plus, Zap } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { BrandButton } from '@/components/brand-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

export default function QuotaScreen() {
  const { usage, purchaseTopUp, isBusy } = useAppStore();
  const isWeekly = usage.plan === 'weekly';
  return (
    <Screen scroll contentStyle={styles.content}>
      <ScreenHeader back compact />
      <View style={styles.icon}><Zap size={29} color={colors.brand900} /></View>
      <Text style={styles.eyebrow}>QUOTA UTILISÉ</Text>
      <Text style={styles.title}>Continue sans attendre le renouvellement.</Text>
      <Text style={styles.subtitle}>Tes rapports et réanalyses restent accessibles. Choisis seulement si tu veux analyser de nouvelles annonces maintenant.</Text>
      <View style={styles.options}>
        {isWeekly ? <View style={[styles.option, styles.featured]}><Text style={styles.badge}>PLUS DE MARGE</Text><Text style={styles.optionTitle}>Passer à Monthly</Text><Text style={styles.price}>12,99 € / mois</Text><Text style={styles.optionBody}>60 nouvelles annonces chaque mois, avec le même accès complet.</Text><View style={styles.line}><Check size={16} color={colors.brand800} /><Text style={styles.lineText}>45 annonces de plus que Weekly</Text></View><BrandButton label="Choisir Monthly" icon={ArrowUpRight} variant="secondary" onPress={() => router.replace('/paywall')} /></View> : null}
        <View style={styles.option}><Text style={styles.optionTitle}>Ajouter 10 analyses</Text><Text style={styles.price}>4,99 € une fois</Text><Text style={styles.optionBody}>Pack réservé aux abonnés actifs. Il n’expire pas et sera utilisé après ton quota inclus.</Text><View style={styles.line}><Check size={16} color={colors.brand800} /><Text style={styles.lineText}>Aucun nouvel abonnement</Text></View><BrandButton label="Ajouter 10 analyses" icon={Plus} loading={isBusy} onPress={() => void purchaseTopUp().then(() => router.replace('/(tabs)'))} /></View>
      </View>
      <Text style={styles.note}>Mode interface : les achats restent simulés jusqu’au branchement RevenueCat.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xl },
  icon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...type.caption, color: colors.brand700, letterSpacing: 1, marginTop: spacing.lg },
  title: { ...type.h1, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm },
  options: { marginTop: spacing.xl, gap: spacing.md },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.sm },
  featured: { backgroundColor: colors.limeSoft, borderColor: colors.brand500 },
  badge: { ...type.caption, color: colors.brand700, letterSpacing: 0.9 },
  optionTitle: { ...type.h2, color: colors.ink },
  price: { ...type.h3, color: colors.brand700 },
  optionBody: { ...type.small, color: colors.inkMuted },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  lineText: { ...type.caption, color: colors.inkMuted },
  note: { ...type.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.lg },
});
