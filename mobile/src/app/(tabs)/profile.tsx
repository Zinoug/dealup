import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowUpRight, Bell, ChevronRight, CircleHelp, FileText, Grid2X2, LogOut, Plus, RotateCcw, Shield, Smartphone, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { BrandButton } from '@/components/brand-button';
import { Screen } from '@/components/screen';
import { runtime } from '@/services/runtime';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

export default function ProfileScreen() {
  const { usage, hasSubscription, choosePlan, signOut, deleteAccount, requestNotifications, isBusy, resetLocalDevelopmentState, userName, userEmail } = useAppStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const remaining = Math.max(usage.limit - usage.used, 0);
  const remainingRatio = usage.limit > 0 ? Math.min(remaining / usage.limit, 1) : 0;
  const planName = usage.plan === 'monthly' ? 'Mensuel' : usage.plan === 'weekly' ? 'Hebdomadaire' : 'Accès DealUp';
  const resetLabel = usage.renewsLabel.replace('Renouvellement', 'Remis à zéro');

  const reset = () => Alert.alert('Réinitialiser l’interface locale ?', 'L’onboarding et la checklist seront réinitialisés. Ton compte et tes analyses restent intacts.', [
    { text: 'Garder mes données', style: 'cancel' },
    { text: 'Réinitialiser', style: 'destructive', onPress: () => void resetLocalDevelopmentState().then(() => router.replace('/')) },
  ]);
  const enableNotifications = async () => {
    const result = await requestNotifications();
    if (result === 'enabled') {
      Alert.alert('Notifications activées', 'DealUp t’avertira uniquement lorsqu’une analyse se termine.');
    } else if (result === 'denied') {
      Alert.alert('Notifications désactivées', 'Tu peux les réactiver dans les réglages iOS.', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Ton espace</Text>
      <View style={styles.identity}><AppLogo size={62} /><View><Text style={styles.name}>{userName}</Text><Text style={styles.email}>{userEmail}</Text></View></View>

      <LinearGradient colors={['#07372C', '#052A21', '#04251D']} locations={[0, .56, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planCard}>
        {hasSubscription ? (
          <>
            <View style={styles.planTop}><Text style={styles.planTitle}>{planName}</Text><Text style={styles.planReset}>{resetLabel}</Text></View>
            <View style={styles.quotaRow}><Text style={styles.quotaNumber}>{remaining}</Text><Text style={styles.quotaLabel}>analyses{`\n`}restantes</Text></View>
            <View style={styles.usageTrack}><View style={[styles.usageFill, { width: `${remainingRatio * 100}%` }]} /></View>
            <View style={styles.accessActions}>
              {usage.plan === 'weekly' ? <AccessAction icon={ArrowUpRight} label="Passer au Mensuel" onPress={() => { choosePlan('monthly'); router.push('/paywall'); }} /> : null}
              <AccessAction icon={Plus} label="Ajouter 10 analyses" onPress={() => router.push('/quota')} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.planTitle}>Analyse à ton rythme</Text>
            <Text style={styles.planBody}>Choisis la formule qui correspond à tes recherches du moment.</Text>
            <View style={styles.accessActions}><AccessAction icon={ArrowUpRight} label="Découvrir les formules" onPress={() => router.push('/paywall')} /></View>
          </>
        )}
      </LinearGradient>

      <View style={styles.settings}>
        {runtime.devTools ? <SettingRow icon={Grid2X2} label="Laboratoire des rapports" onPress={() => router.push('/report-lab')} /> : null}
        <SettingRow icon={Bell} label="Notifications d’analyse" onPress={() => void enableNotifications()} />
        <SettingRow icon={Smartphone} label="Appareils compatibles" onPress={() => router.push('/compatible-devices')} />
        <SettingRow icon={Shield} label="Confidentialité" />
        <SettingRow icon={FileText} label="Conditions d’utilisation" />
        <SettingRow icon={CircleHelp} label="Aide et contact" />
        {runtime.devTools ? <SettingRow icon={RotateCcw} label="Réinitialiser l’interface locale" onPress={reset} /> : null}
      </View>

      <BrandButton label="Se déconnecter" icon={LogOut} variant="ghost" onPress={() => { void signOut().then(() => router.replace('/auth')); }} />
      <Pressable onPress={() => setDeleteOpen(true)} style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}><Trash2 color="#C54A43" size={17} /><Text style={styles.deleteLinkText}>Supprimer mon compte</Text></Pressable>
      <Text style={styles.version}>DealUp 1.0.0</Text>

      <Modal animationType="slide" onRequestClose={() => setDeleteOpen(false)} presentationStyle="pageSheet" visible={deleteOpen}>
        <SafeAreaView style={styles.deleteSafe}>
          <View style={styles.deleteHeader}><Text style={styles.deleteTitle}>Supprimer ton compte</Text><Pressable accessibilityLabel="Fermer" onPress={() => setDeleteOpen(false)} style={styles.deleteClose}><X color={colors.lightInk} size={20} /></Pressable></View>
          <Text style={styles.deleteBody}>Tes analyses, tes photos privées et ton compte DealUp seront supprimés. Cette action est définitive.</Text>
          <Text style={styles.deleteInstruction}>Écris « supprimer » pour confirmer.</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={setConfirmation} placeholder="supprimer" placeholderTextColor="#9BA29D" style={styles.deleteInput} value={confirmation} />
          <Pressable
            accessibilityState={{ disabled: confirmation.trim().toLocaleLowerCase('fr-FR') !== 'supprimer' || isBusy, busy: isBusy }}
            disabled={confirmation.trim().toLocaleLowerCase('fr-FR') !== 'supprimer' || isBusy}
            onPress={() => void deleteAccount().then((deleted) => { if (deleted) router.replace('/auth'); })}
            style={({ pressed }) => [styles.deleteButton, (confirmation.trim().toLocaleLowerCase('fr-FR') !== 'supprimer' || isBusy) && styles.deleteButtonDisabled, pressed && styles.pressed]}
          >
            {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Trash2 color="#FFFFFF" size={19} />}<Text style={styles.deleteButtonText}>{isBusy ? 'Suppression en cours…' : 'Supprimer définitivement'}</Text>
          </Pressable>
          <Pressable disabled={isBusy} onPress={() => setDeleteOpen(false)} style={styles.cancelDelete}><Text style={styles.cancelDeleteText}>Conserver mon compte</Text></Pressable>
        </SafeAreaView>
      </Modal>
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

function AccessAction({ icon: Icon, label, onPress }: { icon: typeof Bell; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.accessAction, pressed && styles.pressed]}>
      <Text style={styles.accessActionText}>{label}</Text><Icon size={18} color={colors.lime} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { ...type.h1, color: colors.ink },
  identity: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...type.h3, color: colors.ink },
  email: { ...type.small, color: colors.inkMuted },
  planCard: { marginTop: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(144,197,173,.22)', paddingTop: spacing.lg, paddingHorizontal: spacing.lg, overflow: 'hidden' },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  planTitle: { ...type.h3, color: colors.white },
  planReset: { ...type.caption, color: colors.inkMuted },
  planBody: { ...type.small, color: '#B8CBC2', marginTop: spacing.sm, marginBottom: spacing.md },
  quotaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  quotaNumber: { color: colors.white, fontSize: 46, lineHeight: 50, fontWeight: '700', letterSpacing: -1.5 },
  quotaLabel: { ...type.small, color: '#B8CBC2', lineHeight: 18 },
  usageTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(150,189,171,.16)', overflow: 'hidden', marginTop: spacing.md, marginBottom: spacing.lg },
  usageFill: { height: '100%', borderRadius: 3, backgroundColor: colors.lime },
  accessActions: { marginHorizontal: -spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(144,197,173,.18)' },
  accessAction: { minHeight: 54, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(144,197,173,.14)' },
  accessActionText: { ...type.bodyStrong, color: colors.white },
  settings: { marginVertical: spacing.xl },
  settingRow: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.55 },
  settingIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  settingDetail: { ...type.small, color: colors.inkMuted },
  version: { ...type.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.lg },
  deleteLink: { minHeight: 48, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteLinkText: { color: '#C54A43', fontSize: 13, fontWeight: '600' },
  deleteSafe: { flex: 1, backgroundColor: colors.lightSurface, paddingHorizontal: layout.gutter },
  deleteHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteTitle: { color: colors.lightInk, fontSize: 25, fontWeight: '700' },
  deleteClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.lightBorder, alignItems: 'center', justifyContent: 'center' },
  deleteBody: { color: colors.lightMuted, fontSize: 15, lineHeight: 22, marginTop: 24 },
  deleteInstruction: { color: colors.lightInk, fontSize: 14, fontWeight: '600', marginTop: 30 },
  deleteInput: { height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.lightBorder, paddingHorizontal: 16, color: colors.lightInk, fontSize: 16, marginTop: 10 },
  deleteButton: { minHeight: 58, borderRadius: 18, backgroundColor: '#BD3833', marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  deleteButtonDisabled: { opacity: .35 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancelDelete: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelDeleteText: { color: colors.lightMuted, fontSize: 13, fontWeight: '600' },
});
