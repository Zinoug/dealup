import { Image } from 'expo-image';
import { CheckCircle2, ShieldQuestion } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { ScoreGauge } from '@/components/score-gauge';
import { colors } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function useReveal(delay = 0, duration = 1450) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted) return;
      if (reduced) progress.setValue(1);
      else Animated.timing(progress, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    });
    return () => { mounted = false; progress.stopAnimation(); };
  }, [delay, duration, progress]);
  return progress;
}

function AnimatedAmount({ progress, total }: { progress: Animated.Value; total: number }) {
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    const listener = progress.addListener(({ value }) => setAmount(Math.round(total * value)));
    return () => progress.removeListener(listener);
  }, [progress, total]);
  return <Text style={styles.amount}>{amount.toLocaleString('fr-FR')} €</Text>;
}

function AnimatedCount({ progress, total }: { progress: Animated.Value; total: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const listener = progress.addListener(({ value }) => setCount(Math.round(total * value)));
    return () => progress.removeListener(listener);
  }, [progress, total]);
  return <Text style={styles.researchCount}>{count}</Text>;
}

export function PriceComparisonGraphic() {
  const asking = useReveal(110);
  const offer = useReveal(250);
  return (
    <View style={styles.priceCard}>
      <Text style={styles.example}>Exemple d’analyse</Text>
      <View style={styles.bars}>
        <View style={styles.barColumn}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, styles.askingFill, { height: asking.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          <AnimatedAmount progress={asking} total={750} />
          <Text style={styles.barLabel}>Prix affiché</Text>
        </View>
        <View style={styles.barColumn}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, styles.offerFill, { height: offer.interpolate({ inputRange: [0, 1], outputRange: ['0%', '87%'] }) }]} />
          </View>
          <AnimatedAmount progress={offer} total={650} />
          <Text style={styles.barLabel}>Première offre</Text>
        </View>
      </View>
      <View style={styles.savingsResult}>
        <Text style={styles.savingsEyebrow}>ÉCONOMIE POSSIBLE</Text>
        <Text style={styles.savingsLine}><Text style={styles.savingsAmount}>100 €</Text> économisés</Text>
        <Text style={styles.savingsContext}>dans cet exemple</Text>
      </View>
    </View>
  );
}

