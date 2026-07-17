import { router } from 'expo-router';
import { Apple, ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { EntryBrand, EntryPrimaryButton, EntryScreen } from '@/components/entry-ui';
import { useAppStore } from '@/store/app-store';
import { colors } from '@/theme/tokens';

export default function AuthScreen() {
  const { signInDemo, pendingUrl } = useAppStore();
  const { height } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [register, setRegister] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const finish = (method: 'apple' | 'email') => {
    signInDemo(method);
    router.replace(pendingUrl ? '/handle-share' : '/(tabs)');
  };

  const submit = () => {
    if (!email.includes('@')) return setToast('Entre une adresse e-mail valide');
    if (password.length < 6) return setToast('Le mot de passe doit contenir 6 caractères');
    finish('email');
  };

  return (
    <EntryScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}><ArrowLeft size={25} color={colors.white} /></Pressable>
          <View style={[styles.brand, { marginTop: height > 850 ? 52 : 23 }]}><EntryBrand size={88} /></View>
          <View style={styles.copy}>
            <Text style={styles.title}>{register ? 'Crée ton compte' : 'Connecte-toi'}</Text>
            <Text style={styles.subtitle}>{register ? 'Commence à analyser tes annonces.' : 'Accède à ton espace DealUp.'}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputShell}><Mail size={21} color="#91A49B" /><TextInput value={email} onChangeText={(value) => { setEmail(value); setToast(''); }} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Adresse e-mail" placeholderTextColor="#879990" style={styles.input} /></View>
            <View style={styles.inputShell}><LockKeyhole size={21} color="#91A49B" /><TextInput value={password} onChangeText={(value) => { setPassword(value); setToast(''); }} secureTextEntry={!passwordVisible} autoComplete={register ? 'new-password' : 'current-password'} placeholder="Mot de passe" placeholderTextColor="#879990" style={styles.input} /><Pressable onPress={() => setPasswordVisible((value) => !value)} hitSlop={10}>{passwordVisible ? <EyeOff size={21} color="#91A49B" /> : <Eye size={21} color="#91A49B" />}</Pressable></View>
          </View>

          {!register ? <Pressable onPress={() => setToast('Un lien de réinitialisation vient d’être envoyé')} style={styles.forgot}><Text style={styles.forgotText}>Mot de passe oublié ?</Text></Pressable> : null}
          <EntryPrimaryButton label={register ? 'Créer mon compte' : 'Se connecter'} icon={<ArrowRight size={21} color={colors.brand900} />} onPress={submit} style={styles.submit} />

          <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.or}>ou</Text><View style={styles.dividerLine} /></View>
          <Pressable onPress={() => finish('apple')} style={({ pressed }) => [styles.apple, pressed && styles.pressed]}><Apple size={23} color={colors.white} fill={colors.white} /><Text style={styles.appleText}>Continuer avec Apple</Text></Pressable>

          <Pressable onPress={() => { setRegister((value) => !value); setToast(''); }} style={styles.switchMode}>
            <Text style={styles.switchText}>{register ? 'Déjà un compte ?  ' : 'Pas encore de compte ?  '}<Text style={styles.switchLink}>{register ? 'Se connecter' : 'Créer un compte'}</Text></Text>
          </Pressable>
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
  copy: { alignItems: 'center', marginTop: 45 },
  title: { color: colors.white, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -.6 },
  subtitle: { color: '#A7B5AE', fontSize: 16, marginTop: 8 },
  form: { gap: 10, marginTop: 36 },
  inputShell: { minHeight: 60, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(106,160,137,.24)', backgroundColor: 'rgba(4,45,35,.68)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  input: { flex: 1, minHeight: 58, color: colors.white, fontSize: 15 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 14, paddingLeft: 18 },
  forgotText: { color: '#A7B5AE', fontSize: 13 },
  submit: { marginTop: 25 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 17, marginTop: 27 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(137,172,157,.22)' },
  or: { color: '#D6DFDA', fontSize: 13 },
  apple: { minHeight: 60, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(114,166,143,.30)', backgroundColor: 'rgba(1,37,29,.55)', marginTop: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  appleText: { color: colors.white, fontSize: 15, fontWeight: '500' },
  pressed: { opacity: .7, transform: [{ scale: .987 }] },
  switchMode: { alignItems: 'center', marginTop: 31, paddingVertical: 10 },
  switchText: { color: '#ACBAB3', fontSize: 13 },
  switchLink: { color: colors.lime, fontWeight: '600' },
  toast: { position: 'absolute', left: 26, right: 26, bottom: 24, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(160,202,183,.28)', backgroundColor: 'rgba(2,36,28,.96)', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 16 },
  toastText: { flex: 1, color: '#E8F0EB', fontSize: 13, fontWeight: '600' },
});
