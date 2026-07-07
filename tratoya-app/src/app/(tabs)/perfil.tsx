import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radii, Shadow } from '@/constants/brand';
import { useSession } from '@/context/session';

export default function Perfil() {
  const { user, logout } = useSession();
  const initials = `${user?.nombre?.[0] ?? ''}${user?.apellido?.[0] ?? ''}`.toUpperCase() || 'TY';

  const salir = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.body}>
          <Text style={styles.title}>Perfil</Text>

          <View style={[styles.card, Shadow.card]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user?.nombre} {user?.apellido}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              {!!user?.usuario_unico && <Text style={styles.handle}>@{user.usuario_unico}</Text>}
            </View>
          </View>

          <View style={[styles.card, Shadow.card, { flexDirection: 'column', alignItems: 'stretch', gap: 2 }]}>
            <Text style={styles.hint}>
              ✏️ Para editar tus datos, cuentas bancarias y verificación, usa tratoya.com — la edición nativa llega pronto.
            </Text>
          </View>

          <Pressable onPress={salir} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.8 }]}>
            <Text style={styles.logoutTxt}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  body: { padding: 18, gap: 12 },
  title: { fontFamily: 'Syne_800ExtraBold', fontSize: 22, color: Brand.ink, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Brand.card,
    borderRadius: Radii.lg,
    padding: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: Brand.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: Brand.limeBright, fontFamily: 'Manrope_800ExtraBold', fontSize: 18 },
  name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: Brand.ink },
  email: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: Brand.muted, marginTop: 2 },
  handle: { fontFamily: 'Manrope_700Bold', fontSize: 12, color: Brand.green, marginTop: 2 },
  hint: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: Brand.inkSoft, lineHeight: 19 },
  logout: {
    marginTop: 8,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(217,83,79,.4)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutTxt: { color: Brand.red, fontFamily: 'Manrope_800ExtraBold', fontSize: 14 },
});
