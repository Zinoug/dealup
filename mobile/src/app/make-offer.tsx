import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { CopyMessageButton } from '@/components/copy-message-button';
import { useAnalysisReport } from '@/hooks/use-analysis-report';
import { telemetry } from '@/services/telemetry';
import { colors, layout } from '@/theme/tokens';
import { formatEuros } from '@/utils/format';

export default function MakeOfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { report } = useAnalysisReport(id);
  if (!report) return <DarkSafeScreen variant="focus"><DarkHeader title="Faire une offre" /></DarkSafeScreen>;
  const pricing = report.pricing;
  const opening = pricing.openingOfferCents;
  const agreementLow = pricing.agreementZoneLowCents;
  const agreementHigh = pricing.agreementZoneHighCents;
  const maximum = pricing.maxRecommendedCents;
  const available = pricing.status === 'AVAILABLE'
    && opening !== null
    && agreementLow !== null
    && agreementHigh !== null
    && maximum !== null;

  return (
    <DarkSafeScreen variant="focus">
      <DarkHeader title="Faire une offre" />
      <View style={styles.body}>
        <GlassCard style={styles.recommendation}>
          <Text style={styles.eyebrow}>NOTRE RECOMMANDATION</Text>
          {available ? (
            <>
              <Text style={styles.price}>{formatEuros(opening!)}</Text>
              <Text style={styles.muted}>Première offre conseillée</Text>
              <View style={styles.separator} />
              <Text style={styles.muted}>Bonne zone d’accord</Text>
              <Text style={styles.range}>{formatEuros(agreementLow!)} – {formatEuros(agreementHigh!)}</Text>
              <Text style={[styles.muted, styles.maxLabel]}>Maximum à ne pas dépasser</Text>
              <Text style={styles.range}>{formatEuros(maximum!)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.unavailable}>Prix à confirmer</Text>
              <Text style={styles.muted}>{pricing.commentary}</Text>
            </>
          )}
        </GlassCard>
        <GlassCard style={styles.messageCard}>
          <Text style={styles.messageTitle}>Message d’offre prêt à envoyer</Text>
          <Text style={styles.messageText}>{report.messages.makeOffer}</Text>
          <CopyMessageButton
            message={report.messages.makeOffer}
            onCopied={() => {
              telemetry.capture('seller_message_copied', { analysis_id: report.id, message_type: 'make_offer', surface: 'make_offer' });
              if (report.primaryAction.type === 'MAKE_OFFER') {
                telemetry.capture('recommended_action_used', { analysis_id: report.id, action_type: report.primaryAction.type, surface: 'make_offer' });
              }
            }}
            style={styles.copy}
          />
        </GlassCard>
        <LimeButton label="Revenir au rapport" onPress={() => router.back()} style={styles.bottom} />
      </View>
    </DarkSafeScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: layout.gutter, paddingTop: 12 },
  recommendation: { padding: 16 },
  eyebrow: { color: colors.lime, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  price: { color: colors.white, fontSize: 40, fontWeight: '500', marginTop: 10 },
  unavailable: { color: colors.white, fontSize: 28, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  muted: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: 17 },
  range: { color: colors.white, fontSize: 20, marginTop: 5 },
  maxLabel: { marginTop: 22 },
  messageCard: { marginTop: 14 },
  messageTitle: { color: colors.white, fontSize: 13, fontWeight: '600' },
  messageText: { color: colors.white, fontSize: 12, lineHeight: 18, marginTop: 14 },
  copy: { minHeight: 43, marginTop: 16 },
  bottom: { marginTop: 'auto', marginBottom: 6 },
});
