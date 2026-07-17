import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ExternalLink, Share2, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { colors } from '@/theme/tokens';

const pages = [
  { title: 'Ouvre l’annonce', body: 'Depuis l’annonce Leboncoin qui t’intéresse, ouvre le menu de partage.', visual: 'listing' as const },
  { title: 'Choisis DealUp', body: 'Dans la feuille de partage de ton iPhone, sélectionne l’application DealUp.', visual: 'share' as const },
  { title: 'L’analyse est prête', body: 'DealUp récupère le lien, identifie l’iPhone et prépare ton analyse.', visual: 'dealup' as const },
];

export function LeboncoinShareGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const sheetHeight = Math.min(690, height * .79);

  const close = () => { setPage(0); onClose(); };
  const next = () => {
    if (page === pages.length - 1) return close();
    scroll.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage((value) => value + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={close}>
      <View style={styles.modal}>
        <Pressable accessibilityLabel="Fermer le guide" onPress={close} style={styles.backdrop} />
        <View style={[styles.sheet, { height: sheetHeight }]}>
          <BlurView tint="dark" intensity={72} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(7,60,43,.94)', 'rgba(0,34,26,.98)', '#001A14']} style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />
          <View style={styles.header}><View><Text style={styles.eyebrow}>PARTAGER DEPUIS LEBONCOIN</Text><Text style={styles.headerTitle}>Analyse en trois gestes</Text></View><Pressable onPress={close} hitSlop={10} style={styles.close}><X size={20} color={colors.white} /></Pressable></View>

          <ScrollView
            ref={scroll}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
          >
            {pages.map((item, index) => <View key={item.title} style={[styles.page, { width }]}><GuideVisual kind={item.visual} step={index + 1} /><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></View>)}
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={styles.footer}>
            <View style={styles.dots}>{pages.map((_, index) => <View key={index} style={[styles.dot, index === page && styles.dotActive]} />)}</View>
            <Pressable onPress={next} style={({ pressed }) => [styles.next, pressed && styles.pressed]}><Text style={styles.nextText}>{page === pages.length - 1 ? 'J’ai compris' : 'Suivant'}</Text><ArrowRight size={19} color={colors.brand900} /></Pressable>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

function GuideVisual({ kind, step }: { kind: 'listing' | 'share' | 'dealup'; step: number }) {
  return (
    <View style={styles.visual}>
      <View style={styles.stepBadge}><Text style={styles.stepText}>{step}</Text></View>
      {kind === 'listing' ? <View style={styles.fakePhone}><View style={styles.orangeMark} /><View style={styles.fakePhoto} /><View style={styles.fakeCopy}><View style={styles.fakeLineWide} /><View style={styles.fakeLine} /><View style={styles.fakePrice} /></View><View style={styles.shareCircle}><Share2 size={19} color={colors.lime} /></View></View> : null}
      {kind === 'share' ? <View style={styles.shareSheet}><View style={styles.shareHandle} /><Text style={styles.shareTitle}>Partager avec</Text><View style={styles.appRow}><View style={styles.appLogo}><AppLogo size={48} /></View><View><Text style={styles.appName}>DealUp</Text><Text style={styles.appHint}>Analyser cette annonce</Text></View><ExternalLink size={18} color={colors.lime} /></View><View style={styles.mutedRow} /><View style={styles.mutedRow} /></View> : null}
      {kind === 'dealup' ? <View style={styles.resultCard}><AppLogo size={66} /><Text style={styles.resultTitle}>Annonce identifiée</Text><Text style={styles.resultMeta}>iPhone 15 Pro · 750 €</Text><View style={styles.resultButton}><Text style={styles.resultButtonText}>Continuer dans DealUp</Text></View></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,8,6,.58)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(150,207,181,.24)' },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: 'rgba(225,239,232,.36)', marginTop: 10 },
  header: { paddingHorizontal: 24, paddingTop: 20, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  headerTitle: { color: colors.white, fontSize: 23, fontWeight: '700', marginTop: 4 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  page: { paddingHorizontal: 24, alignItems: 'center' },
  visual: { width: '100%', height: 292, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(138,199,171,.22)', backgroundColor: 'rgba(1,30,23,.62)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 24 },
  stepBadge: { position: 'absolute', top: 14, left: 14, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.brand900, fontSize: 12, fontWeight: '800' },
  title: { color: colors.white, fontSize: 22, fontWeight: '700', marginTop: 18 },
  body: { color: '#A9BAB2', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 330, marginTop: 7 },
  fakePhone: { width: '84%', height: 168, borderRadius: 17, backgroundColor: '#F5F5F0', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  orangeMark: { position: 'absolute', top: 9, left: 10, width: 18, height: 18, borderRadius: 5, backgroundColor: '#FF641E' },
  fakePhoto: { width: 82, height: 112, borderRadius: 12, backgroundColor: '#B7AD98' },
  fakeCopy: { flex: 1, gap: 9 },
  fakeLineWide: { height: 11, borderRadius: 6, backgroundColor: '#1D2D26', width: '94%' },
  fakeLine: { height: 8, borderRadius: 4, backgroundColor: '#AAB1AC', width: '68%' },
  fakePrice: { height: 13, borderRadius: 7, backgroundColor: '#165F36', width: '44%', marginTop: 11 },
  shareCircle: { position: 'absolute', right: 11, bottom: 11, width: 38, height: 38, borderRadius: 19, backgroundColor: '#073F2D', alignItems: 'center', justifyContent: 'center' },
  shareSheet: { width: '84%', minHeight: 205, borderRadius: 22, backgroundColor: 'rgba(238,242,238,.96)', padding: 15 },
  shareHandle: { width: 35, height: 4, borderRadius: 2, backgroundColor: '#AEB5B0', alignSelf: 'center' },
  shareTitle: { color: '#25362E', fontSize: 13, textAlign: 'center', marginTop: 10 },
  appRow: { minHeight: 76, borderRadius: 15, backgroundColor: '#FFFFFF', marginTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  appLogo: { width: 48, height: 48 },
  appName: { color: '#092318', fontSize: 14, fontWeight: '700' },
  appHint: { color: '#65716A', fontSize: 10, marginTop: 2 },
  mutedRow: { height: 12, borderRadius: 6, backgroundColor: '#D7DCD8', marginTop: 10, width: '100%' },
  resultCard: { width: '80%', minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: colors.white, fontSize: 18, fontWeight: '700', marginTop: 11 },
  resultMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  resultButton: { width: '100%', height: 43, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  resultButtonText: { color: colors.brand900, fontSize: 12, fontWeight: '700' },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  dots: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#587267' },
  dotActive: { width: 24, backgroundColor: colors.lime },
  next: { height: 54, borderRadius: 27, backgroundColor: colors.lime, marginTop: 7, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13 },
  nextText: { color: colors.brand900, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: .76, transform: [{ scale: .987 }] },
});
