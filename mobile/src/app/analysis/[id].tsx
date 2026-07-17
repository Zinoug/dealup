import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Laptop,
  ListChecks,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkBackground, DarkHeader, GlassCard, LimeButton, SourcePill } from '@/components/reference-ui';
import { ScoreGauge } from '@/components/score-gauge';
import { demoAnalysis, reportFixtures } from '@/data/mock';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, type } from '@/theme/tokens';
import type { AnalysisResult, ReportTemplate } from '@/types/domain';
import { formatEuros } from '@/utils/format';

type SectionKey = 'signals' | 'savings' | 'price' | 'proofs' | 'risks' | 'primary' | 'message' | 'checklist' | 'expert';

const SECTION_ORDER: Record<ReportTemplate, SectionKey[]> = {
  BUY: ['signals', 'price', 'primary', 'checklist', 'risks', 'expert'],
  NEGOTIATE: ['savings', 'price', 'primary', 'message', 'risks', 'checklist', 'expert'],
  VERIFY_FIRST: ['proofs', 'message', 'risks', 'price', 'checklist', 'expert'],
  PASS: ['risks', 'expert', 'primary'],
};

const SECTION_LABEL: Record<SectionKey, string> = {
  signals: 'Signaux',
  savings: 'Économie',
  price: 'Prix',
  proofs: 'Preuves',
  risks: 'Risques',
  primary: 'Action',
  message: 'Message',
  checklist: 'Checklist',
  expert: 'Analyse',
};

const verdictLabels = { BUY: 'ACHETER', NEGOTIATE: 'NÉGOCIER', VERIFY_FIRST: 'VÉRIFIER D’ABORD', PASS: 'PASSER' } as const;
const verdictColors = { BUY: colors.lime, NEGOTIATE: colors.orange, VERIFY_FIRST: colors.amber, PASS: colors.red } as const;

export default function AnalysisReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { analyses } = useAppStore();
  const fixture = Object.values(reportFixtures).find((item) => item.id === id);
  const report = analyses.find((item) => item.id === id) ?? fixture ?? demoAnalysis;
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionKey, number>>>({});
  const order = SECTION_ORDER[report.templateId];

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      const feedback = report.templateId === 'PASS'
        ? Haptics.NotificationFeedbackType.Error
        : report.templateId === 'BUY'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning;
      void Haptics.notificationAsync(feedback);
    });
  }, [report.templateId]);

  const register = (key: SectionKey) => (event: LayoutChangeEvent) => {
    offsets.current[key] = event.nativeEvent.layout.y;
  };
  const navigate = (key: SectionKey) => {
    const y = offsets.current[key];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 58), animated: true });
  };

  return (
    <DarkBackground variant={report.templateId === 'PASS' ? 'soft' : 'focus'}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <DarkHeader title="RAPPORT DEALUP" />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[2]}
          contentContainerStyle={styles.scroll}
        >
          <ListingHeader report={report} />
          <VerdictHero report={report} />
          <StickyNav items={order.slice(0, 5)} onPress={navigate} />
          {order.map((key) => (
            <View key={key} onLayout={register(key)}>
              <ReportSection section={key} report={report} />
            </View>
          ))}
          <View style={styles.privateNote}>
            <ShieldCheck size={13} color={colors.lime} />
            <Text style={styles.privateText}>Ce rapport et les réponses du vendeur restent privés.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </DarkBackground>
  );
}

function ListingHeader({ report }: { report: AnalysisResult }) {
  const Icon = report.device.category === 'MACBOOK' ? Laptop : Smartphone;
  return (
    <View style={styles.listingRow}>
      <View style={styles.deviceThumb}><Icon size={28} color={colors.lime} /></View>
      <View style={styles.listingCopy}>
        <Text numberOfLines={1} style={styles.listingTitle}>{report.device.displayName}</Text>
        <Text style={styles.listingMeta}>{formatEuros(report.listing.priceCents)} · {report.listing.location}</Text>
      </View>
      <SourcePill />
    </View>
  );
}

function VerdictHero({ report }: { report: AnalysisResult }) {
  const accent = verdictColors[report.templateId];
  return (
    <View style={styles.verdictHero}>
      <View style={[styles.badge, { borderColor: accent, backgroundColor: `${accent}1F` }]}>
        <Text style={[styles.badgeText, { color: accent }]}>{verdictLabels[report.templateId]}</Text>
      </View>
      <ScoreGauge score={report.verdict.dealScore} size={214} label="Score DealUp" />
      <Text style={styles.verdictTitle}>{report.verdict.headline}</Text>
      <Text style={styles.verdictBody}>{report.verdict.explanation}</Text>
    </View>
  );
}

