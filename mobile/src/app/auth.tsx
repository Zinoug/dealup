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
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { EntryBrand, EntryPrimaryButton, EntryScreen } from '@/components/entry-ui';
import { telemetry } from '@/services/telemetry';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

type AuthStep = 'email' | 'password' | 'verify-sign-up' | 'reset-code' | 'reset-password';
type Provider = 'email' | 'apple' | 'google';

const PASSWORD_MIN_LENGTH = 8;

const CLERK_MESSAGES: Record<string, string> = {
  form_identifier_not_found: 'Adresse e-mail ou mot de passe incorrect.',
  form_password_incorrect: 'Adresse e-mail ou mot de passe incorrect.',
  form_password_pwned: 'Ce mot de passe a été compromis. Choisis-en un autre.',
  form_password_length_too_short: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  form_code_incorrect: 'Ce code est incorrect. Vérifie l’e-mail reçu.',
  verification_expired: 'Ce code a expiré. Demande un nouveau code.',
  too_many_requests: 'Trop de tentatives. Réessaie dans quelques instants.',
};

function clerkMessage(reason: unknown): string {
  if (isClerkAPIResponseError(reason)) {
    const error = reason.errors[0];
    return CLERK_MESSAGES[error?.code ?? ''] || error?.longMessage || error?.message || 'Connexion impossible.';
  }
  return reason instanceof Error ? reason.message : 'Connexion impossible. Réessaie.';
}

function PasswordField({
  value,
  onChangeText,
  placeholder,
  newPassword = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  newPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.inputShell}>
      <LockKeyhole size={21} color="#91A49B" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoComplete={newPassword ? 'new-password' : 'current-password'}
        autoCorrect={false}
        passwordRules={newPassword ? `minlength: ${PASSWORD_MIN_LENGTH};` : undefined}
        placeholder={placeholder}
        placeholderTextColor="#879990"
        secureTextEntry={!visible}
        style={styles.input}
        textContentType={newPassword ? 'newPassword' : 'password'}
      />
      <Pressable
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        hitSlop={10}
        onPress={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={20} color="#91A49B" /> : <Eye size={20} color="#91A49B" />}
      </Pressable>
    </View>
  );
}

