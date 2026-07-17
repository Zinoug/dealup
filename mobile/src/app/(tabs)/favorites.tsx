import { Heart } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';
import { DarkSafeScreen } from '@/components/reference-ui';
import { colors, spacing, type } from '@/theme/tokens';

export default function FavoritesScreen() { return <DarkSafeScreen style={styles.screen}><Heart size={46} color={colors.lime} /><Text style={styles.title}>Tes favoris</Text><Text style={styles.body}>Les annonces que tu veux comparer apparaîtront ici.</Text></DarkSafeScreen>; }
const styles = StyleSheet.create({ screen: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 70 }, title: { ...type.h1, color: colors.white, marginTop: spacing.lg }, body: { ...type.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm } });
