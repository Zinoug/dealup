import { useIncomingShare } from 'expo-sharing';
import { Redirect, router } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BrandButton } from '@/components/brand-button';
import { Screen } from '@/components/screen';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';
import { findUrl, isLeboncoinUrl } from '@/utils/format';

export default function HandleShareScreen() {
  const { sharedPayloads, isResolving, error, clearSharedPayloads } = useIncomingShare();
  const { isReady, isSignedIn, pendingUrl, setPendingUrl, identifyListing, isBusy } = useAppStore();
  const processed = useRef(false);
  const sharedUrl = useMemo(() => sharedPayloads.map((payload) => findUrl(payload.value)).find(Boolean) ?? null, [sharedPayloads]);
  const candidateUrl = sharedUrl ?? pendingUrl;

  useEffect(() => {
    if (sharedUrl) setPendingUrl(sharedUrl);
  }, [setPendingUrl, sharedUrl]);

  useEffect(() => {
    if (!isReady || !isSignedIn || !candidateUrl || processed.current || !isLeboncoinUrl(candidateUrl)) return;
    processed.current = true;
    identifyListing(candidateUrl).then((listing) => {
      if (listing) {
        clearSharedPayloads();
        router.replace('/listing-preview');
      }
    });
  }, [candidateUrl, clearSharedPayloads, identifyListing, isReady, isSignedIn]);

  if (isReady && !isSignedIn && candidateUrl) return <Redirect href="/auth" />;
  if (!isResolving && !candidateUrl) return <Redirect href="/(tabs)" />;

  const invalid = !isResolving && Boolean(candidateUrl) && !isLeboncoinUrl(candidateUrl ?? '');
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.icon}><Share2 size={34} color={colors.brand800} /></View>
      <Text style={styles.title}>{invalid ? 'Ce lien ne vient pas de Leboncoin' : 'On récupère ton annonce…'}</Text>
      <Text style={styles.body}>{invalid ? 'DealUp analyse pour l’instant les iPhone compatibles et les MacBook Apple Silicon publiés sur Leboncoin.' : 'Tu n’auras pas besoin de recoller le lien.'}</Text>
      {isResolving || isBusy ? <ActivityIndicator color={colors.brand600} size="large" /> : null}
      {error ? <Text style={styles.error}>Le partage n’a pas pu être lu. Ouvre DealUp et colle le lien directement.</Text> : null}
      {invalid || error ? <BrandButton label="Retourner à l’accueil" onPress={() => { clearSharedPayloads(); setPendingUrl(null); router.replace('/(tabs)'); }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  icon: { width: 78, height: 78, borderRadius: radii.lg, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.h1, color: colors.ink, textAlign: 'center' },
  body: { ...type.body, color: colors.inkMuted, textAlign: 'center', maxWidth: 360 },
  error: { ...type.small, color: colors.red, textAlign: 'center' },
});
