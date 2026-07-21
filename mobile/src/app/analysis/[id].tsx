import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  FileCheck2,
  ListChecks,
  MessageSquareText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkBackground, GlassCard, LimeButton } from '@/components/reference-ui';
import { CopyMessageButton } from '@/components/copy-message-button';
import { DeviceThumbnail } from '@/components/device-thumbnail';
import { ScoreGauge } from '@/components/score-gauge';
import { useAnalysisReport } from '@/hooks/use-analysis-report';
import { requestInAppReviewForMilestone } from '@/services/app-review';
import { runtime } from '@/services/runtime';
import { telemetry } from '@/services/telemetry';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';
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

const SECTION_ICON: Record<SectionKey, LucideIcon> = {
  signals: BadgeCheck,
  savings: ChartNoAxesCombined,
  price: Tag,
  proofs: FileCheck2,
  risks: ShieldAlert,
  primary: Zap,
  message: MessageSquareText,
  checklist: ListChecks,
  expert: Search,
};

export default function AnalysisReportScreen() {
  const { id, review } = useLocalSearchParams<{ id: string; review?: string }>();
  const { reports } = useAppStore();
  const { report, loading } = useAnalysisReport(id);
  const scrollRef = useRef<ScrollView>(null);
  const stickyHeightRef = useRef(66);
  const stickyTopRef = useRef(0);
  const offsets = useRef<Partial<Record<SectionKey, number>>>({});
  const baseOrder = SECTION_ORDER[report?.templateId ?? 'VERIFY_FIRST'];
  const navigationItems = baseOrder.slice(0, 5);
  const [promotedSection, setPromotedSection] = useState<SectionKey | null>(null);
  const order = promotedSection && baseOrder.includes(promotedSection)
    ? [promotedSection, ...baseOrder.filter((key) => key !== promotedSection)]
    : baseOrder;
  const [activeSection, setActiveSection] = useState<SectionKey>(navigationItems[0]);
  const activeSectionRef = useRef<SectionKey>(navigationItems[0]);
  const openedReportRef = useRef<string | null>(null);
  const visibleActiveSection = navigationItems.includes(activeSection) ? activeSection : navigationItems[0];

  useEffect(() => {
    if (!report) return;
    if (openedReportRef.current !== report.id) {
      openedReportRef.current = report.id;
      telemetry.capture('report_opened', {
        analysis_id: report.id,
        device_category: report.device.category,
        verdict: report.verdict.type,
        deal_score: report.verdict.dealScore,
        template_id: report.templateId,
      });
    }
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      const feedback = report.templateId === 'PASS'
        ? Haptics.NotificationFeedbackType.Error
        : report.templateId === 'BUY'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning;
      void Haptics.notificationAsync(feedback);
    });
  }, [report]);

  useEffect(() => {
    if (!report || review !== 'first_premium_analysis') return;
    const timeout = setTimeout(() => {
      void requestInAppReviewForMilestone('first_premium_analysis').then((result) => {
        telemetry.capture('app_review_prompt_finished', { result, source: 'first_premium_analysis' });
      });
    }, 1_000);
    return () => clearTimeout(timeout);
  }, [report, review]);

  if (loading || !report) {
    return <DarkBackground variant="focus"><SafeAreaView style={styles.loading}><ActivityIndicator color={colors.lime} /><Text style={styles.loadingText}>Chargement du rapport…</Text></SafeAreaView></DarkBackground>;
  }

  const register = (key: SectionKey) => (event: LayoutChangeEvent) => {
    offsets.current[key] = event.nativeEvent.layout.y;
  };
  const selectSection = (key: SectionKey) => {
    if (activeSectionRef.current === key) return;
    activeSectionRef.current = key;
    setActiveSection(key);
  };
  const navigate = (key: SectionKey) => {
    selectSection(key);
    offsets.current = {};
    setPromotedSection(key);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, stickyTopRef.current), animated: true });
    });
  };
  const trackActiveSection = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const marker = event.nativeEvent.contentOffset.y + stickyHeightRef.current + 16;
    const positionedItems = navigationItems
      .map((key) => ({ key, y: offsets.current[key] }))
      .filter((item): item is { key: SectionKey; y: number } => typeof item.y === 'number')
      .sort((left, right) => left.y - right.y);
    let next = promotedSection && navigationItems.includes(promotedSection)
      ? promotedSection
      : navigationItems[0];
    for (const item of positionedItems) {
      if (item.y <= marker) next = item.key;
    }
    selectSection(next);
  };

  return (
    <DarkBackground variant={report.templateId === 'PASS' ? 'soft' : 'focus'}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[2]}
          contentContainerStyle={styles.scroll}
          onScroll={trackActiveSection}
          scrollEventThrottle={32}
        >
          <ListingHeader report={report} />
          <VerdictHero report={report} />
          <StickyNav
            activeItem={visibleActiveSection}
            items={navigationItems}
            onLayout={(event) => {
              stickyHeightRef.current = event.nativeEvent.layout.height;
              stickyTopRef.current = event.nativeEvent.layout.y;
            }}
            onPress={navigate}
          />
          {runtime.devTools && reports[report.id] ? <Pressable onPress={() => router.push({ pathname: '/analysis-progress', params: { id: report.id, replay: '1' } })} style={styles.replayButton}><Text style={styles.replayText}>Revoir l’animation d’analyse</Text></Pressable> : null}
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
  const compactSpecs = ['chip', 'memory', 'storage']
    .map((key) => report.device.specs[key])
    .filter((value): value is string | number => value !== undefined && value !== null)
    .map(String)
    .filter((value) => !report.device.displayName.toLocaleLowerCase('fr-FR').includes(value.toLocaleLowerCase('fr-FR')));
  const title = [report.device.displayName, ...compactSpecs].join(' · ');
  return (
    <View style={styles.listingRow}>
      <Pressable accessibilityLabel="Retourner à l’accueil" hitSlop={8} onPress={() => router.replace('/(tabs)')} style={styles.backButton}>
        <ArrowLeft size={23} color={colors.white} />
      </Pressable>
      <DeviceThumbnail uri={report.listing.thumbnailUrl} size={44} label={`Photo de l’annonce ${report.device.displayName}`} />
      <View style={styles.listingCopy}>
        <Text numberOfLines={1} style={styles.listingTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.listingMeta}>{formatEuros(report.listing.priceCents)} · {report.listing.location} · {report.listing.photoCount} photos</Text>
      </View>
    </View>
  );
}

