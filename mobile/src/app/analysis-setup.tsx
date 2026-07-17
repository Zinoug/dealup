import { router } from 'expo-router';
import { Bike, PackageCheck, Store, Truck, UserRoundCheck, UserRoundX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandButton } from '@/components/brand-button';
import { OptionRow } from '@/components/option-row';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useAppStore } from '@/store/app-store';
import { colors, layout, spacing, type } from '@/theme/tokens';

export default function AnalysisSetupScreen() {
  const { purchaseMode, setPurchaseMode, alreadyContacted, setSellerContext, identification } = useAppStore();
  const [step, setStep] = useState<1 | 2>(1);
  const deviceName = identification?.compatibility?.device?.category === 'MACBOOK' ? 'ce MacBook' : 'cet iPhone';

  const continueFlow = () => {
    if (step === 1) return setStep(2);
    if (alreadyContacted) router.push('/seller-context');
    else router.push('/analysis-confirm');
  };

  return (
    <Screen contentStyle={styles.screen}>
      <ScreenHeader back onBack={step === 2 ? () => setStep(1) : undefined} rightLabel={`${step}/2`} compact />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>PERSONNALISER L’ANALYSE</Text>
        <Text style={styles.title}>{step === 1 ? `Comment comptes-tu acheter ${deviceName} ?` : 'As-tu déjà échangé avec le vendeur ?'}</Text>
        <Text style={styles.subtitle}>{step === 1 ? 'Les contrôles et conseils changent selon le mode d’achat.' : 'Sa réponse peut confirmer ou changer plusieurs signaux.'}</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {step === 1 ? (
            <>
              <OptionRow title="Remise en main propre" description="Checklist sur place et tests avant paiement" icon={Store} selected={purchaseMode === 'face_to_face'} onPress={() => setPurchaseMode('face_to_face')} />
              <OptionRow title="Livraison" description="Preuves, paiement et protection à distance" icon={Truck} selected={purchaseMode === 'delivery'} onPress={() => setPurchaseMode('delivery')} />
              <OptionRow title="Je ne sais pas encore" description="Conseils couvrant les deux situations" icon={Bike} selected={purchaseMode === 'unknown'} onPress={() => setPurchaseMode('unknown')} />
            </>
          ) : (
            <>
              <OptionRow title="Non, pas encore" description="DealUp prépare le premier message à envoyer" icon={UserRoundX} selected={!alreadyContacted} onPress={() => setSellerContext(false)} />
              <OptionRow title="Oui, j’ai sa réponse" description="Ajoute le texte, les captures ou de nouvelles photos" icon={UserRoundCheck} selected={alreadyContacted} onPress={() => setSellerContext(true)} badge="PLUS PRÉCIS" />
            </>
          )}
        </View>
      </View>
      <View style={styles.footer}><BrandButton label={step === 1 ? 'Continuer' : alreadyContacted ? 'Ajouter sa réponse' : 'Voir le récapitulatif'} icon={step === 1 ? PackageCheck : UserRoundCheck} disabled={step === 1 && !purchaseMode} onPress={continueFlow} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: layout.gutter },
  eyebrow: { ...type.caption, color: colors.brand700, letterSpacing: 1 },
  title: { ...type.h1, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...type.body, color: colors.inkMuted, marginTop: spacing.sm },
  options: { gap: spacing.sm, marginTop: spacing.xl },
  footer: { padding: layout.gutter },
});
