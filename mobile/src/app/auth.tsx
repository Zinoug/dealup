import {
  isClerkAPIResponseError,
  useSignIn,
  useSignInWithApple,
  useSignUp,
  useSSO,
} from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ArrowLeft, Mail, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { EntryBrand, EntryPrimaryButton, EntryScreen } from '@/components/entry-ui';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

type VerificationMode = 'sign-in' | 'sign-up' | null;

function clerkMessage(reason: unknown): string {
  if (isClerkAPIResponseError(reason)) return reason.errors[0]?.longMessage || reason.errors[0]?.message || 'Connexion impossible.';
  return reason instanceof Error ? reason.message : 'Connexion impossible. Réessaie.';
}

export default function AuthScreen() {
  const { pendingUrl, beginOnboarding, completeOnboarding } = useAppStore();
  const { height } = useWindowDimensions();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [register, setRegister] = useState(true);
  const [verification, setVerification] = useState<VerificationMode>(null);
  const [busyProvider, setBusyProvider] = useState<'email' | 'apple' | 'google' | null>(null);
  const [toast, setToast] = useState('');
  const busy = busyProvider !== null;

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const finish = (newAccount: boolean) => {
    if (newAccount) {
      beginOnboarding();
      router.replace('/onboarding');
      return;
    }
    completeOnboarding();
    router.replace(pendingUrl ? '/handle-share' : '/(tabs)');
  };

  const sendCode = async () => {
    if (!email.trim().includes('@')) return setToast('Entre une adresse e-mail valide');
    if (!signInLoaded || !signUpLoaded) return;
    setBusyProvider('email');
    setToast('');
    try {
      if (register) {
        await signUp.create({ emailAddress: email.trim() });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setVerification('sign-up');
      } else {
        const attempt = await signIn.create({ identifier: email.trim() });
        const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === 'email_code');
        if (!factor || !('emailAddressId' in factor)) throw new Error('La connexion par code e-mail n’est pas activée dans Clerk.');
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
        setVerification('sign-in');
      }
    } catch (reason) {
      setToast(clerkMessage(reason));
    } finally {
      setBusyProvider(null);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length < 6) return setToast('Entre le code reçu par e-mail');
    setBusyProvider('email');
    setToast('');
    try {
      if (verification === 'sign-up') {
        if (!signUpLoaded) return;
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status !== 'complete' || !result.createdSessionId) throw new Error('La création du compte nécessite une étape supplémentaire.');
        await setActiveSignUp({ session: result.createdSessionId });
        finish(true);
      } else {
        if (!signInLoaded) return;
        const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() });
        if (result.status !== 'complete' || !result.createdSessionId) throw new Error('La connexion nécessite une étape supplémentaire.');
        await setActiveSignIn({ session: result.createdSessionId });
        finish(false);
      }
    } catch (reason) {
      setToast(clerkMessage(reason));
    } finally {
      setBusyProvider(null);
    }
  };

  const authenticateApple = async () => {
    if (busy) return;
    setBusyProvider('apple');
    setToast('');
    try {
      const result = await startAppleAuthenticationFlow();
      if (!result.createdSessionId || !result.setActive) return;
      await result.setActive({ session: result.createdSessionId });
      finish(result.signUp?.createdSessionId === result.createdSessionId);
    } catch (reason) {
      setToast(clerkMessage(reason));
    } finally {
      setBusyProvider(null);
    }
  };

  const authenticateGoogle = async () => {
    if (busy) return;
    setBusyProvider('google');
    setToast('');
    try {
      const result = await startSSOFlow({ strategy: 'oauth_google' });
      if (!result.createdSessionId || !result.setActive) return;
      await result.setActive({ session: result.createdSessionId });
      finish(result.signUp?.createdSessionId === result.createdSessionId);
    } catch (reason) {
      setToast(clerkMessage(reason));
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <EntryScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {verification ? <Pressable onPress={() => setVerification(null)} hitSlop={12} style={styles.back}><ArrowLeft size={25} color={colors.white} /></Pressable> : null}
          <View style={[styles.brand, { marginTop: height > 850 ? 38 : 16 }]}><EntryBrand size={78} /></View>
          <View style={styles.copy}>
            <Text style={styles.title}>{verification ? 'Entre le code reçu' : 'Bienvenue sur DealUp'}</Text>
            <Text style={styles.subtitle}>{verification ? `Code envoyé à ${email.trim()}` : 'Vérifie ton prochain appareil avant de payer.'}</Text>
          </View>

          {!verification ? (
            <View style={styles.modeTabs}>
              <Pressable onPress={() => setRegister(true)} style={[styles.modeTab, register && styles.modeTabActive]}><Text style={[styles.modeText, register && styles.modeTextActive]}>Créer un compte</Text></Pressable>
              <Pressable onPress={() => setRegister(false)} style={[styles.modeTab, !register && styles.modeTabActive]}><Text style={[styles.modeText, !register && styles.modeTextActive]}>Se connecter</Text></Pressable>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.inputShell}>
              <Mail size={21} color="#91A49B" />
              <TextInput
                value={verification ? code : email}
                onChangeText={(value) => {
                  if (verification) setCode(value.replace(/\D/g, '').slice(0, 6));
                  else setEmail(value);
                  setToast('');
                }}
                autoFocus={Boolean(verification)}
                autoCapitalize="none"
                autoComplete={verification ? 'one-time-code' : 'email'}
                keyboardType={verification ? 'number-pad' : 'email-address'}
                textContentType={verification ? 'oneTimeCode' : 'emailAddress'}
                placeholder={verification ? 'Code à 6 chiffres' : 'Adresse e-mail'}
                placeholderTextColor="#879990"
                style={styles.input}
              />
            </View>
          </View>

          <EntryPrimaryButton label={verification ? 'Valider le code' : 'Continuer par e-mail'} loading={busyProvider === 'email'} onPress={() => void (verification ? verifyCode() : sendCode())} style={styles.submit} />

          {!verification ? <>
            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.or}>ou</Text><View style={styles.dividerLine} /></View>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void authenticateApple()} style={({ pressed }) => [styles.socialButton, styles.appleButton, pressed && styles.pressed, busy && styles.providerDisabled]}>
              <SymbolView name="apple.logo" size={22} tintColor="#FFFFFF" weight="medium" />
              <Text style={styles.socialText}>Continuer avec Apple</Text>
              <View style={styles.socialTrailing}>{busyProvider === 'apple' ? <ActivityIndicator color="#FFFFFF" /> : null}</View>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void authenticateGoogle()} style={({ pressed }) => [styles.socialButton, styles.googleButton, pressed && styles.pressed, busy && styles.providerDisabled]}>
              <Image source={require('../../assets/brands/google-g.png')} style={styles.googleLogo} />
              <Text style={styles.socialText}>Continuer avec Google</Text>
              <View style={styles.socialTrailing}>{busyProvider === 'google' ? <ActivityIndicator color="#FFFFFF" /> : null}</View>
            </Pressable>
            {register ? (
              <Text style={styles.legalCopy}>
                En créant un compte, tu acceptes nos{' '}
                <Text onPress={() => void Linking.openURL('https://joindealup.com/conditions/')} style={styles.legalLink}>Conditions d’utilisation</Text>
                {' '}et notre{' '}
                <Text onPress={() => void Linking.openURL('https://joindealup.com/confidentialite/')} style={styles.legalLink}>Politique de confidentialité</Text>.
              </Text>
            ) : null}
          </> : <Pressable disabled={busy} onPress={() => void sendCode()} style={styles.resend}><Text style={styles.resendText}>Renvoyer le code</Text></Pressable>}
        </ScrollView>
      </KeyboardAvoidingView>
      {toast ? <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(140)} style={styles.toast}><Text style={styles.toastText}>{toast}</Text><Pressable onPress={() => setToast('')} hitSlop={10}><X size={15} color="#E8F0EB" /></Pressable></Animated.View> : null}
    </EntryScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 22 },
  back: { position: 'absolute', top: 8, left: 20, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  brand: { alignItems: 'center' },
  copy: { alignItems: 'center', marginTop: 30 },
  title: { color: colors.white, fontSize: 29, lineHeight: 35, fontWeight: '700', letterSpacing: -.6, textAlign: 'center' },
  subtitle: { color: '#A7B5AE', fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  modeTabs: { height: 48, marginTop: 28, padding: 4, borderRadius: 15, backgroundColor: 'rgba(3,42,32,.72)', borderWidth: 1, borderColor: 'rgba(113,165,142,.22)', flexDirection: 'row' },
  modeTab: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeTabActive: { backgroundColor: 'rgba(194,245,42,.14)' },
  modeText: { color: '#81938A', fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: colors.white },
  form: { marginTop: 14 },
  inputShell: { minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(106,160,137,.24)', backgroundColor: 'rgba(4,45,35,.68)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  input: { flex: 1, minHeight: 56, color: colors.white, fontSize: 15 },
  submit: { marginTop: 15, minHeight: 58 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 17, marginTop: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(137,172,157,.22)' },
  or: { color: '#AEBAB4', fontSize: 12 },
  socialButton: { width: '100%', height: 56, borderRadius: 16, backgroundColor: 'rgba(2,25,19,.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,.32)', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  appleButton: { marginTop: 17 },
  providerDisabled: { opacity: .58 },
  googleButton: { marginTop: 10 },
  googleLogo: { width: 21, height: 21 },
  socialText: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  socialTrailing: { width: 22, alignItems: 'center' },
  legalCopy: { marginTop: 18, paddingHorizontal: 8, color: '#879990', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  legalLink: { color: '#C5D2CC', textDecorationLine: 'underline' },
  pressed: { opacity: .72, transform: [{ scale: .987 }] },
  resend: { alignItems: 'center', marginTop: 22, paddingVertical: 12 },
  resendText: { color: colors.lime, fontSize: 13, fontWeight: '600' },
  toast: { position: 'absolute', left: 26, right: 26, bottom: 24, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(160,202,183,.28)', backgroundColor: 'rgba(2,36,28,.96)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 16 },
  toastText: { flex: 1, color: '#E8F0EB', fontSize: 13, fontWeight: '600' },
});
