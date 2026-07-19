import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

interface ListingImageGalleryProps {
  accessibilityLabel: string;
  urls: (string | null | undefined)[];
}

function pageFromEvent(event: NativeSyntheticEvent<NativeScrollEvent>, width: number) {
  return width > 0 ? Math.round(event.nativeEvent.contentOffset.x / width) : 0;
}

export function ListingImageGallery({ accessibilityLabel, urls }: ListingImageGalleryProps) {
  const images = useMemo(
    () => [...new Set(urls.filter((url): url is string => Boolean(url)))],
    [urls],
  );
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef<FlatList<string>>(null);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, 20);

  if (!images.length) return null;

  const open = (selected: number) => {
    setIndex(selected);
    setFullscreen(true);
  };

  return (
    <>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.gallery}
      >
        {width > 0 ? (
          <FlatList
            data={images}
            decelerationRate="fast"
            horizontal
            keyExtractor={(uri) => uri}
            nestedScrollEnabled
            onMomentumScrollEnd={(event) => setIndex(pageFromEvent(event, width))}
            pagingEnabled
            renderItem={({ item, index: imageIndex }) => (
              <Pressable
                accessibilityLabel={`${accessibilityLabel}, photo ${imageIndex + 1} sur ${images.length}. Agrandir`}
                accessibilityRole="imagebutton"
                onPress={() => open(imageIndex)}
                style={[styles.inlinePage, { width }]}
              >
                <Image
                  contentFit="cover"
                  recyclingKey={item}
                  source={{ uri: item }}
                  style={styles.image}
                  transition={180}
                />
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
          />
        ) : null}
        {images.length > 1 ? <Pagination count={images.length} index={index} /> : null}
        <View pointerEvents="none" style={styles.expandHint}>
          <Text style={styles.expandText}>Agrandir</Text>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        onShow={() => requestAnimationFrame(() => fullscreenRef.current?.scrollToOffset({ offset: index * screenWidth, animated: false }))}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={fullscreen}
      >
        <SafeAreaView edges={['bottom']} style={styles.fullscreen}>
          <View style={[styles.fullHeader, { height: 56 + safeTop, paddingTop: safeTop }]}>
            <Text style={styles.counter}>{index + 1} / {images.length}</Text>
            <Pressable
              accessibilityLabel="Fermer les photos"
              hitSlop={8}
              onPress={() => setFullscreen(false)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <X color={colors.white} size={24} />
            </Pressable>
          </View>
          <FlatList
            ref={fullscreenRef}
            data={images}
            decelerationRate="fast"
            getItemLayout={(_, imageIndex) => ({ index: imageIndex, length: screenWidth, offset: screenWidth * imageIndex })}
            horizontal
            keyExtractor={(uri) => `fullscreen-${uri}`}
            onMomentumScrollEnd={(event) => setIndex(pageFromEvent(event, screenWidth))}
            pagingEnabled
            renderItem={({ item, index: imageIndex }) => (
              <View accessibilityLabel={`${accessibilityLabel}, photo ${imageIndex + 1} sur ${images.length}`} style={[styles.fullPage, { width: screenWidth }]}>
                <Image contentFit="contain" recyclingKey={`fullscreen-${item}`} source={{ uri: item }} style={styles.fullImage} transition={120} />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
            style={styles.fullList}
          />
          <View style={styles.fullFooter}>
            {images.length > 1 ? <Pagination count={images.length} index={index} fullscreen /> : null}
            <Text style={styles.swipeHint}>{images.length > 1 ? 'Balaye pour voir les autres photos' : 'Photo de l’annonce'}</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function Pagination({ count, index, fullscreen = false }: { count: number; index: number; fullscreen?: boolean }) {
  return (
    <View pointerEvents="none" style={fullscreen ? styles.fullDots : styles.dots}>
      {Array.from({ length: count }, (_, dotIndex) => (
        <View key={dotIndex} style={[styles.dot, fullscreen && styles.fullDot, dotIndex === index && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { width: '100%', aspectRatio: 1.52, alignSelf: 'center', overflow: 'hidden', borderRadius: 20, backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.border },
  inlinePage: { height: '100%' },
  image: { width: '100%', height: '100%' },
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, backgroundColor: 'rgba(0,20,14,.62)', paddingHorizontal: 9, paddingVertical: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.48)' },
  fullDot: { backgroundColor: 'rgba(255,255,255,.34)' },
  dotActive: { backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: .8, shadowRadius: 5 },
  expandHint: { position: 'absolute', top: 11, right: 11, borderRadius: 14, backgroundColor: 'rgba(0,20,14,.66)', paddingHorizontal: 9, paddingVertical: 5 },
  expandText: { color: 'rgba(255,255,255,.88)', fontSize: 9, lineHeight: 12, fontWeight: '600' },
  fullscreen: { flex: 1, backgroundColor: '#000B08' },
  fullHeader: { height: 56, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: colors.white, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,.14)' },
  pressed: { opacity: .7 },
  fullList: { flex: 1 },
  fullPage: { flex: 1, justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%' },
  fullFooter: { minHeight: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  fullDots: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  swipeHint: { color: '#83968D', fontSize: 10, lineHeight: 14, marginTop: 9 },
});
