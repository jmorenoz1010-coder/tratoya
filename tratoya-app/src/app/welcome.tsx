import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Gradients, Radii } from '@/constants/brand';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Orbe de fondo con respiración suave (ambiente premium). */
function AmbientOrb() {
  const scale = useSharedValue(1);
  scale.value = withRepeat(
    withSequence(withTiming(1.15, { duration: 3600 }), withTiming(1, { duration: 3600 })),
    -1,
  );
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.orb, style]} />;
}

export default function Welcome() {
  return (
    <View style={styles.root}>
      <AmbientOrb />
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Animated.Text entering={FadeInDown.duration(500).delay(100)} style={styles.kicker}>
            INTERMEDIARIO DE PAGOS
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(600).delay(220)} style={styles.mega}>
            Compra y vende{'\n'}
            <Text style={styles.megaAccent}>sin miedo.</Text>
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(600).delay(360)} style={styles.sub}>
            Protegemos tu dinero hasta que ambas partes cumplan. Tu pago seguro hasta el final.
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInUp.duration(600).delay(500)} style={styles.ctaZone}>
          <AnimatedPressable
            onPress={() => router.push('/login?mode=register')}
            style={({ pressed }: { pressed: boolean }) => [styles.ctaWrap, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient colors={Gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <Text style={styles.ctaText}>Empezar gratis →</Text>
            </LinearGradient>
          </AnimatedPressable>

          <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]}>
            <Text style={styles.ghostText}>Ya tengo cuenta</Text>
          </Pressable>

          <View style={styles.trustRow}>
            {['🔒 Dinero protegido', '⚖️ Mediación real', '⚡ Pagos rápidos'].map((t) => (
              <Text key={t} style={styles.trustPill}>{t}</Text>
            ))}
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.dark, overflow: 'hidden' },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 26 },
  orb: {
    position: 'absolute',
    top: -140,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: 'rgba(168,196,0,.14)',
  },
  hero: { marginTop: 110 },
  kicker: {
    color: Brand.lime,
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    letterSpacing: 2.4,
    marginBottom: 14,
  },
  mega: {
    color: '#fff',
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 44,
    lineHeight: 50,
  },
  megaAccent: { color: Brand.limeBright },
  sub: {
    color: Brand.onDarkMuted,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15.5,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 320,
  },
  ctaZone: { marginBottom: 26, gap: 14 },
  ctaWrap: { borderRadius: Radii.lg, shadowColor: Brand.lime, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  cta: { borderRadius: Radii.lg, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: Brand.dark, fontFamily: 'Manrope_800ExtraBold', fontSize: 16.5 },
  ghost: { alignItems: 'center', paddingVertical: 13, borderRadius: Radii.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)' },
  ghostText: { color: Brand.onDark, fontFamily: 'Manrope_700Bold', fontSize: 14.5 },
  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  trustPill: {
    color: Brand.onDarkMuted,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11.5,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
