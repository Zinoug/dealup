import { router, useFocusEffect } from 'expo-router';
import { ArrowUpRight, Clock3, Search } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DeviceThumbnail } from '@/components/device-thumbnail';
import { Screen } from '@/components/screen';
import { telemetry } from '@/services/telemetry';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';
import { formatEuros } from '@/utils/format';

const verdictLabels = { BUY: 'Acheter', NEGOTIATE: 'Négocier', VERIFY_FIRST: 'Vérifier', PASS: 'Passer' } as const;

export default function HistoryScreen() {
  const { analyses } = useAppStore();
  const [query, setQuery] = useState('');
  useFocusEffect(useCallback(() => { telemetry.screen('history'); }, []));
  const filtered = useMemo(() => analyses.filter((item) => item.listing.title.toLowerCase().includes(query.toLowerCase())), [analyses, query]);

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <View style={styles.header}><Text style={styles.title}>Tes analyses</Text><Text style={styles.subtitle}>Retrouve chaque décision et reprends la conversation avec le vendeur.</Text></View>
      <View style={styles.search}><Search size={20} color={colors.inkMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un appareil" placeholderTextColor={colors.inkSoft} style={styles.searchInput} accessibilityLabel="Rechercher dans les analyses" /></View>
      <View style={styles.list}>
        {filtered.map((analysis, index) => (
          <Pressable key={analysis.id} onPress={() => router.push({ pathname: '/analysis/[id]', params: { id: analysis.id } })} style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}>
            <DeviceThumbnail category={analysis.device.category} size={64} />
            <View style={styles.rowCopy}>
              <View style={styles.rowTop}><Text style={styles.verdict}>{verdictLabels[analysis.verdict.type]}</Text><Text style={styles.score}>{analysis.verdict.dealScore}/100</Text></View>
              <Text numberOfLines={2} style={styles.product}>{analysis.listing.title}</Text>
              <View style={styles.meta}><Text style={styles.price}>{formatEuros(analysis.listing.priceCents)}</Text><Clock3 size={13} color={colors.inkSoft} /><Text style={styles.date}>{new Date(analysis.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text></View>
            </View>
            <ArrowUpRight size={20} color={colors.inkSoft} />
          </Pressable>
        ))}
      </View>
      {filtered.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Aucune analyse trouvée</Text><Text style={styles.emptyBody}>Essaie avec le modèle ou la capacité de stockage.</Text></View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.lg, gap: spacing.xs },
  title: { ...type.h1, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted },
  search: { marginTop: spacing.lg, minHeight: 50, borderRadius: radii.md, backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, minHeight: 48, ...type.small, color: colors.ink },
  list: { marginTop: spacing.lg },
  row: { minHeight: 116, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.58 },
  rowCopy: { flex: 1, gap: spacing.xxs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  verdict: { ...type.caption, color: colors.brand700, textTransform: 'uppercase', letterSpacing: 0.7 },
  score: { ...type.caption, color: colors.ink },
  product: { ...type.bodyStrong, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  price: { ...type.small, color: colors.inkMuted, marginRight: spacing.xs },
  date: { ...type.caption, color: colors.inkSoft },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.xs },
  emptyTitle: { ...type.h3, color: colors.ink },
  emptyBody: { ...type.small, color: colors.inkMuted },
});
