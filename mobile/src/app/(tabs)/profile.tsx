import { router } from 'expo-router';
import { Bell, ChevronRight, CircleHelp, FileText, Grid2X2, LogOut, PlayCircle, RotateCcw, Shield, Smartphone, Sparkles } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppLogo } from '@/components/app-logo';
import { BrandButton } from '@/components/brand-button';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { dealupApi } from '@/services/dealup-api';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

export default function ProfileScreen() {
  const { usage, hasSubscription, signOut, resetDemo } = useAppStore();

  const reset = () => Alert.alert('Recommencer la démo ?', 'L’onboarding, la connexion et l’abonnement simulé seront réinitialisés.', [
    { text: 'Garder mes données', style: 'cancel' },
    { text: 'Réinitialiser', style: 'destructive', onPress: () => void resetDemo().then(() => router.replace('/')) },
  ]);

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Ton profil</Text>
      <View style={styles.identity}><AppLogo size={62} /><View><Text style={styles.name}>Zineddine</Text><Text style={styles.email}>zineddine@dealup.app</Text></View></View>

      <View style={styles.planCard}>
        <View style={styles.planTop}><View><Text style={styles.planEyebrow}>ABONNEMENT</Text><Text style={styles.planTitle}>{hasSubscription ? usage.plan === 'monthly' ? 'DealUp Monthly' : 'DealUp Weekly' : 'Aucun abonnement'}</Text></View><Sparkles color={colors.brand900} size={24} /></View>
        {hasSubscription ? <ProgressBar value={usage.used} max={usage.limit} label={`${usage.limit - usage.used} restantes`} detail={usage.renewsLabel} /> : <Text style={styles.planBody}>Ton offre apparaîtra après l’identification d’une annonce.</Text>}
        <BrandButton label={hasSubscription ? 'Gérer mon abonnement' : 'Voir les offres'} compact variant="ghost" onPress={() => router.push('/paywall')} />
      </View>

      <View style={styles.settings}>
        {dealupApi.isMock ? <SettingRow icon={PlayCircle} label="Prévisualiser l’animation d’analyse" onPress={() => router.push({ pathname: '/analysis-progress', params: { id: 'analysis_demo_01', preview: '1' } })} /> : null}
        {dealupApi.isMock ? <SettingRow icon={Grid2X2} label="Prévisualiser les 8 rapports" onPress={() => router.push('/report-lab')} /> : null}
        <SettingRow icon={Smartphone} label="Appareils compatibles" onPress={() => router.push('/compatible-devices')} />
        <SettingRow icon={Bell} label="Notifications" detail="Activées" />
        <SettingRow icon={Shield} label="Confidentialité" />
        <SettingRow icon={FileText} label="Conditions d’utilisation" />
        <SettingRow icon={CircleHelp} label="Aide et contact" />
        <SettingRow icon={RotateCcw} label="Réinitialiser la démo" onPress={reset} />
      </View>

      <BrandButton label="Se déconnecter" icon={LogOut} variant="ghost" onPress={() => { signOut(); router.replace('/auth'); }} />
      <Text style={styles.version}>DealUp 1.0.0 · Interface de démonstration</Text>
    </Screen>
  );
}

function SettingRow({ icon: Icon, label, detail, onPress }: { icon: typeof Bell; label: string; detail?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => undefined)} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
      <View style={styles.settingIcon}><Icon size={20} color={colors.brand700} /></View>
      <Text style={styles.settingLabel}>{label}</Text>
      {detail ? <Text style={styles.settingDetail}>{detail}</Text> : null}
      <ChevronRight size={18} color={colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { ...type.h1, color: colors.ink },
  identity: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...type.h3, color: colors.ink },
  email: { ...type.small, color: colors.inkMuted },
  planCard: { marginTop: spacing.xl, backgroundColor: colors.limeSoft, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.lg },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planEyebrow: { ...type.caption, color: colors.brand700, letterSpacing: 0.8 },
  planTitle: { ...type.h2, color: colors.brand900, marginTop: spacing.xxs },
  planBody: { ...type.small, color: colors.brand800 },
  settings: { marginVertical: spacing.xl },
  settingRow: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.55 },
  settingIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  settingDetail: { ...type.small, color: colors.inkMuted },
  version: { ...type.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.lg },
});
