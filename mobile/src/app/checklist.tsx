import { useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DarkHeader, DarkSafeScreen, LimeButton } from '@/components/reference-ui';
import { demoAnalysis, reportFixtures } from '@/data/mock';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { analyses, checklistDone, toggleChecklist } = useAppStore();
  const report = analyses.find((item) => item.id === id)
    ?? Object.values(reportFixtures).find((item) => item.id === id)
    ?? demoAnalysis;
  const groups = [
    { title: 'Avant le rendez-vous', items: report.checklist.beforeMeeting },
    { title: 'Pendant la vérification', items: report.checklist.duringMeeting },
    { title: 'Avant de payer', items: report.checklist.beforePayment },
  ].filter((group) => group.items.length);
  const allItems = groups.flatMap((group) => group.items);

  return (
    <DarkSafeScreen variant="focus">
      <DarkHeader title="Checklist" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Vérifie ton {report.device.category === 'MACBOOK' ? 'MacBook' : 'iPhone'} étape par étape</Text>
        <Text style={styles.subtitle}>Ces contrôles viennent du profil détecté et des risques de cette annonce.</Text>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((item, index) => {
              const checked = checklistDone.includes(item.code);
              return (
                <Pressable key={item.code} onPress={() => toggleChecklist(item.code)} style={styles.row}>
                  <View style={[styles.number, checked && styles.numberDone]}>
                    {checked ? <Check size={13} color={colors.brand900} strokeWidth={3} /> : <Text style={styles.numberText}>{index + 1}</Text>}
                  </View>
                  <Text style={[styles.itemLabel, checked && styles.itemDone]}>{item.label}</Text>
                  {item.critical ? <Text style={styles.critical}>ESSENTIEL</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
        <LimeButton
          label="Tout marquer comme vérifié"
          onPress={() => allItems.filter((item) => !checklistDone.includes(item.code)).forEach((item) => toggleChecklist(item.code))}
          style={styles.button}
        />
      </ScrollView>
    </DarkSafeScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.gutter, paddingTop: 6, paddingBottom: 24 },
  title: { ...type.h2, color: colors.white },
  subtitle: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  group: { marginTop: 22 },
  groupTitle: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 5 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, gap: 11 },
  number: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },
  numberDone: { backgroundColor: colors.lime, borderColor: colors.lime },
  numberText: { color: colors.inkMuted, fontSize: 11 },
  itemLabel: { color: colors.white, fontSize: 12, lineHeight: 17, flex: 1 },
  itemDone: { color: colors.inkMuted, textDecorationLine: 'line-through' },
  critical: { color: colors.lime, fontSize: 7, fontWeight: '800' },
  button: { marginTop: 24 },
});
