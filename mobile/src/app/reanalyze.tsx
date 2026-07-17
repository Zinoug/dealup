import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, MessageSquareText, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard } from '@/components/reference-ui';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';

export default function ReanalyzeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reanalyze } = useAppStore();
  const [busy, setBusy] = useState(false);

  const start = async (reply: string, mediaUris: string[]) => {
    if (!id || busy) return;
    setBusy(true);
    const analysisId = await reanalyze(id, reply, mediaUris);
    setBusy(false);
    if (analysisId) router.replace({ pathname: '/analysis-progress', params: { id: analysisId, parent: id } });
  };
  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) await start(text, []);
  };
  const chooseImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10 });
    if (!result.canceled) await start('', result.assets.map((asset) => asset.uri));
  };

  return (
    <DarkSafeScreen>
      <DarkHeader title="Ajouter la réponse du vendeur" />
      <View style={styles.body}>
        <View style={styles.illustration}><View style={styles.bubbleA} /><View style={styles.bubbleB} /><View style={styles.bubbleC} /></View>
        <Text style={styles.title}>Ajoute la réponse du vendeur</Text>
        <Text style={styles.subtitle}>Colle son message ou ajoute ses captures. DealUp reprend le rapport existant sans consommer une nouvelle analyse.</Text>
        <View style={styles.actions}>
          <Action icon={<MessageSquareText size={20} color={colors.lime} />} label={busy ? 'Réanalyse…' : 'Coller le message'} onPress={() => void paste()} />
          <Action icon={<Camera size={20} color={colors.lime} />} label={busy ? 'Réanalyse…' : 'Envoyer des captures'} onPress={() => void chooseImages()} />
        </View>
        <GlassCard style={styles.info}><ShieldCheck size={22} color={colors.lime} /><Text style={styles.infoText}>Le score, le prix cible, les risques et les éléments résolus seront recalculés.</Text></GlassCard>
      </View>
    </DarkSafeScreen>
  );
}

function Action({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.action}>{icon}<Text style={styles.actionText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: layout.gutter, alignItems: 'center' },
  illustration: { width: 180, height: 150, marginTop: 30 },
  bubbleA: { position: 'absolute', left: 5, top: 50, width: 95, height: 48, borderRadius: 15, backgroundColor: '#28B35A' },
  bubbleB: { position: 'absolute', right: 0, bottom: 10, width: 95, height: 45, borderRadius: 15, backgroundColor: colors.lime },
  bubbleC: { position: 'absolute', right: 28, top: 20, width: 110, height: 55, borderRadius: 16, backgroundColor: '#183B33' },
  title: { ...type.h2, color: colors.white, textAlign: 'center', marginTop: 5 },
  subtitle: { ...type.small, color: colors.inkMuted, textAlign: 'center', marginTop: 12, lineHeight: 20, maxWidth: 340 },
  actions: { width: '100%', gap: 10, marginTop: 30 },
  action: { minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(7,41,32,.75)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  actionText: { color: colors.white, fontSize: 14 },
  info: { width: '100%', marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 13 },
  infoText: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, flex: 1 },
});
