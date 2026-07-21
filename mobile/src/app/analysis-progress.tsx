import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, BarChart3, Check, FileSearch, House, Image as ImageIcon, RefreshCw, ShieldCheck, Timer } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppLogo } from '@/components/app-logo';
import { DeviceThumbnail } from '@/components/device-thumbnail';
import { DarkSafeScreen } from '@/components/reference-ui';
import { runtime } from '@/services/runtime';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';

const steps = [
  { label: 'Lecture de l’annonce', detail: 'Extraction des informations clés…', icon: FileSearch },
  { label: 'Inspection des photos', detail: 'Analyse des images et détection d’incohérences…', icon: ImageIcon },
  { label: 'Estimation du juste prix', detail: 'Comparaison avec le marché actuel…', icon: BarChart3 },
  { label: 'Verdict et plan d’action', detail: 'Préparation de tes recommandations…', icon: ShieldCheck },
];

const LIVE_STEP_DELAYS = [4_000, 13_000, 23_000] as const;
const REPLAY_DURATION_MS = 30_000;

type InspectionMedia = {
  uri: string;
  source: 'listing' | 'seller';
  sourceIndex: number;
  sourceTotal: number;
};

export default function ProgressScreen() {
  const { id, replay, parent } = useLocalSearchParams<{ id: string; replay?: string; parent?: string }>();
  const { completeAnalysis, retryAnalysis, identification, sellerMediaUris, reports, loadReplayMedia } = useAppStore();
  const [step, setStep] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [run, setRun] = useState(0);
  const [replayMedia, setReplayMedia] = useState<{ listing: string[]; seller: string[] }>({ listing: [], seller: [] });
  const { height } = useWindowDimensions();
  const compact = height < 800;
  const replayEnabled = runtime.devTools && replay === '1';
  const isReanalysis = Boolean(parent);
  const replayReport = replayEnabled && id ? reports[id] : undefined;
  const listing = replayReport?.listing ?? identification;
  const device = replayReport?.device ?? identification?.compatibility?.device;
  const inspectionMedia = useMemo<InspectionMedia[]>(() => {
    const listingUris = [...(replayReport ? replayMedia.listing : identification?.previewPhotoUrls ?? []), listing?.thumbnailUrl]
      .filter((uri): uri is string => Boolean(uri))
      .filter((uri, index, values) => values.indexOf(uri) === index)
      .slice(0, 6);
    const sellerUris = (replayReport ? replayMedia.seller : sellerMediaUris)
      .filter((uri, index, values) => values.indexOf(uri) === index && !listingUris.includes(uri))
      .slice(0, 10);
    return [
      ...listingUris.map((uri, index) => ({ uri, source: 'listing' as const, sourceIndex: index, sourceTotal: listingUris.length })),
      ...sellerUris.map((uri, index) => ({ uri, source: 'seller' as const, sourceIndex: index, sourceTotal: sellerUris.length })),
    ];
  }, [identification?.previewPhotoUrls, listing?.thumbnailUrl, replayMedia.listing, replayMedia.seller, replayReport, sellerMediaUris]);

  useEffect(() => {
    if (!replayEnabled || !id) return;
    void loadReplayMedia(id).then(setReplayMedia);
  }, [id, loadReplayMedia, replayEnabled]);

  useEffect(() => {
    if (failure) return;
    const timers = LIVE_STEP_DELAYS.map((delay, index) =>
      setTimeout(() => setStep((value) => Math.max(value, index + 1)), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [failure, replayEnabled, run]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    if (replayEnabled) {
      revealTimer = setTimeout(() => {
        if (!alive) return;
        setStep(4);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => router.replace({ pathname: '/analysis/[id]', params: { id } }), 720);
      }, REPLAY_DURATION_MS);
      return () => { alive = false; if (revealTimer) clearTimeout(revealTimer); };
    }
    Promise.all([
      completeAnalysis(id),
      new Promise((resolve) => setTimeout(resolve, 3500)),
    ]).then(([result]) => {
      if (result && alive) {
        setStep(4);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        revealTimer = setTimeout(() => router.replace({
          pathname: '/analysis/[id]',
          params: {
            id: result.id,
            reveal: '1',
            ...(!isReanalysis ? { review: 'first_premium_analysis' } : {}),
          },
        }), 720);
      }
    }).catch(() => {
      if (!alive) return;
      setFailure('failed');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
    return () => {
      alive = false;
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [completeAnalysis, id, isReanalysis, replayEnabled, run]);

  const retry = async () => {
    if (!id || retrying) return;
    setRetrying(true);
    const accepted = await retryAnalysis(id);
    setRetrying(false);
    if (!accepted) return;
    setFailure(null);
    setStep(0);
    setRun((value) => value + 1);
  };

  const logoSize = height > 880 ? 82 : compact ? 60 : 72;
  const price = listing?.priceCents != null ? `${Math.round(listing.priceCents / 100).toLocaleString('fr-FR')} €` : null;
  const meta = [price, listing?.location].filter(Boolean).join(' · ') || 'Annonce Leboncoin';

  return (
    <DarkSafeScreen variant="beams" edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, compact && styles.screenCompact]}>
      <View style={styles.header}>
        <DeviceThumbnail uri={listing?.thumbnailUrl} size={compact ? 36 : 42} />
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.product}>{device?.displayName ?? listing?.title ?? 'Annonce identifiée'}</Text>
          <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
        </View>
      </View>
      <DealupLogo size={logoSize} />
      <Text style={[styles.title, compact && styles.titleCompact]}>On soulève{`\n`}<Text style={styles.lime}>chaque détail.</Text></Text>
      <PhotoInspectionStage compact={compact} height={height} items={inspectionMedia} step={step} />
      <View style={[styles.steps, compact && styles.stepsCompact]}>
        {steps.map((item, index) => {
          const done = index < step;
          const current = index === step;
          const Icon = item.icon;
          return (
            <View key={item.label} style={[styles.step, compact && styles.stepCompact, done && styles.completedStep]}>
              <View style={styles.rail}>
                {index < 3 ? <View style={[styles.vertical, done && styles.verticalDone]} /> : null}
                <View style={[styles.circle, done && styles.done, current && styles.current]}>
                  {done ? <Check size={17} color={colors.brand900} strokeWidth={3.4} /> : <Icon size={17} color={current ? colors.lime : colors.inkSoft} />}
                </View>
              </View>
              <View style={styles.stepCopy}>
                <Text style={[styles.stepLabel, done && styles.completedLabel, !done && !current && styles.future, current && styles.currentLabel]}>{item.label}</Text>
                {current ? <Text numberOfLines={1} style={[styles.stepDetail, styles.activeDetail]}>{item.detail}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.timer}><Timer size={21} color={colors.lime} /><Text style={styles.timerText}>Cela prend généralement moins de 30 secondes.</Text></View>
      <Modal animationType="fade" transparent visible={Boolean(failure)} onRequestClose={() => router.replace('/(tabs)')}>
        <View style={styles.failureBackdrop}>
          <View style={styles.failureModal}>
            <View style={styles.failureIcon}><AlertTriangle color="#FFB24A" size={29} strokeWidth={2.2} /></View>
            <Text style={styles.failureTitle}>Une erreur est survenue</Text>
            <Text style={styles.failureMessage}>{isReanalysis ? 'La réanalyse n’a pas pu se terminer.' : 'L’analyse n’a pas pu se terminer.'}{`\n`}Tu peux réessayer.</Text>
            <Pressable disabled={retrying} onPress={() => void retry()} style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed, retrying && styles.buttonDisabled]}>
              <RefreshCw color={colors.brand900} size={19} />
              <Text style={styles.retryLabel}>{retrying ? 'Relance…' : 'Réessayer'}</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/(tabs)')} style={({ pressed }) => [styles.homeButton, pressed && styles.buttonPressed]}>
              <House color={colors.white} size={18} />
              <Text style={styles.homeLabel}>Retour à l’accueil</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </DarkSafeScreen>
  );
}

function PhotoInspectionStage({ compact, height, items, step }: { compact: boolean; height: number; items: InspectionMedia[]; step: number }) {
  const [index, setIndex] = useState(0);
  const scan = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const active = step >= 1 && step < 4;
  const complete = step >= 4;
  const current = items.length ? items[index % items.length] : undefined;
  const stageHeight = compact ? 164 : height > 880 ? 234 : 206;

  useEffect(() => {
    if (!active || items.length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % items.length), 1250);
    return () => clearInterval(timer);
  }, [active, items.length]);

  useEffect(() => {
    cancelAnimation(scan);
    if (!active || reducedMotion) {
      scan.value = 0.5;
      return;
    }
    scan.value = 0;
    scan.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(scan);
  }, [active, reducedMotion, scan]);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: active ? 1 : 0,
    transform: [{ translateY: interpolate(scan.value, [0, 1], [compact ? -18 : -24, stageHeight - 44]) }],
  }));

  if (!current) return null;

  const phaseLabel = complete
    ? 'Inspection terminée'
    : step <= 1
      ? 'Inspection visuelle'
      : step === 2
        ? 'Images croisées avec le marché'
        : 'Synthèse des indices';
  const sourceLabel = current.source === 'listing' ? 'Annonce Leboncoin' : 'Ajout vendeur';

  return (
    <View style={[styles.photoStage, compact && styles.photoStageCompact, { height: stageHeight }]}>
      <Image contentFit="cover" recyclingKey={current.uri} source={{ uri: current.uri }} style={StyleSheet.absoluteFill} transition={360} />
      <LinearGradient colors={['rgba(0,20,15,.28)', 'rgba(0,34,24,.04)', 'rgba(0,20,15,.78)']} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.photoTopRow}>
        <View style={styles.photoSource}><ImageIcon color={colors.lime} size={12} /><Text style={styles.photoSourceText}>{sourceLabel}</Text></View>
        <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{current.sourceIndex + 1}/{current.sourceTotal}</Text></View>
      </View>
      <View style={styles.scanCorners} pointerEvents="none"><View style={styles.cornerTopLeft} /><View style={styles.cornerTopRight} /><View style={styles.cornerBottomLeft} /><View style={styles.cornerBottomRight} /></View>
      <Animated.View style={[styles.scanBeam, scanStyle]} pointerEvents="none">
        <LinearGradient colors={['rgba(196,245,42,0)', 'rgba(196,245,42,.42)', 'rgba(239,255,170,.96)', 'rgba(196,245,42,.30)', 'rgba(196,245,42,0)']} locations={[0, .18, .5, .82, 1]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.photoStatus}>
        <View style={[styles.photoStatusDot, active && styles.photoStatusDotActive, complete && styles.photoStatusDotDone]}>
          {complete ? <Check size={11} color={colors.brand900} strokeWidth={3} /> : <ImageIcon size={11} color={active ? colors.brand900 : colors.inkMuted} />}
        </View>
        <Text style={[styles.photoStatusText, (active || complete) && styles.photoStatusTextActive]}>{step === 0 ? `${items.length} image${items.length > 1 ? 's' : ''} prête${items.length > 1 ? 's' : ''}` : phaseLabel}</Text>
      </View>
    </View>
  );
}