function StickyNav({ items, onPress }: { items: SectionKey[]; onPress: (key: SectionKey) => void }) {
  return (
    <View style={styles.stickyShell}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickyNav}>
        {items.map((item) => (
          <Pressable key={item} onPress={() => onPress(item)} style={styles.stickyPill}>
            <Text style={styles.stickyText}>{SECTION_LABEL[item]}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ReportSection({ section, report }: { section: SectionKey; report: AnalysisResult }) {
  switch (section) {
    case 'signals': return <SignalsSection report={report} />;
    case 'savings': return <SavingsSection report={report} />;
    case 'price': return <PriceSection report={report} />;
    case 'proofs': return <ProofsSection report={report} />;
    case 'risks': return <RisksSection report={report} />;
    case 'primary': return <PrimarySection report={report} />;
    case 'message': return <MessageSection report={report} />;
    case 'checklist': return <ChecklistSection report={report} />;
    case 'expert': return <ExpertSection report={report} />;
  }
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionHeading}>{title}</Text></View>;
}

function SavingsSection({ report }: { report: AnalysisResult }) {
  const savings = report.pricing.potentialSavingsCents;
  if (!savings) return null;
  return (
    <View style={styles.savingCard}>
      <View><Text style={styles.savingEyebrow}>ÉCONOMIES POSSIBLES</Text><Text style={styles.savingLabel}>Jusqu’à <Text style={styles.savingAmount}>{formatEuros(savings)}</Text></Text><Text style={styles.savingHint}>en négociant au bon niveau</Text></View>
      <View style={styles.savingIcon}><Sparkles size={24} color={colors.brand900} /></View>
    </View>
  );
}

function SignalsSection({ report }: { report: AnalysisResult }) {
  return (
    <>
      <SectionTitle eyebrow="POINTS FORTS" title="Pourquoi ce deal tient la route" />
      <GlassCard style={styles.cardPad}>
        {report.positiveSignals.length ? report.positiveSignals.map((signal) => (
          <View key={signal.code} style={styles.signalRow}><CheckCircle2 size={18} color={colors.lime} /><Text style={styles.signalText}>{signal.label}</Text></View>
        )) : <Text style={styles.mutedText}>Aucun signal positif suffisamment étayé n’a été retenu.</Text>}
      </GlassCard>
    </>
  );
}

function PriceSection({ report }: { report: AnalysisResult }) {
  const pricing = report.pricing;
  if (pricing.status === 'UNAVAILABLE' || pricing.openingOfferCents === null || pricing.agreementZoneLowCents === null || pricing.agreementZoneHighCents === null || pricing.maxRecommendedCents === null) {
    return (
      <>
        <SectionTitle eyebrow="PRIX" title="Estimation à confirmer" />
        <GlassCard style={styles.cardPad}><View style={styles.warningLine}><AlertTriangle size={20} color={colors.amber} /><Text style={styles.mutedText}>{pricing.commentary}</Text></View></GlassCard>
      </>
    );
  }
  return (
    <>
      <SectionTitle eyebrow="PRIX" title={report.templateId === 'BUY' ? 'Un prix cohérent' : 'Ton plan de négociation'} />
      <GlassCard style={styles.cardPad}>
        <View style={styles.priceTrack}><View style={styles.trackGreen} /><View style={styles.trackAmber} /><View style={styles.trackRed} /></View>
        <View style={styles.priceColumns}>
          <PricePoint value={formatEuros(pricing.openingOfferCents)} label="Première offre" />
          <PricePoint value={`${formatEuros(pricing.agreementZoneLowCents)}–${formatEuros(pricing.agreementZoneHighCents)}`} label="Zone d’accord" />
          <PricePoint value={formatEuros(pricing.maxRecommendedCents)} label="Maximum" />
        </View>
        <Text style={styles.priceComment}>{pricing.commentary}</Text>
      </GlassCard>
    </>
  );
}

function PricePoint({ value, label }: { value: string; label: string }) {
  return <View style={styles.pricePoint}><Text style={styles.priceValue}>{value}</Text><Text style={styles.priceLabel}>{label}</Text></View>;
}

function ProofsSection({ report }: { report: AnalysisResult }) {
  return (
    <>
      <SectionTitle eyebrow="AVANT DE CONTINUER" title="Les preuves qui peuvent tout changer" />
      <View style={styles.proofList}>
        {report.missingInformation.map((item, index) => (
          <GlassCard key={item.code} style={styles.proofCard}>
            <View style={styles.proofNumber}><Text style={styles.proofNumberText}>{index + 1}</Text></View>
            <View style={styles.proofCopy}><Text style={styles.proofTitle}>{item.label}</Text><Text style={styles.proofQuestion}>{item.question}</Text></View>
          </GlassCard>
        ))}
      </View>
    </>
  );
}

function RisksSection({ report }: { report: AnalysisResult }) {
  return (
    <>
      <SectionTitle eyebrow={report.templateId === 'PASS' ? 'BLOCAGES' : 'VIGILANCE'} title={report.templateId === 'PASS' ? 'Pourquoi DealUp te conseille de passer' : 'Ce qu’il reste à vérifier'} />
      <View style={styles.proofList}>
        {report.risks.items.length ? report.risks.items.map((risk) => (
          <GlassCard key={`${risk.code}-${risk.displayTitle}`} style={styles.riskCard}>
            <View style={[styles.riskIcon, risk.severity === 'CRITICAL' && styles.riskIconCritical]}><ShieldAlert size={21} color={risk.severity === 'CRITICAL' ? colors.red : colors.amber} /></View>
            <View style={styles.riskCopy}><Text style={styles.riskTitle}>{risk.displayTitle}</Text><Text style={styles.riskBody}>{risk.commentary}</Text><Text style={styles.riskCheck}>{risk.recommendedCheck}</Text></View>
          </GlassCard>
        )) : <GlassCard><Text style={styles.mutedText}>Aucun risque important n’a été confirmé, mais termine toujours les contrôles sur place.</Text></GlassCard>}
      </View>
    </>
  );
}

function PrimarySection({ report }: { report: AnalysisResult }) {
  const compare = report.templateId === 'PASS';
  return (
    <>
      <SectionTitle eyebrow="PROCHAINE ÉTAPE" title="L’action la plus utile maintenant" />
      <GlassCard style={styles.cardPad}>
        <View style={styles.primaryTop}><View style={styles.primaryIcon}>{compare ? <ShieldAlert size={23} color={colors.red} /> : <ShieldCheck size={23} color={colors.lime} />}</View><View style={styles.primaryCopy}><Text style={styles.primaryTitle}>{report.primaryAction.label}</Text><Text style={styles.primaryBody}>{report.primaryAction.reason}</Text></View></View>
        <LimeButton label={compare ? 'Analyser une autre annonce' : report.primaryAction.label} onPress={() => compare ? router.replace('/(tabs)') : router.push({ pathname: '/report-actions', params: { id: report.id } })} style={styles.sectionButton} />
      </GlassCard>
    </>
  );
}

function MessageSection({ report }: { report: AnalysisResult }) {
  const message = report.templateId === 'NEGOTIATE' ? report.messages.makeOffer : report.messages.requestProofs;
  return (
    <>
      <SectionTitle eyebrow="MESSAGE VENDEUR" title="Prêt à envoyer" />
      <GlassCard style={styles.cardPad}><Text style={styles.message}>{message}</Text><Pressable onPress={() => void Clipboard.setStringAsync(message)} style={styles.copyButton}><Copy size={17} color={colors.brand900} /><Text style={styles.copyText}>Copier le message</Text></Pressable></GlassCard>
    </>
  );
}

function ChecklistSection({ report }: { report: AnalysisResult }) {
  const preview = [...report.checklist.beforeMeeting, ...report.checklist.duringMeeting, ...report.checklist.beforePayment].slice(0, 4);
  return (
    <>
      <SectionTitle eyebrow="CHECKLIST" title={report.device.category === 'MACBOOK' ? 'Les contrôles essentiels du Mac' : 'Les contrôles essentiels de l’iPhone'} />
      <GlassCard style={styles.cardPad}>{preview.map((item) => <View key={item.code} style={styles.checkRow}><ListChecks size={17} color={item.critical ? colors.lime : colors.inkMuted} /><Text style={styles.signalText}>{item.label}</Text></View>)}<LimeButton label="Ouvrir la checklist complète" onPress={() => router.push({ pathname: '/checklist', params: { id: report.id } })} style={styles.sectionButton} /></GlassCard>
    </>
  );
}

function ExpertSection({ report }: { report: AnalysisResult }) {
  return (
    <>
      <SectionTitle eyebrow="REGARD D’EXPERT" title="Ce que DealUp retient" />
      <GlassCard style={styles.cardPad}><Text style={styles.expertText}>{report.expertNote ?? report.verdict.explanation}</Text>{report.changeSummary?.map((item) => <View key={item} style={styles.signalRow}><CheckCircle2 size={16} color={colors.lime} /><Text style={styles.signalText}>{item}</Text></View>)}</GlassCard>
      <Pressable onPress={() => router.push({ pathname: '/reanalyze', params: { id: report.id } })} style={styles.sellerReply}><View style={styles.replyIcon}><MessageSquareText size={20} color={colors.lime} /></View><View style={styles.replyCopy}><Text style={styles.replyTitle}>Le vendeur t’a répondu ?</Text><Text style={styles.replyBody}>Ajoute son message pour mettre à jour cette analyse.</Text></View><ArrowUpRight size={19} color={colors.inkMuted} /></Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { paddingHorizontal: layout.gutter, paddingBottom: 46 },
  listingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }, deviceThumb: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(196,245,42,.10)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, listingCopy: { flex: 1 }, listingTitle: { color: colors.white, fontSize: 13, fontWeight: '600' }, listingMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 3 },
  verdictHero: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 }, badge: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 15, paddingVertical: 6 }, badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: .5 }, verdictTitle: { ...type.h2, color: colors.white, textAlign: 'center', marginTop: -4, maxWidth: 350 }, verdictBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 350, marginTop: 10 },
  stickyShell: { marginHorizontal: -layout.gutter, backgroundColor: 'rgba(0,27,20,.96)', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 9 }, stickyNav: { paddingHorizontal: layout.gutter, gap: 8 }, stickyPill: { height: 34, borderRadius: 17, paddingHorizontal: 14, backgroundColor: 'rgba(18,70,54,.78)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, stickyText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  sectionTitle: { marginTop: 30, marginBottom: 11 }, sectionEyebrow: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, sectionHeading: { ...type.h2, color: colors.white, fontSize: 21, marginTop: 3 }, cardPad: { padding: 16 }, mutedText: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  savingCard: { minHeight: 122, borderRadius: 19, backgroundColor: colors.lime, marginTop: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.lime, shadowOpacity: .24, shadowRadius: 20 }, savingEyebrow: { color: colors.brand700, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, savingLabel: { color: colors.brand900, fontSize: 19, fontWeight: '600', marginTop: 5 }, savingAmount: { fontSize: 36, fontWeight: '800' }, savingHint: { color: colors.brand700, fontSize: 11, marginTop: 2 }, savingIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,38,24,.12)', alignItems: 'center', justifyContent: 'center' },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }, signalText: { color: '#DCE7E1', fontSize: 12, lineHeight: 18, flex: 1 }, warningLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  priceTrack: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }, trackGreen: { flex: 1.2, backgroundColor: '#52C86C' }, trackAmber: { flex: .8, backgroundColor: colors.amber }, trackRed: { flex: .45, backgroundColor: colors.red }, priceColumns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 }, pricePoint: { width: '32%', alignItems: 'center' }, priceValue: { color: colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' }, priceLabel: { color: colors.inkMuted, fontSize: 9, marginTop: 3 }, priceComment: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 14 },
  proofList: { gap: 9 }, proofCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, proofNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, proofNumberText: { color: colors.brand900, fontWeight: '800' }, proofCopy: { flex: 1 }, proofTitle: { color: colors.white, fontSize: 13, fontWeight: '700' }, proofQuestion: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  riskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, riskIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' }, riskIconCritical: { backgroundColor: colors.redSoft }, riskCopy: { flex: 1 }, riskTitle: { color: colors.white, fontSize: 14, fontWeight: '700' }, riskBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 }, riskCheck: { color: colors.lime, fontSize: 10, lineHeight: 15, marginTop: 8 },
  primaryTop: { flexDirection: 'row', gap: 12 }, primaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(196,245,42,.10)', alignItems: 'center', justifyContent: 'center' }, primaryCopy: { flex: 1 }, primaryTitle: { color: colors.white, fontSize: 15, fontWeight: '700' }, primaryBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 5 }, sectionButton: { marginTop: 16, minHeight: 48 },
  message: { color: colors.white, fontSize: 12, lineHeight: 18 }, copyButton: { height: 46, borderRadius: 12, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 15 }, copyText: { color: colors.brand900, fontSize: 13, fontWeight: '700' }, checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 }, expertText: { color: colors.white, fontSize: 13, lineHeight: 20, marginBottom: 15 },
  sellerReply: { minHeight: 74, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.darkCard, borderRadius: 16, marginTop: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, replyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(196,245,42,.10)', alignItems: 'center', justifyContent: 'center' }, replyCopy: { flex: 1 }, replyTitle: { color: colors.white, fontSize: 13, fontWeight: '700' }, replyBody: { color: colors.inkMuted, fontSize: 10, marginTop: 3 },
  privateNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 28 }, privateText: { color: colors.inkSoft, fontSize: 10 },
});
