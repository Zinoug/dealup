import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ClipboardPaste, LockKeyhole, MessageSquareText, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandButton } from '@/components/brand-button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useAppStore } from '@/store/app-store';
import { colors, layout, radii, spacing, type } from '@/theme/tokens';

const MAX_IMAGES = 5;

export default function ReanalyzeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reanalyze, isBusy } = useAppStore();
  const [reply, setReply] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [pasteHint, setPasteHint] = useState('');

  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      setPasteHint('Aucun message trouvé dans le presse-papiers.');
      return;
    }
    setReply(text);
    setPasteHint('Message ajouté. Tu peux le relire et le modifier.');
  };

  const addImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_IMAGES - images.length),
      quality: 0.82,
    });
    if (!result.canceled) {
      setImages((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_IMAGES));
    }
  };

  const submit = async () => {
    if (!id || isBusy || (!reply.trim() && !images.length)) return;
    const analysisId = await reanalyze(id, reply.trim(), images);
    if (analysisId) router.replace({ pathname: '/analysis-progress', params: { id: analysisId, parent: id } });
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <ScreenHeader back compact />
      <View style={styles.copy}>
        <Text style={styles.title}>Ajoute la réponse du vendeur</Text>
        <Text style={styles.subtitle}>Colle son message, relis-le puis ajoute si besoin les captures ou photos qu’il vient de t’envoyer.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.labelRow}>
          <MessageSquareText size={18} color={colors.brand700} />
          <Text style={styles.label}>Réponse du vendeur</Text>
          <Text style={styles.optional}>facultatif</Text>
        </View>
        <TextInput
          value={reply}
          onChangeText={(value) => { setReply(value); setPasteHint(''); }}
          multiline
          textAlignVertical="top"
          placeholder="Ex. Oui, j’ai la facture. La batterie est à 91 %…"
          placeholderTextColor={colors.lightMuted}
          selectionColor={colors.brand600}
          style={styles.textarea}
          accessibilityLabel="Réponse du vendeur"
        />
        <Pressable onPress={() => void paste()} style={styles.pasteButton}>
          <ClipboardPaste size={18} color={colors.brand700} />
          <Text style={styles.pasteText}>Coller depuis le presse-papiers</Text>
        </Pressable>
        {pasteHint ? <Text style={styles.hint}>{pasteHint}</Text> : null}
      </View>

      <View style={styles.form}>
        <View style={styles.labelRow}>
          <Camera size={18} color={colors.brand700} />
          <Text style={styles.label}>Captures et nouvelles photos</Text>
          <Text style={styles.optional}>{images.length}/{MAX_IMAGES}</Text>
        </View>
        <View style={styles.images}>
          {images.map((uri) => (
            <View key={uri} style={styles.imageShell}>
              <Image source={{ uri }} style={styles.image} contentFit="cover" />
              <Pressable onPress={() => setImages((items) => items.filter((item) => item !== uri))} accessibilityLabel="Retirer cette image" style={styles.remove}>
                <X size={15} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_IMAGES ? (
            <Pressable onPress={() => void addImages()} style={styles.addImage}>
              <Camera size={24} color={colors.brand700} />
              <Text style={styles.addLabel}>Ajouter</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.privacy}>
        <LockKeyhole size={18} color={colors.brand800} />
        <Text style={styles.privacyText}>Ces nouveaux échanges restent privés et servent uniquement à mettre à jour ce rapport.</Text>
      </View>
      <View style={styles.footer}>
        <BrandButton
          label="Mettre à jour l’analyse"
          loading={isBusy}
          disabled={!reply.trim() && !images.length}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  copy: { paddingHorizontal: layout.gutter },
  title: { ...type.h1, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm },
  form: { paddingHorizontal: layout.gutter, marginTop: spacing.xl, gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.label, color: colors.ink, flex: 1 },
  optional: { ...type.caption, color: colors.inkSoft },
  textarea: { minHeight: 150, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.lg, backgroundColor: colors.white, padding: spacing.md, ...type.body, color: colors.lightInk },
  pasteButton: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  pasteText: { ...type.caption, color: colors.brand700 },
  hint: { ...type.caption, color: colors.brand700 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  imageShell: { width: 84, height: 84, borderRadius: radii.md, overflow: 'visible' },
  image: { width: '100%', height: '100%', borderRadius: radii.md, backgroundColor: colors.border },
  remove: { position: 'absolute', right: -7, top: -7, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  addImage: { width: 84, height: 84, borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.brand500, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  addLabel: { ...type.caption, color: colors.brand700 },
  privacy: { marginHorizontal: layout.gutter, marginTop: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.limeSoft, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  privacyText: { ...type.small, color: colors.brand800, flex: 1 },
  footer: { paddingHorizontal: layout.gutter, marginTop: spacing.xl },
});
