/** Utilidades compartidas (espejo ligero de la web). */

/** Formatea montos en COP: 1368892 → "$ 1.368.892" */
export const fmt = (v: unknown): string => {
  const n = Number(String(v ?? 0).replace(/[^\d.-]/g, '')) || 0;
  return `$ ${Math.round(n).toLocaleString('es-CO')}`;
};

export const ESTADO: Record<string, { l: string; tone: 'gn' | 'or' | 'rd' | 'bg' }> = {
  borrador: { l: 'Esperando aceptación', tone: 'bg' },
  activo: { l: 'Esperando pago del comprador', tone: 'or' },
  pago_pendiente: { l: 'Verificando pago', tone: 'or' },
  pago_retenido: { l: 'Pago protegido · pendiente de entrega', tone: 'gn' },
  en_entrega: { l: 'En entrega', tone: 'gn' },
  pendiente_confirmacion: { l: 'Esperando confirmación', tone: 'or' },
  confirmado: { l: 'Liberando pago', tone: 'gn' },
  completado: { l: 'Completado', tone: 'gn' },
  cancelado: { l: 'Cancelado', tone: 'rd' },
  disputado: { l: 'En disputa', tone: 'rd' },
  expirado: { l: 'Expirado', tone: 'bg' },
};

/** Orden real del flujo para el stepper */
export const FLOW_ORDER = [
  'borrador',
  'activo',
  'pago_pendiente',
  'pago_retenido',
  'en_entrega',
  'pendiente_confirmacion',
  'confirmado',
  'completado',
] as const;

export const TIPO_ICO: Record<string, string> = {
  producto: '📦',
  servicio: '🛠️',
  reserva: '📅',
  vehiculo: '🚗',
};

export const timeAgo = (d: string | Date): string => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  return `hace ${days} d`;
};
