import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { CopyMessageButton } from '@/components/copy-message-button';
import { useAnalysisReport } from '@/hooks/use-analysis-report';
import { telemetry } from '@/services/telemetry';
import { colors, layout } from '@/theme/tokens';

export default function ActionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { report } = useAnalysisReport(id);
  const [recommendedCopied, setRecommendedCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);
  if (!report) return <DarkSafeScreen variant="focus"><DarkHeader title="Actions" /></DarkSafeScreen>;
  const message = report.primaryAction.type === 'MAKE_OFFER'
    ? report.messages.makeOffer
    : report.primaryAction.type === 'AVOID_LISTING'
      ? report.messages.decline
      : report.messages.requestProofs;
  const messageType = report.primaryAction.type === 'MAKE_OFFER'
    ? 'make_offer'
    : report.primaryAction.type === 'AVOID_LISTING'
      ? 'decline'
      : 'request_proofs';
  const copyMessage = (surface: string) => {
    telemetry.capture('seller_message_copied', { analysis_id: report.id, message_type: messageType, surface });
  };
  const copyRecommendedMessage = async () => {
    await Clipboard.setStringAsync(message);
    copyMessage('recommended_action');
    setRecommendedCopied(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setRecommendedCopied(false), 2200);
  };
  const useRecommendedAction = () => {
    telemetry.capture('recommended_action_used', {
      analysis_id: report.id,
      action_type: report.primaryAction.type,
      surface: 'actions',
    });
    if (report.primaryAction.type === 'MAKE_OFFER') {
      router.push({ pathname: '/make-offer', params: { id: report.id } });
    } else if (report.primaryAction.type === 'START_CHECKLIST') {
      router.push({ pathname: '/checklist', params: { id: report.id } });
    } else if (report.primaryAction.type === 'COMPARE_ANOTHER' || report.primaryAction.type === 'AVOID_LISTING') {
      router.replace('/(tabs)');
    } else {
      void copyRecommendedMessage();
    }
  };

  return (
    <DarkSafeScreen variant="focus" edges={['top', 'left', 'right']}>
      <DarkHeader title="Actions" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>ACTION RECOMMANDÉE</Text>
        <LimeButton
          label={recommendedCopied ? 'Message copié' : report.primaryAction.label}
          icon={recommendedCopied ? <Check size={18} color={colors.brand900} strokeWidth={3} /> : undefined}
          onPress={useRecommendedAction}
        />
        <Text style={styles.reason}>{report.primaryAction.reason}</Text>
        <Text style={styles.label}>MESSAGE PRÊT À ENVOYER</Text>
        <GlassCard>
          <Text style={styles.message}>{message}</Text>
          <CopyMessageButton
            message={message}
            onCopied={() => copyMessage('actions')}
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
