import { router } from 'expo-router';
import { BarChart3, Check, FileSearch, Image as ImageIcon, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { EntryBrand, EntryPrimaryButton, EntryScreen } from '@/components/entry-ui';
import { ProductImagePlaceholder } from '@/components/reference-ui';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, type } from '@/theme/tokens';

const analysisSteps = [
  { label: 'Lecture de l’annonce', detail: '', icon: FileSearch },
  { label: 'Inspection des photos', detail: 'Analyse des images…', icon: ImageIcon },
  { label: 'Estimation du juste prix', detail: '', icon: BarChart3 },
  { label: 'Verdict et plan d’action', detail: '', icon: ShieldCheck },
];

export default function OnboardingScreen() {
  const [screen, setScreen] = useState<'welcome' | 'demo'>('welcome');
  const [step, setStep] = useState(1);
  const { height } = useWindowDimensions();
  const { completeOnboarding } = useAppStore();

  useEffect(() => {
    if (screen !== 'demo') return;
    const progressTimer = setInterval(() => setStep((value) => Math.min(3, value + 1)), 1050);
    const finishTimer = setTimeout(() => {
      completeOnboarding();
      router.replace('/auth');
    }, 5200);
    return () => { clearInterval(progressTimer); clearTimeout(finishTimer); };
  }, [completeOnboarding, screen]);

  const openLogin = () => {
    completeOnboarding();
    router.push('/auth');
  };

  if (screen === 'demo') {
    return (
      <EntryScreen style={styles.demoSafe}>
        <View style={[styles.demoBrand, { marginTop: height > 850 ? 54 : 24 }]}><EntryBrand size={86} /></View>
        <Text style={styles.demoTitle}>On soulève{`\n`}<Text style={styles.lime}>chaque</Text> détail.</Text>
        <View style={styles.listingCard}>
          <ProductImagePlaceholder size={76} />
          <View style={styles.listingCopy}><Text style={styles.product}>iPhone 15 Pro 256 Go</Text><Text style={styles.meta}>750 € · Paris 11e</Text></View>
        </View>
        <View style={styles.stepsCard}>
          {analysisSteps.map((item, index) => {
            const done = index < step;
            const current = index === step;
            const Icon = item.icon;
            return (
              <View key={item.label} style={styles.step}>
                <View style={styles.rail}>
                  {index < analysisSteps.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
                  <View style={[styles.stepCircle, done && styles.doneCircle, current && styles.currentCircle]}>
                    {done ? <Check size={16} color={colors.brand900} strokeWidth={3.2} /> : <Icon size={16} color={current ? colors.lime : '#52685F'} />}
                  </View>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepLabel, done && styles.doneLabel, current && styles.currentLabel, !done && !current && styles.futureLabel]}>{item.label}</Text>
                  {item.detail ? <Text style={[styles.stepDetail, current && styles.currentDetail]}>{item.detail}</Text> : null}
                </View>
                {done ? <Check size={18} color={colors.lime} strokeWidth={2.6} /> : null}
              </View>
            );
          })}
        </View>
        <Text style={styles.timer}>Cela prend généralement moins de 30 secondes.</Text>
      </EntryScreen>
    );
  }

  return (
    <EntryScreen style={styles.welcomeSafe}>
      <View style={[styles.welcomeBrand, { marginTop: height > 850 ? 126 : 82 }]}><EntryBrand size={94} /></View>
      <View style={styles.welcomeCopy}>
        <Text style={styles.welcomeTitle}>On soulève{`\n`}<Text style={styles.lime}>chaque</Text> détail.</Text>
        <Text style={styles.welcomeBody}>L’app qui analyse les annonces{`\n`}pour acheter en toute confiance.</Text>
      </View>
      <View style={styles.dots}><View style={styles.dotActive} /><View style={styles.dot} /><View style={styles.dot} /></View>
      <View style={styles.footer}>
        <EntryPrimaryButton label="Commencer" onPress={() => setScreen('demo')} />
        <Pressable onPress={openLogin} style={styles.loginButton}><Text style={styles.loginText}>Déjà un compte ?  <Text style={styles.loginStrong}>Se connecter</Text></Text></Pressable>
      </View>
    </EntryScreen>
  );
}

const styles = StyleSheet.create({
  welcomeSafe: { paddingHorizontal: 30, paddingBottom: 18 },
  welcomeBrand: { alignItems: 'center' },
  welcomeCopy: { marginTop: 69, alignItems: 'center' },
  welcomeTitle: { color: colors.white, fontSize: 40, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2, textAlign: 'center' },
  lime: { color: colors.lime },
  welcomeBody: { color: '#AEBAB4', fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 27 },
  dots: { marginTop: 'auto', marginBottom: 61, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#60756C' },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .8, shadowRadius: 7 },
  footer: { gap: 14 },
  loginButton: { minHeight: 58, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(129,176,155,.35)', backgroundColor: 'rgba(1,39,30,.48)', alignItems: 'center', justifyContent: 'center' },
  loginText: { color: '#D1DBD5', fontSize: 14 },
  loginStrong: { color: colors.white },
  demoSafe: { paddingHorizontal: layout.gutter, paddingBottom: 22 },
  demoBrand: { alignItems: 'center' },
  demoTitle: { ...type.h1, color: colors.white, fontSize: 36, lineHeight: 40, textAlign: 'center', marginTop: 45 },
  listingCard: { minHeight: 104, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(112,169,144,.22)', backgroundColor: 'rgba(2,42,32,.68)', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 17, marginTop: 38 },
  listingCopy: { flex: 1 },
  product: { color: colors.white, fontSize: 16, fontWeight: '700' },
  meta: { color: '#9AABA3', fontSize: 14, marginTop: 6 },
  stepsCard: { minHeight: 286, borderRadius: radii.md, borderWidth: 1, borderColor: 'rgba(112,169,144,.18)', backgroundColor: 'rgba(1,37,29,.62)', paddingHorizontal: 20, paddingVertical: 17, marginTop: 11 },
  step: { minHeight: 62, flexDirection: 'row', alignItems: 'flex-start' },
  rail: { width: 44, alignItems: 'center' },
  line: { position: 'absolute', top: 30, bottom: -33, width: 2, backgroundColor: '#355B4B' },
  lineDone: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .7, shadowRadius: 6 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#47675A', backgroundColor: '#08281F', alignItems: 'center', justifyContent: 'center' },
  doneCircle: { borderColor: '#D7FF58', backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .9, shadowRadius: 11 },
  currentCircle: { borderColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .9, shadowRadius: 10 },
  stepCopy: { flex: 1, paddingTop: 4, paddingLeft: 7 },
  stepLabel: { color: colors.white, fontSize: 15, fontWeight: '500' },
  doneLabel: { color: '#F5FFF8', fontWeight: '600' },
  currentLabel: { color: colors.white, fontWeight: '700' },
  futureLabel: { color: '#71857B' },
  stepDetail: { color: '#82978D', fontSize: 12, marginTop: 5 },
  currentDetail: { color: '#AFC0B7' },
  timer: { color: '#CBD5D0', fontSize: 12, textAlign: 'center', marginTop: 'auto', marginBottom: 43 },
});
