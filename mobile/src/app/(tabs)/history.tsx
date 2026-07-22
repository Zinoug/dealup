import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Clock3, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DeviceThumbnail } from '@/components/device-thumbnail';
import { Screen } from '@/components/screen';
import { telemetry } from '@/services/telemetry';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, shadows, spacing, type } from '@/theme/tokens';
import type { VerdictType } from '@/types/domain';
import { formatEuros } from '@/utils/format';

const verdicts: Record<VerdictType, { label: string; color: string }> = {
  BUY: { label: 'Acheter', color: '#38A844' },
  NEGOTIATE: { label: 'Négocier', color: '#D97416' },
  VERIFY_FIRST: { label: 'À vérifier', color: '#C58A18' },
  PASS: { label: 'Passer', color: '#D54740' },
};

export default function HistoryScreen() {
  const { analyses, loadHistory, openIdentification } = useAppStore();
  const [query, setQuery] = useState('');
  useFocusEffect(useCallback(() => { telemetry.screen('history'); void loadHistory(); }, [loadHistory]));
  const filtered = useMemo(() => analyses.filter((item) => item.listing?.title.toLowerCase().includes(query.toLowerCase())), [analyses, query]);

  return (
    <Screen backgroundColor={colors.lightSurface} scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <View style={styles.header}><Text style={styles.title}>Tes analyses</Text><Text style={styles.subtitle}>Retrouve une annonce et reprends là où tu t’étais arrêté.</Text></View>
      <View style={styles.search}><Search size={19} color={colors.lightMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un appareil" placeholderTextColor="#8A928C" style={styles.searchInput} accessibilityLabel="Rechercher dans les analyses" /></View>
      <View style={styles.list}>
        {filtered.map((analysis) => {
          if (!analysis.listing || !analysis.device) return null;
          if (analysis.entryType === 'identification') {
            return (
              <Pressable key={analysis.id} onPress={() => void openIdentification(analysis.id).then((listing) => { if (listing) router.push('/listing-preview'); })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <DeviceThumbnail uri={analysis.listing.thumbnailUrl} size={78} label={`Première photo de ${analysis.device.displayName}`} />
                <View style={styles.cardCopy}>
                  <View style={styles.verdictRow}><View style={[styles.verdictDot, { backgroundColor: colors.brand600 }]} /><Text style={[styles.verdict, { color: colors.brand700 }]}>À analyser</Text></View>
                  <Text numberOfLines={2} style={styles.product}>{analysis.listing.title}</Text>
                  <View style={styles.meta}><Text style={styles.price}>{formatEuros(analysis.listing.priceCents)}</Text><Clock3 size={12} color="#8B958F" /><Text style={styles.date}>{new Date(analysis.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text></View>
                </View>
                <ArrowRight size={18} color="#79847D" />
              </Pressable>
            );
          }
          if (!analysis.verdict) return null;
          const verdict = verdicts[analysis.verdict.type];
          return (
            <Pressable key={analysis.id} onPress={() => router.push({ pathname: '/analysis/[id]', params: { id: analysis.latestAnalysisId } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <DeviceThumbnail uri={analysis.listing.thumbnailUrl} size={78} label={`Première photo de ${analysis.device.displayName}`} />
              <View style={styles.cardCopy}>
                <View style={styles.verdictRow}><View style={[styles.verdictDot, { backgroundColor: verdict.color }]} /><Text style={[styles.verdict, { color: verdict.color }]}>{verdict.label}</Text></View>
                <Text numberOfLines={2} style={styles.product}>{analysis.listing.title}</Text>
                <View style={styles.meta}><Text style={styles.price}>{formatEuros(analysis.listing.priceCents)}</Text><Clock3 size={12} color="#8B958F" /><Text style={styles.date}>{new Date(analysis.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text></View>
              </View>
              <View style={styles.scoreBlock}><Text style={styles.score}>{analysis.verdict.dealScore}</Text><Text style={styles.scoreOver}>/100</Text><ArrowRight size={17} color="#79847D" style={styles.arrow} /></View>
            </Pressable>
          );
        })}
      </View>
      {filtered.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Aucune analyse trouvée</Text><Text style={styles.emptyBody}>Colle une annonce depuis l’accueil pour commencer.</Text></View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: 120 },
  header: { paddingTop: spacing.lg, gap: 6 },
  title: { ...type.h1, color: colors.lightInk },
  subtitle: { color: colors.lightMuted, fontSize: 14, lineHeight: 20, maxWidth: 330 },
  search: { marginTop: 22, minHeight: 50, borderRadius: radii.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.lightBorder, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 14, color: colors.lightInk },
  list: { marginTop: 17, gap: 11 },
  card: { minHeight: 112, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E4DD', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 13, ...shadows.subtle },
  pressed: { opacity: .64, transform: [{ scale: .992 }] },
  cardCopy: { flex: 1, minWidth: 0 },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verdictDot: { width: 7, height: 7, borderRadius: 4 },
  verdict: { fontSize: 12, fontWeight: '600' },
  product: { color: colors.lightInk, fontSize: 15, lineHeight: 19, fontWeight: '700', marginTop: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  price: { color: colors.lightMuted, fontSize: 13, marginRight: 4 },
  date: { color: '#8B958F', fontSize: 11 },
  scoreBlock: { minWidth: 45, alignItems: 'flex-end' },
  score: { color: colors.lightInk, fontSize: 22, lineHeight: 24, fontWeight: '700' },
  scoreOver: { color: '#8B958F', fontSize: 9 },
  arrow: { marginTop: 13 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.xs },
  emptyTitle: { ...type.h3, color: colors.lightInk },
  emptyBody: { ...type.small, color: colors.lightMuted, textAlign: 'center' },
});
