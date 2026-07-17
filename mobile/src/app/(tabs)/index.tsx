import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { AlertCircle, ArrowRight, ChevronRight, Clock3, Link2, Share2, Smartphone, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { BrandBackground } from '@/components/brand-background';
import { DeviceThumbnail } from '@/components/device-thumbnail';
import { LeboncoinShareGuide } from '@/components/leboncoin-share-guide';
import { BrandLockup } from '@/components/reference-ui';
import { DEMO_LISTING_URL } from '@/data/mock';
import { useAppStore } from '@/store/app-store';
import { colors, layout, shadows, spacing, type } from '@/theme/tokens';
import { formatEuros, isLeboncoinUrl } from '@/utils/format';

const verdictCopy = {
  BUY: { title: 'Très bonne affaire', action: 'Achat recommandé' },
  NEGOTIATE: { title: 'À négocier', action: 'Prépare ton offre' },
  VERIFY_FIRST: { title: 'À vérifier', action: 'Demande les preuves' },
  PASS: { title: 'Mieux vaut passer', action: 'Choisis une autre annonce' },
} as const;

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [url, setUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [toast, setToast] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const { identifyListing, isBusy, analyses } = useAppStore();
  const latest = analyses[0];

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  const submit = async () => {
    setValidating(true);
    if (!isLeboncoinUrl(url)) { setToast('Colle un lien Leboncoin valide'); setValidating(false); return; }
    const listing = await identifyListing(url);
    setValidating(false);
    if (listing?.compatibility?.status === 'SUPPORTED') router.push('/listing-preview');
    else if (listing) router.push({ pathname: '/compatible-devices', params: { status: listing.compatibility?.status ?? 'UNKNOWN' } });
    else setToast('Cette annonce ne peut pas être identifiée');
  };
  const paste = async () => { const text = await Clipboard.getStringAsync(); setUrl(text || DEMO_LISTING_URL); setToast(''); };

  return (
    <View style={styles.screen}>
      <BrandBackground variant="light" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces
        alwaysBounceVertical
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          if (event.nativeEvent.contentOffset.y < 0) scrollRef.current?.scrollTo({ y: 0, animated: false });
        }}
      >
        <View style={styles.hero}>
          <View style={styles.heroSurface}>
            <Image source={require('../../../assets/hero/home-tag-background.png')} contentFit="cover" contentPosition="top center" style={styles.heroImage} />
            <View style={styles.heroShade} />
          </View>
          <SafeAreaView edges={['top']}>
            <View style={styles.heroInner}>
              <BrandLockup compact />
              <Text style={styles.title}>Vérifie l’appareil{`\n`}<Text style={styles.lime}>avant</Text> de l’acheter.</Text>
              <Text style={styles.subtitle}>DealUp analyse ton iPhone ou ton MacBook,{`\n`}le prix, les photos et les preuves.</Text>
              <View style={[styles.inputShell, shadows.floating]}>
                <Link2 size={24} color={colors.brand700} />
                <TextInput value={url} onChangeText={(text) => { setUrl(text); setToast(''); }} placeholder="Lien de l’annonce Leboncoin" placeholderTextColor="#747A75" autoCapitalize="none" keyboardType="url" style={styles.input} onSubmitEditing={() => void submit()} />
                <Pressable onPress={() => void paste()} hitSlop={8}><Text style={styles.paste}>Coller</Text></Pressable>
              </View>
            </View>
          </SafeAreaView>
          <Pressable onPress={() => void submit()} style={({ pressed }) => [styles.verify, shadows.floating, pressed && styles.pressed]}>
            <Text style={styles.verifyText}>{isBusy || validating ? 'Identification…' : 'Vérifier cette annonce'}</Text><ArrowRight size={26} color={colors.brand900} />
          </Pressable>
          {toast ? <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(150)} style={styles.toast}><AlertCircle size={17} color="#FFD6D1" /><Text style={styles.toastText}>{toast}</Text><Pressable onPress={() => setToast('')} hitSlop={10}><X size={15} color="#FFD6D1" /></Pressable></Animated.View> : null}
        </View>

        <View style={styles.light}>
          <Pressable onPress={() => setGuideOpen(true)} style={styles.guideLink}><Share2 size={16} color={colors.brand700} /><Text style={styles.guideText}>Comment analyser depuis Leboncoin ?</Text><ChevronRight size={15} color={colors.brand700} /></Pressable>
          <Pressable onPress={() => router.push('/compatible-devices')} style={styles.compatibleLink}><Smartphone size={15} color={colors.brand700} /><Text style={styles.guideText}>Voir les appareils compatibles</Text><ChevronRight size={15} color={colors.brand700} /></Pressable>
          <View style={styles.lastHeader}><Clock3 size={22} color={colors.brand700} /><View><Text style={styles.lastTitle}>Dernière analyse</Text><Text style={styles.today}>Aujourd’hui</Text></View></View>
          {latest ? <Pressable onPress={() => router.push({ pathname: '/analysis/[id]', params: { id: latest.id } })} style={styles.latest}>
            <DeviceThumbnail category={latest.device.category} size={94} />
            <View style={styles.latestCopy}><Text numberOfLines={1} style={styles.productTitle}>{latest.listing.title.replace(' — ', ' ')}</Text><Text style={styles.productMeta}>{formatEuros(latest.listing.priceCents)} · {latest.listing.location}</Text><View style={styles.verdictRow}><View style={styles.miniScore}><Text style={styles.score}>{(latest.verdict.dealScore / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Text><Text style={styles.over}>/10</Text></View><View style={styles.divider} /><View style={styles.latestVerdict}><Text style={styles.verdictLabel}>●  Verdict</Text><Text numberOfLines={1} style={styles.verdict}>{verdictCopy[latest.verdict.type].title}</Text><Text numberOfLines={1} style={styles.reco}>{verdictCopy[latest.verdict.type].action}</Text></View></View></View>
            <ChevronRight size={22} color={colors.lightMuted} />
          </Pressable> : null}
        </View>
      </ScrollView>
      <LeboncoinShareGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightSurface, overflow: 'hidden' }, scroll: { backgroundColor: 'transparent' },
  hero: { width: '110%', alignSelf: 'center', minHeight: 515, zIndex: 2 }, heroSurface: { position: 'absolute', inset: 0, borderBottomLeftRadius: 48, borderBottomRightRadius: 48, overflow: 'hidden', backgroundColor: colors.brand900 }, heroImage: { position: 'absolute', top: 0, bottom: 0, left: '4.5%', width: '91%', height: '100%' }, heroShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,18,13,.08)' }, heroInner: { width: '91%', alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  title: { color: colors.white, fontSize: 42, lineHeight: 48, fontWeight: '700', letterSpacing: -1.5, marginTop: 72 }, lime: { color: colors.lime },
  subtitle: { ...type.body, color: '#C0CEC7', marginTop: 18, lineHeight: 25 },
  inputShell: { height: 64, borderRadius: 16, backgroundColor: colors.white, marginTop: 28, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, input: { flex: 1, color: colors.lightInk, fontSize: 16 }, paste: { color: colors.brand700, fontWeight: '600' },
  verify: { position: 'absolute', left: '9%', right: '9%', bottom: -34, height: 68, borderRadius: 34, zIndex: 5, backgroundColor: colors.lime, borderWidth: 5, borderColor: 'rgba(255,255,255,0.34)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }, verifyText: { color: colors.brand900, fontSize: 18, fontWeight: '700' }, pressed: { opacity: 0.75 },
  toast: { position: 'absolute', left: '9%', right: '9%', top: 149, minHeight: 46, borderRadius: 23, zIndex: 8, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(64,16,14,.94)', borderWidth: 1, borderColor: 'rgba(255,120,108,.32)', shadowColor: '#000', shadowOpacity: .3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, toastText: { flex: 1, color: '#FFF4F2', fontSize: 13, fontWeight: '600' },
  light: { paddingHorizontal: layout.gutter, paddingTop: 49, paddingBottom: 120, zIndex: 1 }, guideLink: { minHeight: 38, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, compatibleLink: { minHeight: 34, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, guideText: { color: colors.brand700, fontSize: 13, fontWeight: '600' },
  lastHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 24 }, lastTitle: { color: colors.lightInk, fontSize: 17, fontWeight: '600' }, today: { color: colors.lightMuted, fontSize: 12, marginTop: 1 },
  latest: { minHeight: 150, backgroundColor: '#FFFFFF', borderRadius: 24, marginTop: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: '#E3E5DF', ...shadows.subtle }, latestCopy: { flex: 1 }, productTitle: { color: colors.lightInk, fontSize: 15, fontWeight: '700' }, productMeta: { color: colors.lightMuted, fontSize: 14, marginTop: 3 }, verdictRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 }, miniScore: { width: 58, height: 58, borderRadius: 29, borderWidth: 5, borderColor: '#69CF25', alignItems: 'center', justifyContent: 'center' }, score: { color: colors.lightInk, fontSize: 20, fontWeight: '700', lineHeight: 22 }, over: { color: colors.lightMuted, fontSize: 10 }, divider: { width: 1, height: 52, backgroundColor: colors.lightBorder, marginHorizontal: 12 }, latestVerdict: { flex: 1 }, verdictLabel: { color: colors.brand700, fontSize: 11 }, verdict: { color: colors.brand700, fontSize: 14, fontWeight: '700', marginTop: 3 }, reco: { color: colors.lightMuted, fontSize: 11, marginTop: 2 },
});