export default function AuthScreen() {
  const { pendingUrl, beginOnboarding, completeOnboarding } = useAppStore();
  const { height } = useWindowDimensions();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [register, setRegister] = useState(true);
  const [step, setStep] = useState<AuthStep>('email');
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [toast, setToast] = useState('');
  const busy = busyProvider !== null;
  const normalizedEmail = email.trim().toLowerCase();

  const copy = useMemo(() => {
    if (step === 'verify-sign-up') return { title: 'Vérifie ton adresse', subtitle: `Entre le code envoyé à ${normalizedEmail}` };
    if (step === 'reset-code') return { title: 'Vérifie ton adresse', subtitle: `Entre le code envoyé à ${normalizedEmail}` };
    if (step === 'reset-password') return { title: 'Choisis un nouveau mot de passe', subtitle: 'Tu pourras ensuite te reconnecter immédiatement.' };
    if (step === 'password' && register) return { title: 'Crée ton mot de passe', subtitle: 'Il sécurisera tes prochaines connexions.' };
    if (step === 'password') return { title: 'Ravi de te revoir', subtitle: 'Entre ton mot de passe pour continuer.' };
    return { title: 'Bienvenue', subtitle: 'Vérifie ton prochain appareil avant de payer.' };
  }, [normalizedEmail, register, step]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const finish = (newAccount: boolean, method: Provider) => {
    setPassword('');
    setPasswordConfirmation('');
    setCode('');
    telemetry.capture(newAccount ? 'sign_up_completed' : 'sign_in_completed', { method });
    if (newAccount) {
      beginOnboarding();
      router.replace('/onboarding');
      return;
    }
    completeOnboarding();
    router.replace(pendingUrl ? '/handle-share' : '/(tabs)');
  };

  const showError = (reason: unknown) => {
    setToast(clerkMessage(reason));
  };

  const continueWithEmail = () => {
    if (!normalizedEmail.includes('@') || normalizedEmail.startsWith('@') || normalizedEmail.endsWith('@')) {
      setToast('Entre une adresse e-mail valide');
      return;
    }
    setToast('');
    setStep('password');
  };

  const validateNewPassword = () => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      setToast(`Choisis un mot de passe d’au moins ${PASSWORD_MIN_LENGTH} caractères`);
      return false;
    }
    if (password !== passwordConfirmation) {
      setToast('Les deux mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  const createAccount = async () => {
    if (!signUpLoaded || !validateNewPassword()) return;
    setBusyProvider('email');
    setToast('');
    try {
      await signUp.create({ emailAddress: normalizedEmail, password, legalAccepted: true });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setCode('');
      setStep('verify-sign-up');
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const signInWithPassword = async () => {
    if (!signInLoaded || !password) {
      if (!password) setToast('Entre ton mot de passe');
      return;
    }
    setBusyProvider('email');
    setToast('');
    try {
      const result = await signIn.create({ strategy: 'password', identifier: normalizedEmail, password });
      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error('Cette connexion nécessite une vérification supplémentaire. Contacte le support DealUp.');
      }
      await setActiveSignIn({ session: result.createdSessionId });
      finish(false, 'email');
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const verifySignUp = async () => {
    if (code.trim().length < 6) {
      setToast('Entre le code reçu par e-mail');
      return;
    }
    if (!signUpLoaded) return;
    setBusyProvider('email');
    setToast('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error('La création du compte nécessite une vérification supplémentaire.');
      }
      await setActiveSignUp({ session: result.createdSessionId });
      finish(true, 'email');
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const requestPasswordReset = async () => {
    if (!signInLoaded) return;
    setBusyProvider('email');
    setToast('');
    try {
      const attempt = await signIn.create({ identifier: normalizedEmail });
      const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === 'reset_password_email_code');
      if (!factor || !('emailAddressId' in factor)) {
        throw new Error('La récupération par e-mail n’est pas activée pour ce compte.');
      }
      await signIn.prepareFirstFactor({
        strategy: 'reset_password_email_code',
        emailAddressId: factor.emailAddressId,
      });
      setCode('');
      setPassword('');
      setPasswordConfirmation('');
      setStep('reset-code');
      telemetry.capture('password_reset_requested', { method: 'email' });
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const verifyResetCode = async () => {
    if (code.trim().length < 6) {
      setToast('Entre le code reçu par e-mail');
      return;
    }
    if (!signInLoaded) return;
    setBusyProvider('email');
    setToast('');
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code: code.trim() });
      if (result.status !== 'needs_new_password') throw new Error('Ce code ne permet pas de modifier le mot de passe.');
      setPassword('');
      setPasswordConfirmation('');
      setStep('reset-password');
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const resetPassword = async () => {
    if (!signInLoaded || !validateNewPassword()) return;
    setBusyProvider('email');
    setToast('');
    try {
      const result = await signIn.resetPassword({ password, signOutOfOtherSessions: true });
      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error('Le mot de passe a été modifié, mais la connexion nécessite une étape supplémentaire.');
      }
      await setActiveSignIn({ session: result.createdSessionId });
      telemetry.capture('password_reset_completed', { method: 'email' });
      finish(false, 'email');
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const resendCode = async () => {
    if (step === 'verify-sign-up') {
      if (!signUpLoaded) return;
      setBusyProvider('email');
      try {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setToast('Un nouveau code vient de t’être envoyé');
      } catch (reason) {
        showError(reason);
      } finally {
        setBusyProvider(null);
      }
      return;
    }
    await requestPasswordReset();
  };

  const goBack = () => {
    setToast('');
    setCode('');
    if (step === 'password') {
      setPassword('');
      setPasswordConfirmation('');
      setStep('email');
      return;
    }
    if (step === 'reset-code') {
      setStep('password');
      return;
    }
    if (step === 'reset-password') {
      setStep('reset-code');
      return;
    }
    setStep('password');
  };

  const switchMode = (nextRegister: boolean) => {
    setRegister(nextRegister);
    setStep('email');
    setPassword('');
    setPasswordConfirmation('');
    setCode('');
    setToast('');
  };

  const authenticateApple = async () => {
    if (busy) return;
    setBusyProvider('apple');
    setToast('');
    try {
      const result = await startAppleAuthenticationFlow();
      if (!result.createdSessionId || !result.setActive) return;
      await result.setActive({ session: result.createdSessionId });
      finish(result.signUp?.createdSessionId === result.createdSessionId, 'apple');
    } catch (reason) {
      showError(reason);
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
      finish(result.signUp?.createdSessionId === result.createdSessionId, 'google');
    } catch (reason) {
      showError(reason);
    } finally {
      setBusyProvider(null);
    }
  };

  const submit = () => {
    if (step === 'email') return continueWithEmail();
    if (step === 'password') return void (register ? createAccount() : signInWithPassword());
    if (step === 'verify-sign-up') return void verifySignUp();
    if (step === 'reset-code') return void verifyResetCode();
    return void resetPassword();
  };

  const submitLabel = step === 'email'
    ? 'Continuer par e-mail'
    : step === 'password'
      ? register ? 'Créer mon compte' : 'Se connecter'
      : step === 'reset-password'
        ? 'Enregistrer le mot de passe'
        : 'Valider le code';

  const codeStep = step === 'verify-sign-up' || step === 'reset-code';
  const newPasswordStep = step === 'reset-password' || (step === 'password' && register);

  return (
    <EntryScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {step !== 'email' ? (
            <Pressable accessibilityLabel="Retour" onPress={goBack} hitSlop={12} style={styles.back}>
              <ArrowLeft size={25} color={colors.white} />
            </Pressable>
          ) : null}
          <View style={[styles.brand, { marginTop: height > 850 ? 38 : 16 }]}><EntryBrand size={78} /></View>
          <View style={styles.copy}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
          </View>

          {step === 'email' ? (
            <View style={styles.modeTabs}>
              <Pressable onPress={() => switchMode(true)} style={[styles.modeTab, register && styles.modeTabActive]}>
                <Text style={[styles.modeText, register && styles.modeTextActive]}>Créer un compte</Text>
              </Pressable>
              <Pressable onPress={() => switchMode(false)} style={[styles.modeTab, !register && styles.modeTabActive]}>
                <Text style={[styles.modeText, !register && styles.modeTextActive]}>Se connecter</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.form}>
            {step === 'email' || step === 'password' ? (
              <View style={[styles.inputShell, step === 'password' && styles.emailReadonly]}>
                <Mail size={21} color="#91A49B" />
                <TextInput
                  value={email}
                  onChangeText={(value) => { setEmail(value); setToast(''); }}
                  editable={step === 'email'}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="Adresse e-mail"
                  placeholderTextColor="#879990"
                  style={styles.input}
                  textContentType="emailAddress"
                />
                {step === 'password' ? (
                  <Pressable onPress={goBack} hitSlop={8}><Text style={styles.editEmail}>Modifier</Text></Pressable>
                ) : null}
              </View>
            ) : null}

            {step === 'password' ? (
              <>
                <PasswordField
                  value={password}
                  onChangeText={(value) => { setPassword(value); setToast(''); }}
                  placeholder="Mot de passe"
                  newPassword={register}
                />
                {register ? (
                  <PasswordField
                    value={passwordConfirmation}
                    onChangeText={(value) => { setPasswordConfirmation(value); setToast(''); }}
                    placeholder="Confirmer le mot de passe"
                    newPassword
                  />
                ) : (
                  <Pressable disabled={busy} onPress={() => void requestPasswordReset()} style={styles.forgotPassword}>
                    <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
                  </Pressable>
                )}
              </>
            ) : null}

            {codeStep ? (
              <View style={styles.inputShell}>
                <ShieldCheck size={21} color="#91A49B" />
                <TextInput
                  value={code}
                  onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setToast(''); }}
                  autoFocus
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  placeholder="Code à 6 chiffres"
                  placeholderTextColor="#879990"
                  style={styles.input}
                  textContentType="oneTimeCode"
                />
              </View>
            ) : null}

            {step === 'reset-password' ? (
              <>
                <PasswordField
                  value={password}
                  onChangeText={(value) => { setPassword(value); setToast(''); }}
                  placeholder="Nouveau mot de passe"
                  newPassword
                />
                <PasswordField
                  value={passwordConfirmation}
                  onChangeText={(value) => { setPasswordConfirmation(value); setToast(''); }}
                  placeholder="Confirmer le mot de passe"
                  newPassword
                />
              </>
            ) : null}
          </View>

          {newPasswordStep ? <Text style={styles.passwordHint}>{PASSWORD_MIN_LENGTH} caractères minimum</Text> : null}

          <EntryPrimaryButton label={submitLabel} loading={busyProvider === 'email'} onPress={submit} style={styles.submit} />

          {step === 'email' ? (
            <>
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
            </>
          ) : null}

          {codeStep ? (
            <Pressable disabled={busy} onPress={() => void resendCode()} style={styles.resend}>
              <Text style={styles.resendText}>Renvoyer le code</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {toast ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(140)} style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
          <Pressable onPress={() => setToast('')} hitSlop={10}><X size={15} color="#E8F0EB" /></Pressable>
        </Animated.View>
      ) : null}
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
  form: { marginTop: 14, gap: 10 },
  inputShell: { minHeight: 58, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(106,160,137,.24)', backgroundColor: 'rgba(4,45,35,.68)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  emailReadonly: { backgroundColor: 'rgba(4,39,31,.52)' },
  input: { flex: 1, minHeight: 56, color: colors.white, fontSize: 15 },
  editEmail: { color: colors.lime, fontSize: 12, fontWeight: '600' },
  passwordHint: { color: '#83968C', fontSize: 12, marginTop: 9, marginLeft: 3 },
  forgotPassword: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', paddingHorizontal: 2 },
  forgotPasswordText: { color: '#B2C0BA', fontSize: 12, fontWeight: '500' },
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
  resend: { alignItems: 'center', marginTop: 18, paddingVertical: 12 },
  resendText: { color: colors.lime, fontSize: 13, fontWeight: '600' },
  toast: { position: 'absolute', left: 26, right: 26, bottom: 24, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(160,202,183,.28)', backgroundColor: 'rgba(2,36,28,.96)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 16 },
  toastText: { flex: 1, color: '#E8F0EB', fontSize: 13, fontWeight: '600' },
});