export function ResearchSpeedGraphic() {
  const manual = useReveal(180, 2900);
  const dealup = useReveal(420, 1350);
  const verdict = useReveal(1550, 620);

  return (
    <View style={styles.researchCard}>
      <View style={styles.researchHeadline}>
        <AnimatedCount progress={manual} total={39} />
        <Text style={styles.researchUnit}>annonces d’occasion consultées{`\n`}en moyenne avant l’achat</Text>
      </View>

      <View style={styles.manualLane}>
        <Text style={styles.researchEyebrow}>CHAQUE ANNONCE, À LA MAIN</Text>
        <View style={styles.manualSteps}>
          {['Prix', 'Photos', 'Preuves', 'Risques'].map((label, index) => (
            <View key={label} style={styles.manualStep}>
              <View style={styles.manualTrack}>
                <Animated.View style={[styles.manualFill, { width: manual.interpolate({ inputRange: [index * .19, Math.min(1, index * .19 + .35)], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]} />
              </View>
              <Text style={styles.manualLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.manualConclusion}>Tout recouper, puis tirer ta propre conclusion.</Text>
      </View>

      <Animated.View
        style={[
          styles.dealupLane,
          {
            opacity: dealup,
            transform: [{ translateY: dealup.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <Text style={styles.dealupEyebrow}>CHAQUE ANNONCE, AVEC DEALUP</Text>
        <View style={styles.dealupTrack}>
          <Animated.View style={[styles.dealupFill, { width: dealup.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <View style={styles.dealupInputs}><Text style={styles.dealupInput}>Prix</Text><Text style={styles.dealupInput}>Photos</Text><Text style={styles.dealupInput}>Preuves</Text><Text style={styles.dealupInput}>Risques</Text></View>
        <Animated.View style={[styles.reportPreview, { opacity: verdict, transform: [{ translateY: verdict.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }] }]}> 
          <View style={styles.reportHeader}>
            <Image contentFit="cover" source={require('../../assets/devices/onboarding-listing.png')} style={styles.reportPhoto} />
            <View style={styles.reportIdentity}>
              <Text numberOfLines={1} style={styles.reportDevice}>iPhone 16 Pro</Text>
              <Text style={styles.reportMeta}>750 € · Paris 16e</Text>
            </View>
          </View>
          <View style={styles.reportVerdict}>
            <ScoreGauge label="" score={78} size={108} />
            <View style={styles.reportVerdictCopy}>
              <Text style={styles.reportHeadline}>Bon appareil, prix à négocier.</Text>
              <View style={styles.reportSignal}><CheckCircle2 color={colors.brand400} size={13} /><Text style={styles.reportSignalText}>Annonce cohérente</Text></View>
              <View style={styles.reportSignal}><ShieldQuestion color={colors.amber} size={13} /><Text style={styles.reportTodoText}>2 preuves à demander</Text></View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export function DecisionClarityGraphic() {
  const gray = useReveal(180, 1650);
  const green = useReveal(520, 1900);

  const grayOffset = gray.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const greenOffset = green.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  return (
    <View style={styles.curveCard}>
      <Text style={styles.axisLabel}>Clarté de la décision</Text>
      <View style={styles.legendRow}>
        <View style={styles.legend}><View style={[styles.legendDot, styles.grayDot]} /><Text style={styles.legendText}>Sans DealUp</Text></View>
        <View style={styles.legend}><View style={[styles.legendDot, styles.greenDot]} /><Text style={[styles.legendText, styles.greenText]}>Avec DealUp</Text></View>
      </View>
      <View style={styles.chart}>
        <Svg height="166" viewBox="0 0 320 166" width="100%">
          <Defs>
            <SvgGradient id="dealFill" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={colors.lime} stopOpacity=".20" />
              <Stop offset="1" stopColor={colors.lime} stopOpacity="0" />
            </SvgGradient>
          </Defs>
          {[42, 78, 114].map((y) => <Path d={`M24 ${y} H300`} key={y} stroke="rgba(150,170,160,.17)" strokeDasharray="5 7" strokeWidth="1" />)}
          <Path d="M24 139 H300" stroke="rgba(160,179,170,.42)" strokeWidth="1.4" />
          <AnimatedPath d="M34 128 C110 126 188 119 286 108" fill="none" stroke="#78847F" strokeDasharray="500" strokeDashoffset={grayOffset} strokeLinecap="round" strokeWidth="5" />
          <Path d="M34 128 C93 126 125 109 161 87 C204 60 245 40 286 31 L286 139 L34 139 Z" fill="url(#dealFill)" />
          <AnimatedPath d="M34 128 C93 126 125 109 161 87 C204 60 245 40 286 31" fill="none" opacity=".18" stroke={colors.lime} strokeDasharray="500" strokeDashoffset={greenOffset} strokeLinecap="round" strokeWidth="13" />
          <AnimatedPath d="M34 128 C93 126 125 109 161 87 C204 60 245 40 286 31" fill="none" stroke={colors.lime} strokeDasharray="500" strokeDashoffset={greenOffset} strokeLinecap="round" strokeWidth="5" />
          <Circle cx="286" cy="108" fill="#78847F" r="6" />
          <Circle cx="286" cy="31" fill={colors.lime} r="7" stroke="#E9FF9A" strokeWidth="2" />
        </Svg>
      </View>
      <View style={styles.moments}><Text style={styles.moment}>Annonce</Text><Text style={styles.moment}>Photos</Text><Text style={styles.moment}>Réponse</Text><Text style={styles.moment}>Verdict</Text></View>
      <Text style={styles.curveCopy}>Les preuves rendent la décision plus claire, même lorsqu’elles conduisent à passer.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  priceCard: { minHeight: 380, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(137,188,165,.24)', backgroundColor: 'rgba(0,34,26,.78)', paddingHorizontal: 22, paddingTop: 19, paddingBottom: 20 },
  example: { color: '#8FA49A', fontSize: 12, fontWeight: '600' },
  bars: { height: 245, marginTop: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 34 },
  barColumn: { width: 112, alignItems: 'center' },
  barTrack: { width: 92, height: 170, borderRadius: 21, overflow: 'hidden', backgroundColor: 'rgba(148,171,160,.10)', borderWidth: 1, borderColor: 'rgba(149,184,168,.18)', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 20 },
  askingFill: { backgroundColor: '#66746D' },
  offerFill: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .7, shadowRadius: 14 },
  amount: { color: colors.white, fontSize: 18, fontWeight: '700', marginTop: 9 },
  barLabel: { color: '#96A89F', fontSize: 11, marginTop: 2 },
  savingsResult: { alignItems: 'center', marginTop: 10 },
  savingsEyebrow: { color: '#9FB0A7', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  savingsLine: { color: colors.white, fontSize: 17, fontWeight: '600', marginTop: 1 },
  savingsAmount: { color: colors.lime, fontSize: 28, fontWeight: '800', letterSpacing: -.8 },
  savingsContext: { color: '#81958B', fontSize: 10, marginTop: -1 },
  researchCard: { minHeight: 382, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(137,188,165,.24)', backgroundColor: 'rgba(0,34,26,.78)', paddingHorizontal: 20, paddingTop: 17, paddingBottom: 13 },
  researchEyebrow: { color: '#879890', fontSize: 9, fontWeight: '700', letterSpacing: 1.25 },
  researchHeadline: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  researchCount: { color: colors.white, fontSize: 68, lineHeight: 73, fontWeight: '800', letterSpacing: -3 },
  researchUnit: { color: '#A9BAB2', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  manualLane: { marginTop: 8 },
  manualSteps: { flexDirection: 'row', gap: 6, marginTop: 9 },
  manualStep: { flex: 1 },
  manualTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(130,149,140,.16)' },
  manualFill: { height: '100%', borderRadius: 3, backgroundColor: '#718078' },
  manualLabel: { color: '#8D9D95', fontSize: 8, textAlign: 'center', marginTop: 5 },
  manualConclusion: { color: '#8D9E95', fontSize: 10, lineHeight: 14, marginTop: 9 },
  dealupLane: { minHeight: 222, marginTop: 13, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(197,245,43,.36)', backgroundColor: 'rgba(12,66,47,.74)', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, shadowColor: colors.lime, shadowOpacity: .12, shadowRadius: 17 },
  dealupEyebrow: { color: '#D9F78A', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  dealupTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(190,231,78,.13)', marginTop: 10 },
  dealupFill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .9, shadowRadius: 9 },
  dealupInputs: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  dealupInput: { color: '#9EB4A8', fontSize: 8 },
  reportPreview: { flex: 1, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(166,213,191,.17)', paddingTop: 8 },
  reportHeader: { minHeight: 35, flexDirection: 'row', alignItems: 'center' },
  reportPhoto: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.darkCard },
  reportIdentity: { flex: 1, marginLeft: 9 },
  reportDevice: { color: colors.white, fontSize: 12, lineHeight: 15, fontWeight: '700' },
  reportMeta: { color: '#91A69B', fontSize: 9, lineHeight: 12, marginTop: 1 },
  reportVerdict: { minHeight: 95, flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  reportVerdictCopy: { flex: 1, marginLeft: 5, paddingRight: 2 },
  reportHeadline: { color: colors.white, fontSize: 14, lineHeight: 17, fontWeight: '700', letterSpacing: -.2, marginBottom: 7 },
  reportSignal: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  reportSignalText: { color: '#C5D9CE', fontSize: 9, lineHeight: 12, fontWeight: '600' },
  reportTodoText: { color: '#E7C589', fontSize: 9, lineHeight: 12, fontWeight: '600' },
  curveCard: { borderRadius: 25, borderWidth: 1, borderColor: 'rgba(137,188,165,.24)', backgroundColor: 'rgba(0,34,26,.78)', paddingHorizontal: 17, paddingTop: 18, paddingBottom: 17 },
  axisLabel: { color: '#C8D3CD', fontSize: 12, fontWeight: '600', marginLeft: 7 },
  legendRow: { minHeight: 28, marginTop: 5, marginHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 18 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chart: { height: 166 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  grayDot: { backgroundColor: '#78847F' },
  greenDot: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .8, shadowRadius: 6 },
  legendText: { color: '#87958E', fontSize: 10, fontWeight: '600' },
  greenText: { color: '#D9F98A' },
  moments: { marginTop: -3, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between' },
  moment: { color: '#7F9188', fontSize: 9 },
  curveCopy: { color: '#A9BAB2', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 13, paddingHorizontal: 8 },
});
