import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Gradients, Radii } from '@/constants/brand';
import { useSession } from '@/context/session';

export default function Login() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isRegister = mode === 'register';
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Ingresa tu email y contraseña.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
              <Text style={styles.backTxt}>←</Text>
            </Pressable>

            <Animated.View entering={FadeInDown.duration(450)} style={styles.head}>
              <Text style={styles.title}>{isRegister ? 'Crear cuenta' : 'Bienvenido\nde nuevo'}</Text>
              <Text style={styles.sub}>
                {isRegister
                  ? 'Por ahora crea tu cuenta desde tratoya.com — el registro nativo llega en la próxima versión. Si ya la tienes, inicia sesión.'
                  : 'Ingresa con tu correo y contraseña'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(450).delay(120)} style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@correo.com"
                  placeholderTextColor="rgba(255,255,255,.3)"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>CONTRASEÑA</Text>
                <View style={styles.passRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                    placeholder="Tu contraseña"
                    placeholderTextColor="rgba(255,255,255,.3)"
                    secureTextEntry={!showPass}
                    autoComplete="password"
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={submit}
                  />
                  <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} style={{ paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 16 }}>{showPass ? '🙈' : '👁️'}</Text>
                  </Pressable>
                </View>
              </View>

              {!!error && (
                <Animated.Text entering={FadeInDown.duration(250)} style={styles.error}>
                  {error}
                </Animated.Text>
              )}

              <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
                <LinearGradient colors={Gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
                  {busy ? <ActivityIndicator color={Brand.dark} /> : <Text style={styles.ctaText}>Iniciar sesión →</Text>}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.dark },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingBottom: 30 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  backTxt: { color: '#fff', fontSize: 19 },
  head: { marginTop: 34, marginBottom: 30 },
  title: { color: '#fff', fontFamily: 'Syne_800ExtraBold', fontSize: 34, lineHeight: 40 },
  sub: { color: Brand.onDarkMuted, fontFamily: 'Manrope_600SemiBold', fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  form: { gap: 18 },
  field: { gap: 8 },
  label: { color: Brand.lime, fontFamily: 'Manrope_800ExtraBold', fontSize: 11, letterSpacing: 1.4 },
  input: {
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
    borderRadius: Radii.md,
    color: '#fff',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
    borderRadius: Radii.md,
  },
  error: {
    color: '#ff9d99',
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    backgroundColor: 'rgba(217,83,79,.12)',
    borderWidth: 1,
    borderColor: 'rgba(217,83,79,.3)',
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  cta: { borderRadius: Radii.lg, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  ctaText: { color: Brand.dark, fontFamily: 'Manrope_800ExtraBold', fontSize: 16 },
});
