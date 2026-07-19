import { router } from 'expo-router';
import { CheckSquare2, ShieldQuestion, Tag } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, GlassCard, LimeButton } from '@/components/reference-ui';
import { ListingImageGallery } from '@/components/listing-image-gallery';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';
import { formatEuros } from '@/utils/format';

export default function ListingPreviewScreen() {
  const { identification, hasSubscription, usage } = useAppStore();
  if (!identification) return null;
  const device = identification.compatibility?.device;
  const details = [...identification.facts, ...Object.values(device?.specs ?? {}).map(String), `${identification.photoCount} photos`]
    .filter((value, index, values) => value && values.findIndex((candidate) => candidate.toLocaleLowerCase('fr-FR') === value.toLocaleLowerCase('fr-FR')) === index);
  const photos = [...identification.previewPhotoUrls, identification.thumbnailUrl];
  return (
    <DarkSafeScreen variant="tag" edges={['top', 'left', 'right']}>
      <DarkHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ListingImageGallery accessibilityLabel={`Photos de l’annonce ${device?.displayName ?? identification.title}`} urls={photos} />
        <Text style={styles.title}>{device?.displayName ?? identification.title}</Text>
        <View style={styles.priceRow}><Text style={styles.price}>{formatEuros(identification.priceCents)}</Text><Text style={styles.location}>{identification.location}</Text></View>
        <Text style={styles.sub}>{details.join(' · ')}</Text>

        <GlassCard style={styles.valueBlock}>
          <Text style={styles.valueTitle}>Décide plus vite, avant de payer.</Text>
          <Text style={styles.valueBody}>Cette analyse va te donner une recommandation complète et directement exploitable.</Text>
          <View style={styles.lines}>
            <CheckLine icon={<Tag size={17} color={colors.lime} />} text="Le prix à viser et l’économie possible" />
            <CheckLine icon={<ShieldQuestion size={17} color={colors.lime} />} text="Les risques et les preuves à demander" />
            <CheckLine icon={<CheckSquare2 size={17} color={colors.lime} />} text="La prochaine action et le message à envoyer" />
          </View>
        </GlassCard>

        <View style={styles.cta}><LimeButton label="Analyser cette annonce" onPress={() => {
          if (!hasSubscription) return router.push('/paywall');
          const hasIncludedUnit = usage.used < usage.limit;
          return router.push(hasIncludedUnit || usage.topUpRemaining > 0 ? '/analysis-setup' : '/quota');
        }} /></View>
      </ScrollView>
    </DarkSafeScreen>
  );
}
function CheckLine({ icon, text }: { icon: React.ReactNode; text: string }) { return <View style={styles.line}><View style={styles.lineIcon}>{icon}</View><Text style={styles.lineText}>{text}</Text></View>; }
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingBottom: 24 },
  title: { ...type.h1, color: colors.white, marginTop: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 5 },
  price: { ...type.h2, color: colors.white },
  location: { ...type.small, color: colors.inkMuted },
  sub: { ...type.small, color: '#A6B7AE', marginTop: 5 },
  valueBlock: { marginTop: 18, padding: 17 },
  valueTitle: { color: colors.white, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -.4 },
  valueBody: { color: '#A6B7AE', fontSize: 13, lineHeight: 19, marginTop: 6 },
  lines: { gap: 13, marginTop: 18 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  lineIcon: { width: 22, alignItems: 'center' },
  lineText: { color: '#E3ECE7', fontSize: 13, lineHeight: 18, flex: 1 },
  cta: { marginTop: 20 },
});
