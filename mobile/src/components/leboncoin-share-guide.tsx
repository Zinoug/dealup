import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { colors } from '@/theme/tokens';

const pages = [
  { title: 'Touche le bouton Partager', body: 'Depuis les photos de l’annonce Leboncoin, ouvre la feuille de partage.', visual: 'listing' as const },
  { title: 'Choisis Analyser avec DealUp', body: 'L’action apparaît directement dans la feuille de partage de ton iPhone.', visual: 'share' as const },
  { title: 'L’analyse est prête', body: 'DealUp récupère le lien, identifie l’iPhone et prépare ton analyse.', visual: 'dealup' as const },
];

export function LeboncoinShareGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const close = () => { setPage(0); onClose(); };
  const next = () => {
    if (page === pages.length - 1) return close();
    scroll.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage((value) => value + 1);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.modal}>
        <View style={[styles.sheet, { height }]}>
          <BlurView tint="dark" intensity={72} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(7,60,43,.94)', 'rgba(0,34,26,.98)', '#001A14']} style={StyleSheet.absoluteFill} />
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}><Text style={styles.headerTitle}>Analyse en trois gestes</Text><Pressable accessibilityLabel="Fermer le guide" onPress={close} hitSlop={10} style={styles.close}><X size={20} color={colors.white} /></Pressable></View>

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
      {kind === 'listing' ? <Image source={require('../../assets/guides/leboncoin-share-step-1.png')} contentFit="contain" style={styles.guideImage} /> : null}
      {kind === 'share' ? <Image source={require('../../assets/guides/leboncoin-share-step-2.jpg')} contentFit="contain" style={styles.guideImage} /> : null}
      {kind === 'dealup' ? <View style={styles.resultCard}><AppLogo size={66} /><Text style={styles.resultTitle}>Annonce identifiée</Text><Text style={styles.resultMeta}>iPhone 15 Pro · 750 €</Text><View style={styles.resultButton}><Text style={styles.resultButtonText}>Continuer dans DealUp AI</Text></View></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  sheet: { width: '100%', flex: 1, overflow: 'hidden' },
  header: { minHeight: 94, paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.white, fontSize: 23, fontWeight: '700' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' },
  page: { paddingHorizontal: 24, alignItems: 'center' },
  visual: { width: '100%', height: 292, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(138,199,171,.22)', backgroundColor: 'rgba(1,30,23,.62)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 24 },
  stepBadge: { position: 'absolute', zIndex: 2, top: 12, left: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', shadowColor: '#001A14', shadowOpacity: .3, shadowRadius: 8 },
  stepText: { color: colors.brand900, fontSize: 12, fontWeight: '800' },
  title: { color: colors.white, fontSize: 22, fontWeight: '700', marginTop: 18 },
  body: { color: '#A9BAB2', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 330, marginTop: 7 },
  guideImage: { width: '100%', height: '100%' },
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
