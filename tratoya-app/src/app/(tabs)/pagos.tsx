import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radii, Shadow } from '@/constants/brand';

export default function Pagos() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.body}>
          <Text style={styles.title}>Pagos</Text>
          <View style={[styles.card, Shadow.card]}>
            <Text style={{ fontSize: 34 }}>💰</Text>
            <Text style={styles.cardT}>Muy pronto en la app</Text>
            <Text style={styles.cardD}>
              El historial de pagos llega en la próxima versión. Mientras tanto puedes verlo en tratoya.com
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  body: { padding: 18 },
  title: { fontFamily: 'Syne_800ExtraBold', fontSize: 22, color: Brand.ink, marginBottom: 14 },
  card: { backgroundColor: Brand.card, borderRadius: Radii.lg, padding: 30, alignItems: 'center', gap: 8 },
  cardT: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: Brand.ink },
  cardD: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: Brand.muted, textAlign: 'center', lineHeight: 19 },
});
