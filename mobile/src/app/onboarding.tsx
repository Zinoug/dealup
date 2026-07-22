import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BarChart3, Bell, Check, FileSearch, Image as ImageIcon, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { EntryBrand, EntryPrimaryButton, EntryScreen } from '@/components/entry-ui';
import { DecisionClarityGraphic, PriceComparisonGraphic, ResearchSpeedGraphic } from '@/components/onboarding-value-graphics';
import { telemetry } from '@/services/telemetry';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

const analysisSteps = [
  { label: 'Lecture de l’annonce', icon: FileSearch },
  { label: 'Inspection des photos', icon: ImageIcon },
  { label: 'Estimation du juste prix', icon: BarChart3 },
  { label: 'Verdict et plan d’action', icon: ShieldCheck },
] as const;

const onboardingSteps = ['analysis_preview', 'savings', 'research_speed', 'decision_clarity', 'notifications'] as const;

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const { completeOnboarding, pendingUrl, requestNotifications } = useAppStore();

  useEffect(() => {
    telemetry.capture('onboarding_step_viewed', {
      step: page + 1,
      step_key: onboardingSteps[page],
      step_count: onboardingSteps.length,
    });
  }, [page]);

  const completeStep = (extra?: Record<string, string>) => {
    telemetry.capture('onboarding_step_completed', {
      step: page + 1,
      step_key: onboardingSteps[page],
      step_count: onboardingSteps.length,
      ...extra,
    });
  };

  const finish = () => {
    completeOnboarding();
    router.replace(pendingUrl ? '/handle-share' : '/(tabs)');
  };
  const enableNotifications = async () => {
    setRequesting(true);
    const result = await requestNotifications();
    setRequesting(false);
    completeStep({ notification_result: result });
    finish();
  };

  return (
    <EntryScreen style={[styles.safe, compact && styles.safeCompact]}>
      <View style={[styles.brand, compact && styles.brandCompact]}><EntryBrand size={compact ? 48 : 58} /></View>

      {page === 0 ? <AnalysisPreview compact={compact} /> : null}
      {page === 1 ? <ValuePage compact={compact} title="Négocie avec un chiffre, pas au hasard." body="DealUp prépare une offre et une limite avant que tu contactes le vendeur."><PriceComparisonGraphic /></ValuePage> : null}
      {page === 2 ? <ValuePage compact={compact} title="39 annonces avant de choisir." body="DealUp résume chacune pour t’aider à décider plus vite."><ResearchSpeedGraphic /></ValuePage> : null}
      {page === 3 ? <ValuePage compact={compact} title="Deux lectures. Une décision plus claire." body="La courbe grise reste limitée à l’annonce. DealUp croise le prix, les photos et les preuves."><DecisionClarityGraphic /></ValuePage> : null}
      {page === 4 ? <NotificationPage compact={compact} /> : null}

      <View style={styles.footer}>
        <OnboardingDots active={page} />
        {page < 4 ? <EntryPrimaryButton label="Continuer" onPress={() => { completeStep(); setPage((value) => value + 1); }} /> : <>
          <EntryPrimaryButton label="M’avertir" loading={requesting} onPress={() => void enableNotifications()} />
          <Pressable disabled={requesting} onPress={() => { completeStep({ notification_result: 'skipped' }); finish(); }} style={styles.later}><Text style={styles.laterText}>Plus tard</Text></Pressable>
        </>}
      </View>
    </EntryScreen>
  );
}

