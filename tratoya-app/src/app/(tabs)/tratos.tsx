import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radii, Shadow } from '@/constants/brand';
import { useSession } from '@/context/session';
import { api } from '@/lib/api';
import { ESTADO, fmt, timeAgo, TIPO_ICO } from '@/lib/utils';

type Trato = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  monto: number | string;
  createdAt?: string;
  codigo?: string;
  vendedor?: { id: string; nombre: string; apellido: string };
  comprador?: { id: string; nombre: string; apellido: string };
};

export default function Tratos() {
  const { user } = useSession();
  const [tratos, setTratos] = useState<Trato[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Trato[]>('/tratos?limit=100');
      setTratos(r.data ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.lime} />}
        >
          <Text style={styles.title}>Mis Tratos</Text>
          {tratos.length === 0 ? (
            <View style={[styles.empty, Shadow.card]}>
              <Text style={{ fontSize: 34 }}>🤝</Text>
              <Text style={styles.emptyT}>Aún no tienes tratos</Text>
            </View>
          ) : (
            tratos.map((t, i) => {
              const cp = t.vendedor?.id === user?.id ? t.comprador : t.vendedor;
              return (
                <Animated.View key={t.id} entering={FadeInDown.duration(350).delay(Math.min(i * 50, 400))} style={[styles.row, Shadow.card]}>
                  <View style={styles.rowIcon}>
                    <Text style={{ fontSize: 19 }}>{TIPO_ICO[t.tipo] ?? '📋'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{t.titulo}</Text>
                    <Text style={styles.rowEstado} numberOfLines={1}>{ESTADO[t.estado]?.l ?? t.estado}</Text>
                    <Text style={styles.rowCp} numberOfLines={1}>
                      {cp ? `${cp.nombre} ${cp.apellido}` : 'Sin contraparte'}
                      {t.createdAt ? ` · ${timeAgo(t.createdAt)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.rowMonto}>{fmt(t.monto)}</Text>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 18, paddingBottom: 40 },
  title: { fontFamily: 'Syne_800ExtraBold', fontSize: 22, color: Brand.ink, marginBottom: 14 },
  empty: { backgroundColor: Brand.card, borderRadius: Radii.lg, padding: 30, alignItems: 'center', gap: 6 },
  emptyT: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14.5, color: Brand.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderRadius: Radii.lg,
    padding: 13,
    marginBottom: 9,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: Brand.cream, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'Manrope_700Bold', fontSize: 13.5, color: Brand.ink },
  rowEstado: { fontFamily: 'Manrope_800ExtraBold', fontSize: 10.5, color: Brand.green, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowCp: { fontFamily: 'Manrope_600SemiBold', fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  rowMonto: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13.5, color: Brand.ink },
});