function VerdictHero({ report }: { report: AnalysisResult }) {
  return (
    <View style={styles.verdictHero}>
      <ScoreGauge score={report.verdict.dealScore} size={244} label="Score DealUp" />
      <Text style={styles.verdictTitle}>{report.verdict.headline}</Text>
      <Text style={styles.verdictBody}>{report.verdict.explanation}</Text>
    </View>
  );
}

function StickyNav({ activeItem, items, onLayout, onPress }: { activeItem: SectionKey; items: SectionKey[]; onLayout: (event: LayoutChangeEvent) => void; onPress: (key: SectionKey) => void }) {
  return (
    <View onLayout={onLayout} style={styles.stickyShell}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickyNav}>
        {items.map((item) => {
          const active = item === activeItem;
          const Icon = SECTION_ICON[item];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item}
              onPress={() => onPress(item)}
              style={({ pressed }) => [styles.stickyPill, active && styles.stickyPillActive, pressed && styles.stickyPillPressed]}
            >
              <Icon color={active ? colors.lime : colors.inkMuted} size={16} strokeWidth={active ? 2.4 : 2} />
              <Text style={[styles.stickyText, active && styles.stickyTextActive]}>{SECTION_LABEL[item]}</Text>
            </Pressable>
          );
        })}
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
      <SectionTitle eyebrow="Points forts" title="Pourquoi ce deal tient la route" />
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
        <SectionTitle eyebrow="Prix" title="Estimation à confirmer" />
        <GlassCard style={styles.cardPad}><View style={styles.warningLine}><AlertTriangle size={20} color={colors.amber} /><Text style={styles.mutedText}>{pricing.commentary}</Text></View></GlassCard>
      </>
    );
  }
  return (
    <>
      <SectionTitle eyebrow="Prix" title={report.templateId === 'BUY' ? 'Un prix cohérent' : 'Ton plan de négociation'} />
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
      <SectionTitle eyebrow="Avant de continuer" title="Les preuves qui peuvent tout changer" />
      <View style={styles.proofList}>
        {report.missingInformation.map((item, index) => (
          <GlassCard key={item.code} style={styles.proofCard}>
            <View style={styles.proofNumber}><Text style={styles.proofNumberText}>{index + 1}</Text></View>
            <View style={styles.proofCopy}><Text style={styles.proofTitle}>{item.label}</Text><Text style={styles.proofReason}>{item.reason}</Text><Text style={styles.proofQuestion}>{item.question}</Text></View>
          </GlassCard>
        ))}
      </View>
    </>
  );
}