function DealupLogo({ size }: { size: number }) {
  return (
    <View style={[styles.logoStage, { height: size + 28 }]}>
      <AppLogo size={size} elevated />
      <Text style={styles.wordmark}>Deal<Text style={styles.lime}>Up</Text> AI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: layout.gutter, paddingTop: 8, paddingBottom: 10, overflow: 'hidden' },
  screenCompact: { paddingTop: 4, paddingBottom: 6 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  logoStage: { alignItems: 'center', justifyContent: 'flex-start' },
  wordmark: { color: colors.white, fontSize: 20, lineHeight: 23, fontWeight: '700', letterSpacing: -.8, marginTop: 0 },
  title: { ...type.h1, color: colors.white, fontSize: 27, lineHeight: 29, textAlign: 'center', marginTop: 5 },
  titleCompact: { fontSize: 23, lineHeight: 25, marginTop: 2 },
  lime: { color: colors.lime },
  product: { color: colors.white, fontSize: 13, fontWeight: '600' },
  meta: { color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  photoStage: { borderRadius: 18, overflow: 'hidden', marginTop: 11, borderWidth: 1, borderColor: 'rgba(196,245,42,.34)', backgroundColor: colors.darkCard, shadowColor: colors.lime, shadowOpacity: .22, shadowRadius: 19 },
  photoStageCompact: { marginTop: 8 },
  photoTopRow: { position: 'absolute', top: 9, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photoSource: { minHeight: 25, borderRadius: 13, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,24,18,.76)', borderWidth: 1, borderColor: colors.border },
  photoSourceText: { color: colors.white, fontSize: 8, fontWeight: '700', letterSpacing: .25 },
  photoCounter: { minWidth: 35, height: 25, borderRadius: 13, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,24,18,.76)', borderWidth: 1, borderColor: colors.border },
  photoCounterText: { color: colors.lime, fontSize: 9, fontWeight: '800' },
  scanCorners: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cornerTopLeft: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderTopWidth: 2, borderLeftWidth: 2, borderColor: colors.lime },
  cornerTopRight: { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderTopWidth: 2, borderRightWidth: 2, borderColor: colors.lime },
  cornerBottomLeft: { position: 'absolute', bottom: 10, left: 10, width: 18, height: 18, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: colors.lime },
  cornerBottomRight: { position: 'absolute', bottom: 10, right: 10, width: 18, height: 18, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.lime },
  scanBeam: { position: 'absolute', left: 8, right: 8, top: 18, height: 8, borderRadius: 4, shadowColor: colors.lime, shadowOpacity: .9, shadowRadius: 9 },
  photoStatus: { position: 'absolute', left: 12, bottom: 9, minHeight: 24, borderRadius: 12, paddingLeft: 5, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,24,18,.76)', borderWidth: 1, borderColor: colors.border },
  photoStatusDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(113,135,125,.20)', alignItems: 'center', justifyContent: 'center' },
  photoStatusDotActive: { backgroundColor: colors.lime },
  photoStatusDotDone: { backgroundColor: colors.lime },
  photoStatusText: { color: colors.inkMuted, fontSize: 8, fontWeight: '700', letterSpacing: .35, textTransform: 'uppercase' },
  photoStatusTextActive: { color: colors.white },
  steps: { marginTop: 15 },
  stepsCompact: { marginTop: 10 },
  step: { minHeight: 56, flexDirection: 'row' },
  stepCompact: { minHeight: 48 },
  completedStep: { opacity: 1 },
  rail: { width: 42, alignItems: 'center' },
  vertical: { position: 'absolute', top: 31, bottom: -3, width: 2, backgroundColor: 'rgba(49,107,78,0.5)' },
  verticalDone: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .9, shadowRadius: 7 },
  circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand900 },
  done: { backgroundColor: colors.lime, borderColor: '#E6FF77', borderWidth: 1.5, shadowColor: colors.lime, shadowOpacity: 1, shadowRadius: 12, elevation: 7 },
  current: { borderColor: colors.lime, borderWidth: 2, shadowColor: colors.lime, shadowOpacity: .85, shadowRadius: 11 },
  stepCopy: { flex: 1, minWidth: 0, paddingLeft: 8, paddingTop: 3 },
  stepLabel: { color: colors.white, fontSize: 15, fontWeight: '600' },
  completedLabel: { color: '#F8FFF2', fontWeight: '700', textShadowColor: 'rgba(196,245,42,.42)', textShadowRadius: 8 },
  currentLabel: { color: colors.lime },
  future: { color: colors.inkSoft },
  stepDetail: { color: colors.inkSoft, fontSize: 10, marginTop: 4 },
  activeDetail: { color: colors.lime },
  timer: { marginTop: 'auto', minHeight: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timerText: { color: colors.inkMuted, fontSize: 12 },
  failureBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,15,11,.78)' },
  failureModal: { borderRadius: 26, paddingHorizontal: 22, paddingTop: 25, paddingBottom: 20, backgroundColor: '#03281F', borderWidth: 1, borderColor: 'rgba(121,177,151,.32)', shadowColor: '#000', shadowOpacity: .55, shadowRadius: 28, shadowOffset: { width: 0, height: 16 } },
  failureIcon: { width: 58, height: 58, borderRadius: 29, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,151,43,.12)', borderWidth: 1, borderColor: 'rgba(255,178,74,.34)' },
  failureTitle: { color: colors.white, fontSize: 23, lineHeight: 29, fontWeight: '700', letterSpacing: -.45, textAlign: 'center', marginTop: 17 },
  failureMessage: { color: '#D7E2DC', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 9 },
  retryButton: { minHeight: 55, borderRadius: 18, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.lime },
  retryLabel: { color: colors.brand900, fontSize: 16, fontWeight: '700' },
  homeButton: { minHeight: 50, borderRadius: 17, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: 'rgba(132,180,158,.28)', backgroundColor: 'rgba(4,52,40,.70)' },
  homeLabel: { color: colors.white, fontSize: 14, fontWeight: '600' },
  buttonPressed: { opacity: .76, transform: [{ scale: .987 }] },
  buttonDisabled: { opacity: .55 },
});
