import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Copy } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { useAnalysisReport } from '@/hooks/use-analysis-report';
import { colors, layout } from '@/theme/tokens';

export default function ActionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { report } = useAnalysisReport(id);
  if (!report) return <DarkSafeScreen variant="focus"><DarkHeader title="Actions" /></DarkSafeScreen>;
  const message = report.primaryAction.type === 'MAKE_OFFER'
    ? report.messages.makeOffer
    : report.primaryAction.type === 'AVOID_LISTING'
      ? report.messages.decline
      : report.messages.requestProofs;

  return (
    <DarkSafeScreen variant="focus" edges={['top', 'left', 'right']}>
      <DarkHeader title="Actions" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>ACTION RECOMMANDÉE</Text>
        <LimeButton label={report.primaryAction.label} onPress={() => void Clipboard.setStringAsync(message)} />
        <Text style={styles.reason}>{report.primaryAction.reason}</Text>
        <Text style={styles.label}>MESSAGE PRÊT À ENVOYER</Text>
        <GlassCard>
          <Text style={styles.message}>{message}</Text>
          <LimeButton
            label="Copier le message"
            icon={<Copy size={16} color={colors.brand900} />}
            onPress={() => void Clipboard.setStringAsync(message)}
            style={styles.copy}
          />
        </GlassCard>
        <Text style={styles.label}>AUTRES ACTIONS</Text>
        <GlassCard style={styles.actions}>
          {report.availableActions.includes('MAKE_OFFER') ? <Action text="Faire une offre" onPress={() => router.push({ pathname: '/make-offer', params: { id: report.id } })} /> : null}
          {report.availableActions.includes('START_CHECKLIST') ? <Action text="Démarrer la checklist" onPress={() => router.push({ pathname: '/checklist', params: { id: report.id } })} /> : null}
          <Action text="Ajouter la réponse du vendeur" onPress={() => router.push({ pathname: '/reanalyze', params: { id: report.id } })} />
          <Action text="Comparer une autre annonce" onPress={() => router.replace('/(tabs)')} last />
        </GlassCard>
      </ScrollView>
    </DarkSafeScreen>
  );
}

function Action({ text, onPress, last = false }: { text: string; onPress: () => void; last?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.action, last && styles.lastAction]}><Text style={styles.actionText}>{text}</Text><ChevronRight size={18} color={colors.white} /></Pressable>;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.gutter, paddingTop: 8, paddingBottom: 28 },
  label: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  reason: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  message: { color: colors.white, fontSize: 12, lineHeight: 18 },
  copy: { minHeight: 43, marginTop: 12 },
  actions: { paddingVertical: 0, paddingHorizontal: 12 },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  lastAction: { borderBottomWidth: 0 },
  actionText: { color: colors.white, fontSize: 13 },
});