function RisksSection({ report }: { report: AnalysisResult }) {
  return (
    <>
      <SectionTitle eyebrow={report.templateId === 'PASS' ? 'Blocages' : 'Points à vérifier'} title={report.templateId === 'PASS' ? 'Pourquoi DealUp te conseille de passer' : 'Ce qu’il reste à vérifier'} />
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
  const usePrimaryAction = () => {
    if (compare) {
      telemetry.capture('recommended_action_used', { analysis_id: report.id, action_type: report.primaryAction.type, surface: 'report' });
      router.replace('/(tabs)');
      return;
    }
    router.push({ pathname: '/report-actions', params: { id: report.id } });
  };
  return (
    <>
      <SectionTitle eyebrow="Prochaine étape" title="L’action la plus utile maintenant" />
      <GlassCard style={styles.cardPad}>
        <View style={styles.primaryTop}><View style={styles.primaryIcon}>{compare ? <ShieldAlert size={23} color={colors.red} /> : <ShieldCheck size={23} color={colors.lime} />}</View><View style={styles.primaryCopy}><Text style={styles.primaryTitle}>{report.primaryAction.label}</Text><Text style={styles.primaryBody}>{report.primaryAction.reason}</Text></View></View>
        <LimeButton label={compare ? 'Analyser une autre annonce' : report.primaryAction.label} onPress={usePrimaryAction} style={styles.sectionButton} />
      </GlassCard>
    </>
  );
}

function MessageSection({ report }: { report: AnalysisResult }) {
  const message = report.templateId === 'NEGOTIATE' ? report.messages.makeOffer : report.messages.requestProofs;
  const messageType = report.templateId === 'NEGOTIATE' ? 'make_offer' : 'request_proofs';
  return (
    <>
      <SectionTitle eyebrow="Message au vendeur" title="Prêt à envoyer" />
      <GlassCard style={styles.cardPad}><Text style={styles.message}>{message}</Text><CopyMessageButton message={message} onCopied={() => {
        telemetry.capture('seller_message_copied', { analysis_id: report.id, message_type: messageType, surface: 'report' });
        if (report.primaryAction.type === 'REQUEST_PROOFS') {
          telemetry.capture('recommended_action_used', { analysis_id: report.id, action_type: report.primaryAction.type, surface: 'report_message' });
        }
      }} style={styles.copyButton} /></GlassCard>
    </>
  );
}

function ChecklistSection({ report }: { report: AnalysisResult }) {
  const preview = [...report.checklist.beforeMeeting, ...report.checklist.duringMeeting, ...report.checklist.beforePayment].slice(0, 4);
  return (
    <>
      <SectionTitle eyebrow="Checklist" title={report.device.category === 'MACBOOK' ? 'Les contrôles essentiels du Mac' : 'Les contrôles essentiels de l’iPhone'} />
      <GlassCard style={styles.cardPad}>{preview.map((item) => <View key={item.code} style={styles.checkRow}><ListChecks size={17} color={item.critical ? colors.lime : colors.inkMuted} /><Text style={styles.signalText}>{item.label}</Text></View>)}<LimeButton label="Ouvrir la checklist complète" onPress={() => {
        if (report.primaryAction.type === 'START_CHECKLIST') {
          telemetry.capture('recommended_action_used', { analysis_id: report.id, action_type: report.primaryAction.type, surface: 'report_checklist' });
        }
        router.push({ pathname: '/checklist', params: { id: report.id } });
      }} style={styles.sectionButton} /></GlassCard>
    </>
  );
}

function ExpertSection({ report }: { report: AnalysisResult }) {
  return (
    <>
      <SectionTitle eyebrow="L’avis DealUp" title="Ce que DealUp retient" />
      <GlassCard style={styles.cardPad}><Text style={styles.expertText}>{report.expertNote ?? report.verdict.explanation}</Text>{report.changeSummary?.map((item) => <View key={item} style={styles.signalRow}><CheckCircle2 size={16} color={colors.lime} /><Text style={styles.signalText}>{item}</Text></View>)}</GlassCard>
      <Pressable onPress={() => router.push({ pathname: '/reanalyze', params: { id: report.id } })} style={styles.sellerReply}><View style={styles.replyIcon}><MessageSquareText size={20} color={colors.lime} /></View><View style={styles.replyCopy}><Text style={styles.replyTitle}>Le vendeur t’a répondu ?</Text><Text style={styles.replyBody}>Ajoute son message pour mettre à jour cette analyse.</Text></View><ArrowUpRight size={19} color={colors.inkMuted} /></Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: colors.inkMuted, fontSize: 13 },
  safe: { flex: 1 }, scroll: { paddingHorizontal: layout.gutter, paddingBottom: 46 },
  listingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 }, backButton: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }, listingCopy: { flex: 1, paddingRight: 4 }, listingTitle: { color: colors.white, fontSize: 14, fontWeight: '600' }, listingMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 3 },
  verdictHero: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 }, verdictTitle: { ...type.h2, color: colors.white, textAlign: 'center', marginTop: 14, maxWidth: 350 }, verdictBody: { color: colors.inkMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 350, marginTop: 10 },
  replayButton: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, marginTop: 4, marginBottom: -8 }, replayText: { color: colors.inkMuted, fontSize: 11, textDecorationLine: 'underline' },
  stickyShell: { marginHorizontal: -layout.gutter, paddingVertical: 11 }, stickyNav: { paddingHorizontal: layout.gutter, gap: 7 }, stickyPill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 13, backgroundColor: 'rgba(7,54,42,.72)', borderWidth: 1, borderColor: colors.borderStrong, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, stickyPillActive: { backgroundColor: 'rgba(20,83,55,.92)', borderColor: 'rgba(196,245,42,.50)', shadowColor: colors.lime, shadowOpacity: .20, shadowRadius: 9 }, stickyPillPressed: { opacity: .72 }, stickyText: { color: colors.inkMuted, fontSize: 11, fontWeight: '600' }, stickyTextActive: { color: colors.white, fontWeight: '700' },
  sectionTitle: { marginTop: 30, marginBottom: 11 }, sectionEyebrow: { color: '#7F958B', fontSize: 13, lineHeight: 17, fontWeight: '600' }, sectionHeading: { ...type.h2, color: colors.white, fontSize: 21, marginTop: 3 }, cardPad: { padding: 16 }, mutedText: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, flex: 1 },
  savingCard: { minHeight: 122, borderRadius: 19, backgroundColor: colors.lime, marginTop: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: colors.lime, shadowOpacity: .24, shadowRadius: 20 }, savingEyebrow: { color: colors.brand700, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, savingLabel: { color: colors.brand900, fontSize: 19, fontWeight: '600', marginTop: 5 }, savingAmount: { fontSize: 36, fontWeight: '800' }, savingHint: { color: colors.brand700, fontSize: 11, marginTop: 2 }, savingIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,38,24,.12)', alignItems: 'center', justifyContent: 'center' },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }, signalText: { color: '#DCE7E1', fontSize: 12, lineHeight: 18, flex: 1 }, warningLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  priceTrack: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }, trackGreen: { flex: 1.2, backgroundColor: '#52C86C' }, trackAmber: { flex: .8, backgroundColor: colors.amber }, trackRed: { flex: .45, backgroundColor: colors.red }, priceColumns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 }, pricePoint: { width: '32%', alignItems: 'center' }, priceValue: { color: colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' }, priceLabel: { color: colors.inkMuted, fontSize: 9, marginTop: 3 }, priceComment: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 14 },
  proofList: { gap: 9 }, proofCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, proofNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, proofNumberText: { color: colors.brand900, fontWeight: '800' }, proofCopy: { flex: 1 }, proofTitle: { color: colors.white, fontSize: 13, fontWeight: '700' }, proofReason: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 }, proofQuestion: { color: '#C3E86A', fontSize: 11, lineHeight: 17, marginTop: 7 },
  riskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, riskIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' }, riskIconCritical: { backgroundColor: colors.redSoft }, riskCopy: { flex: 1 }, riskTitle: { color: colors.white, fontSize: 14, fontWeight: '700' }, riskBody: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 }, riskCheck: { color: colors.lime, fontSize: 10, lineHeight: 15, marginTop: 8 },
  primaryTop: { flexDirection: 'row', gap: 12 }, primaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(196,245,42,.10)', alignItems: 'center', justifyContent: 'center' }, primaryCopy: { flex: 1 }, primaryTitle: { color: colors.white, fontSize: 15, fontWeight: '700' }, primaryBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 5 }, sectionButton: { marginTop: 16, minHeight: 48 },
  message: { color: colors.white, fontSize: 12, lineHeight: 18 }, copyButton: { minHeight: 46, marginTop: 15 }, checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 }, expertText: { color: colors.white, fontSize: 13, lineHeight: 20, marginBottom: 15 },
  sellerReply: { minHeight: 74, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.darkCard, borderRadius: 16, marginTop: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, replyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(196,245,42,.10)', alignItems: 'center', justifyContent: 'center' }, replyCopy: { flex: 1 }, replyTitle: { color: colors.white, fontSize: 13, fontWeight: '700' }, replyBody: { color: colors.inkMuted, fontSize: 10, marginTop: 3 },
  privateNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 28 }, privateText: { color: colors.inkSoft, fontSize: 10 },
});
