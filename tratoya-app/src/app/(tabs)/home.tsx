import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Brand, Radii, Shadow } from '@/constants/brand';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { ESTADO, fmt, TIPO_ICO } from '@/lib/utils';

type Trato = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  monto: number | string;
  vendedor?: { id: string; nombre: string; apellido: string };
  comprador?: { id: string; nombre: string; apellido: string };
};

const ACTIVOS = ['borrador', 'activo', 'pago_pendiente', 'pago_retenido', 'en_entrega', 'pendiente_confirmacion', 'confirmado'];

export default function Home() {
  const { user } = useSession();
  const [tratos, setTratos] = useState<Trato[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Trato[]>('/tratos?limit=50');
      setTratos(r.data ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const activos = tratos.filter((t) => ACTIVOS.includes(t.estado));
  const completados = tratos.filter((t) => t.estado === 'completado').length;
  const protegido = tratos
    .filter((t) => ['pago_retenido', 'en_entrega', 'pendiente_confirmacion', 'confirmado'].includes(t.estado))
    .reduce((s, t) => s + (Number(String(t.monto).replace(/[^\d.-]/g, '')) || 0), 0);

  const kpis = [
    { l: 'TRATOS ACTIVOS', v: String(activos.length), icon: '⚖️' },
    { l: 'DINERO PROTEGIDO', v: fmt(protegido), icon: '🔒' },
    { l: 'COMPLETADOS', v: String(completados), icon: '✅' },
    { l: 'REPUTACIÓN', v: Number(user?.reputacion ?? 0).toFixed(1), icon: '⭐' },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.lime} />}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={styles.hello}>Hola, {user?.nombre ?? ''} 👋</Text>
            <Text style={styles.helloSub}>Resumen de tu cuenta</Text>
          </Animated.View>

          <View style={styles.kpiGrid}>
            {kpis.map((k, i) => (
              <Animated.View key={k.l} entering={FadeInDown.duration(400).delay(80 + i * 70)} style={[styles.kpi, Shadow.card]}>
                <Text style={styles.kpiIcon}>{k.icon}</Text>
                <Text style={styles.kpiLabel}>{k.l}</Text>
                <Text style={styles.kpiVal} numberOfLines={1} adjustsFontSizeToFit>
                  {k.v}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInDown.duration(400).delay(380)}>
            <Text style={styles.sectionTitle}>Tratos activos</Text>
            {activos.length === 0 ? (
              <View style={[styles.empty, Shadow.card]}>
                <Text style={{ fontSize: 34 }}>🛡️</Text>
                <Text style={styles.emptyT}>Sin tratos activos</Text>
                <Text style={styles.emptyD}>Crea tu primer trato seguro</Text>
              </View>
            ) : (
              activos.map((t) => {
                const cp = t.vendedor?.id === user?.id ? t.comprador : t.vendedor;
                const est = ESTADO[t.estado];
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push({ pathname: '/(tabs)/tratos', params: { open: t.id } })}
                    style={({ pressed }) => [styles.row, Shadow.card, pressed && { transform: [{ scale: 0.985 }] }]}
                  >
                    <View style={styles.rowIcon}>
                      <Text style={{ fontSize: 19 }}>{TIPO_ICO[t.tipo] ?? '📋'}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{t.titulo}</Text>
                      <Text style={styles.rowEstado} numberOfLines={1}>{est?.l ?? t.estado}</Text>
                      <Text style={styles.rowCp} numberOfLines={1}>
                        {cp ? `${cp.nombre} ${cp.apellido}` : 'Esperando contraparte'}
                      </Text>
                    </View>
                    <Text style={styles.rowMonto}>{fmt(t.monto)}</Text>
                  </Pressable>
                );
              })
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 18, paddingBottom: 40, gap: 4 },
  hello: { fontFamily: 'Syne_800ExtraBold', fontSize: 24, color: Brand.ink },
  helloSub: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: Brand.muted, marginTop: 2, marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  kpi: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Brand.card,
    borderRadius: Radii.lg,
    padding: 14,
    gap: 4,
  },
  kpiIcon: { fontSize: 20 },
  kpiLabel: { fontFamily: 'Manrope_800ExtraBold', fontSize: 10, color: Brand.faint, letterSpacing: 0.8 },
  kpiVal: { fontFamily: 'Syne_800ExtraBold', fontSize: 22, color: Brand.ink },
  sectionTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15.5, color: Brand.ink, marginBottom: 10 },
  empty: { backgroundColor: Brand.card, borderRadius: Radii.lg, padding: 30, alignItems: 'center', gap: 6 },
  emptyT: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14.5, color: Brand.ink },
  emptyD: { fontFamily: 'Manrope_600SemiBold', fontSize: 12.5, color: Brand.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderRadius: Radii.lg,
    padding: 13,
    marginBottom: 9,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13.5, color: Brand.ink },
  rowEstado: { fontFamily: 'Manrope_800ExtraBold', fontSize: 10.5, color: Brand.green, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowCp: { fontFamily: 'Manrope_600SemiBold', fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  rowMonto: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13.5, color: Brand.ink },
});
