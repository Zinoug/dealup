import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, LockKeyhole, MessageSquareText, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandButton } from '@/components/brand-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

export default function SellerContextScreen() {
  const { sellerReply, sellerMediaUris, setSellerContext } = useAppStore();
  const [reply, setReply] = useState(sellerReply);
  const [images, setImages] = useState(sellerMediaUris);

  const addImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, 5 - images.length), quality: 0.82 });
    if (!result.canceled) setImages((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 5));
  };

  const continueFlow = () => {
    setSellerContext(true, reply.trim(), images);
    router.push('/analysis-confirm');
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <ScreenHeader back compact />
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>CONTEXTE VENDEUR</Text>
        <Text style={styles.title}>Qu’est-ce qu’il t’a répondu ?</Text>
        <Text style={styles.subtitle}>Colle son message tel quel. Tu peux aussi ajouter des captures ou les photos qu’il vient d’envoyer.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.labelRow}><MessageSquareText size={18} color={colors.brand700} /><Text style={styles.label}>Réponse du vendeur</Text><Text style={styles.optional}>facultatif</Text></View>
        <TextInput
          value={reply}
          onChangeText={setReply}
          multiline
          textAlignVertical="top"
          placeholder="Ex. Oui, j’ai la facture. La batterie est à 91 %…"
          placeholderTextColor={colors.inkSoft}
          style={styles.textarea}
          accessibilityLabel="Réponse du vendeur"
        />
      </View>

      <View style={styles.form}>
        <View style={styles.labelRow}><Camera size={18} color={colors.brand700} /><Text style={styles.label}>Captures et nouvelles photos</Text><Text style={styles.optional}>{images.length}/5</Text></View>
        <View style={styles.images}>
          {images.map((uri) => (
            <View key={uri} style={styles.imageShell}><Image source={{ uri }} style={styles.image} contentFit="cover" /><Pressable onPress={() => setImages((items) => items.filter((item) => item !== uri))} accessibilityLabel="Retirer cette image" style={styles.remove}><X size={15} color={colors.white} /></Pressable></View>
          ))}
          {images.length < 5 ? <Pressable onPress={() => void addImages()} style={styles.addImage}><Camera size={24} color={colors.brand700} /><Text style={styles.addLabel}>Ajouter</Text></Pressable> : null}
        </View>
      </View>

      <View style={styles.privacy}><LockKeyhole size={18} color={colors.brand800} /><Text style={styles.privacyText}>Ces échanges restent privés. Ils ne servent jamais à l’analyse d’un autre utilisateur.</Text></View>
      <View style={styles.footer}><BrandButton label="Continuer vers l’analyse" onPress={continueFlow} /><BrandButton label="Continuer sans réponse" variant="ghost" onPress={() => { setSellerContext(false); router.push('/analysis-confirm'); }} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  copy: { paddingHorizontal: layout.gutter },
  eyebrow: { ...type.caption, color: colors.brand700, letterSpacing: 1 },
  title: { ...type.h1, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm },
  form: { paddingHorizontal: layout.gutter, marginTop: spacing.xl, gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label, color: colors.ink, flex: 1 },
  optional: { ...type.caption, color: colors.inkSoft },
  textarea: { minHeight: 150, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.lg, backgroundColor: colors.white, padding: spacing.md, ...type.body, color: colors.ink },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  imageShell: { width: 84, height: 84, borderRadius: radii.md, overflow: 'visible' },
  image: { width: '100%', height: '100%', borderRadius: radii.md, backgroundColor: colors.border },
  remove: { position: 'absolute', right: -7, top: -7, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  addImage: { width: 84, height: 84, borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.brand500, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  addLabel: { ...type.caption, color: colors.brand700 },
  privacy: { marginHorizontal: layout.gutter, marginTop: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.limeSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  privacyText: { ...type.small, color: colors.brand800, flex: 1 },
  footer: { paddingHorizontal: layout.gutter, marginTop: spacing.xl, gap: spacing.sm },
});
