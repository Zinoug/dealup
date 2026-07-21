import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard } from '@/components/reference-ui';
import { reportFixtures } from '@/data/dev-report-fixtures';
import { runtime } from '@/services/runtime';
import { colors, layout, type } from '@/theme/tokens';

export default function ReportLabScreen() {
  if (!runtime.devTools) return <Redirect href="/(tabs)" />;

  return (
    <DarkSafeScreen variant="focus" edges={['top', 'left', 'right']}>
      <DarkHeader title="Laboratoire rapports" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}><Text style={styles.title}>8 états de contrôle</Text><Text style={styles.subtitle}>Cette page existe uniquement dans les outils de développement.</Text><View style={styles.grid}>{Object.values(reportFixtures).map((report) => <Pressable key={report.id} onPress={() => router.push({ pathname: '/analysis/[id]', params: { id: report.id } })} style={styles.cell}><GlassCard style={styles.card}><Text style={styles.category}>{report.device.category === 'MACBOOK' ? 'MACBOOK' : 'IPHONE'}</Text><Text style={styles.verdict}>{report.templateId}</Text><Text style={styles.score}>{report.verdict.dealScore}/100</Text></GlassCard></Pressable>)}</View></ScrollView>
    </DarkSafeScreen>
  );
}

const styles = StyleSheet.create({ body: { paddingHorizontal: layout.gutter, paddingBottom: 24 }, title: { ...type.h1, color: colors.white, marginTop: 10 }, subtitle: { color: colors.inkMuted, fontSize: 12, marginTop: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }, cell: { width: '48%' }, card: { minHeight: 130, justifyContent: 'center' }, category: { color: colors.inkMuted, fontSize: 9 }, verdict: { color: colors.white, fontSize: 13, fontWeight: '700', marginTop: 2 }, score: { color: colors.lime, fontSize: 18, fontWeight: '800', marginTop: 5 } });