function AnalysisPreview({ compact }: { compact: boolean }) {
  return (
    <View style={styles.page}>
      <View style={styles.copy}>
        <Text style={[styles.title, compact && styles.titleCompact]}>On vérifie ce que{`\n`}l’annonce ne dit pas.</Text>
        <Text style={styles.body}>Une lecture complète avant de payer.</Text>
      </View>
      <View style={[styles.analysisCard, compact && styles.analysisCardCompact]}>
        <View style={[styles.photoShell, compact && styles.photoShellCompact]}>
          <Image contentFit="cover" contentPosition="center" source={require('../../assets/devices/onboarding-listing.png')} style={StyleSheet.absoluteFill} />
          <View style={styles.photoShade} />
          <View style={styles.deviceCaption}><Text style={styles.deviceName}>iPhone 16 Pro</Text><Text style={styles.deviceMeta}>750 €</Text></View>
        </View>
        <View style={[styles.steps, compact && styles.stepsCompact]}>
          {analysisSteps.map((item, index) => {
            const done = index < 3;
            const current = index === 3;
            const Icon = item.icon;
            return (
              <View key={item.label} style={[styles.step, compact && styles.stepCompact]}>
                <View style={styles.rail}>
                  {index < analysisSteps.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
                  <View style={[styles.stepCircle, done && styles.doneCircle, current && styles.currentCircle]}>
                    {done ? <Check size={14} color={colors.brand900} strokeWidth={3.2} /> : <Icon size={14} color={colors.lime} />}
                  </View>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepLabel, done && styles.doneLabel, current && styles.currentLabel]}>{item.label}</Text>
                  {current ? <Text style={styles.currentDetail}>Préparation des recommandations</Text> : null}
                </View>
                {done ? <Check size={16} color={colors.lime} strokeWidth={2.7} /> : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function ValuePage({ title, body, children, compact }: { title: string; body: string; children: React.ReactNode; compact: boolean }) {
  return (
    <View style={styles.page}>
      <View style={styles.copy}>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <View style={[styles.graphic, compact && styles.graphicCompact]}>{children}</View>
    </View>
  );
}

function NotificationPage({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.notificationPage, compact && styles.notificationPageCompact]}>
      <View style={styles.bellHalo}><View style={styles.bellCircle}><Bell color={colors.brand900} fill={colors.lime} size={46} strokeWidth={2.2} /></View></View>
      <Text style={[styles.title, compact && styles.titleCompact]}>Une annonce en vue ?{`\n`}Pense à la vérifier.</Text>
      <Text style={[styles.body, styles.notificationBody]}>Active un rappel discret chaque soir avant de prendre ta décision.</Text>
    </View>
  );
}

function OnboardingDots({ active }: { active: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Étape ${active + 1} sur 5`}>
      {[0, 1, 2, 3, 4].map((index) => <View key={index} style={index === active ? styles.dotActive : styles.dot} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { paddingHorizontal: 22, paddingBottom: 16 },
  safeCompact: { paddingHorizontal: 18, paddingBottom: 10 },
  brand: { alignItems: 'center', marginTop: 7 },
  brandCompact: { marginTop: -5 },
  page: { flex: 1 },
  copy: { alignItems: 'center', marginTop: 18 },
  title: { color: colors.white, fontSize: 29, lineHeight: 33, fontWeight: '700', letterSpacing: -.8, textAlign: 'center' },
  titleCompact: { fontSize: 25, lineHeight: 28 },
  body: { color: '#A8B8B0', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },
  analysisCard: { borderRadius: 24, overflow: 'hidden', marginTop: 18, padding: 9, backgroundColor: 'rgba(0,30,23,.82)', borderWidth: 1, borderColor: 'rgba(136,189,165,.22)' },
  analysisCardCompact: { marginTop: 10, padding: 7 },
  photoShell: { height: 180, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#073B2D' },
  photoShellCompact: { height: 119 },
  photoShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,20,14,.10)' },
  deviceCaption: { paddingHorizontal: 13, paddingVertical: 9, backgroundColor: 'rgba(0,22,16,.76)' },
  deviceName: { color: colors.white, fontSize: 13, fontWeight: '700' },
  deviceMeta: { color: '#A5B7AE', fontSize: 10, marginTop: 2 },
  steps: { paddingHorizontal: 8, paddingTop: 13, paddingBottom: 0 },
  stepsCompact: { paddingTop: 8 },
  step: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start' },
  stepCompact: { minHeight: 39 },
  rail: { width: 35, alignItems: 'center' },
  line: { position: 'absolute', top: 27, bottom: -22, width: 2, backgroundColor: '#355B4B' },
  lineDone: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .75, shadowRadius: 6 },
  stepCircle: { width: 29, height: 29, borderRadius: 15, borderWidth: 2, borderColor: '#47675A', backgroundColor: '#08281F', alignItems: 'center', justifyContent: 'center' },
  doneCircle: { borderColor: '#D7FF58', backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .85, shadowRadius: 9 },
  currentCircle: { borderColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .82, shadowRadius: 9 },
  stepCopy: { flex: 1, minWidth: 0, paddingLeft: 7, paddingTop: 4 },
  stepLabel: { color: '#71857B', fontSize: 13, fontWeight: '500' },
  doneLabel: { color: '#F4FFF7', fontWeight: '600' },
  currentLabel: { color: colors.lime, fontWeight: '700' },
  currentDetail: { color: '#A8BCB2', fontSize: 9, marginTop: 2 },
  graphic: { flex: 1, justifyContent: 'center', marginTop: 12 },
  graphicCompact: { transform: [{ scale: .88 }], marginHorizontal: -16, marginTop: -5 },
  notificationPage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  notificationPageCompact: { paddingBottom: 4 },
  bellHalo: { width: 142, height: 142, borderRadius: 71, backgroundColor: 'rgba(196,245,42,.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 34, shadowColor: colors.lime, shadowOpacity: .28, shadowRadius: 30 },
  bellCircle: { width: 94, height: 94, borderRadius: 47, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  notificationBody: { maxWidth: 330, marginTop: 14 },
  footer: { gap: 8, paddingTop: 14 },
  dots: { marginBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#60756C' },
  dotActive: { width: 18, height: 7, borderRadius: 4, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .8, shadowRadius: 7 },
  later: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  laterText: { color: '#B1BFB8', fontSize: 13, fontWeight: '600' },
});
