/**
 * SERVICIO DE COMISIONES
 * Calcula la comisión de TratoYa según el monto del trato
 */

const TRAMOS = [
  { max: 25000000, fijo: null, pct: 0.045, label: '4.5%' },
];

const MONTO_MINIMO_TRATO = 50000;
const MONTO_MAXIMO_AUTOMATICO = 25000000;
const GMF_RATE = 0.004;
const GMF_MODES = new Set(['salida', 'entrada', 'ambos', 'ninguno']);

function getGmfMode(mode = process.env.COMMISSION_GMF_MODE || 'salida') {
  const normalized = String(mode || '').trim().toLowerCase();
  return GMF_MODES.has(normalized) ? normalized : 'salida';
}

function calcularComisionTratoYa(monto) {
  const tramo = TRAMOS.find(t => monto <= t.max) || TRAMOS[TRAMOS.length - 1];
  const monto_comision = tramo.fijo !== null
    ? tramo.fijo
    : Math.round(monto * tramo.pct);
  return { tramo, monto_comision };
}

function calcularCostoEpayco(totalCobrado) {
  return 0;
}

function calcularCostoGmf(totalCobrado, montoDesembolso, mode = getGmfMode()) {
  const gmfMode = getGmfMode(mode);
  const entrada = ['entrada', 'ambos'].includes(gmfMode) ? Math.ceil(Math.max(totalCobrado, 0) * GMF_RATE) : 0;
  const salida = ['salida', 'ambos'].includes(gmfMode) ? Math.ceil(Math.max(montoDesembolso, 0) * GMF_RATE) : 0;
  return {
    total: entrada + salida,
    entrada,
    salida,
    mode: gmfMode,
  };
}

function calcularBuyerShare(monto, totalComision, quienPaga) {
  if (quienPaga === 'comprador') return totalComision;
  if (quienPaga === 'compartida') return Math.ceil(totalComision / 2);
  return 0;
}

function calcularComision(monto, quienPaga = 'comprador') {
  if (!Number.isFinite(monto) || monto < MONTO_MINIMO_TRATO) {
    const err = new Error(`El monto mínimo del trato es $${MONTO_MINIMO_TRATO.toLocaleString('es-CO')} COP`);
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }
  if (monto > MONTO_MAXIMO_AUTOMATICO) {
    const err = new Error('Para tratos superiores a $25.000.000 COP la comisión es negociable. Contacta soporte.');
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }
  const { tramo, monto_comision: comision_tratoya } = calcularComisionTratoYa(monto);
  const gmfMode = getGmfMode();
  let total_comision = comision_tratoya;
  let costo_epayco = 0;
  let costo_gmf = 0;
  let gmf_entrada = 0;
  let gmf_salida = 0;
  for (let i = 0; i < 12; i += 1) {
    const compradorShare = calcularBuyerShare(monto, total_comision, quienPaga);
    const vendedorShare = quienPaga === 'vendedor'
      ? total_comision
      : quienPaga === 'compartida'
        ? Math.floor(total_comision / 2)
        : 0;
    const totalCobrado = monto + compradorShare;
    const montoDesembolso = monto - vendedorShare;
    const nextCostoEpayco = calcularCostoEpayco(totalCobrado);
    const nextGmf = calcularCostoGmf(totalCobrado, montoDesembolso, gmfMode);
    const nextTotalComision = comision_tratoya + nextCostoEpayco + nextGmf.total;
    if (nextTotalComision === total_comision) {
      costo_epayco = nextCostoEpayco;
      costo_gmf = nextGmf.total;
      gmf_entrada = nextGmf.entrada;
      gmf_salida = nextGmf.salida;
      break;
    }
    total_comision = nextTotalComision;
    costo_epayco = nextCostoEpayco;
    costo_gmf = nextGmf.total;
    gmf_entrada = nextGmf.entrada;
    gmf_salida = nextGmf.salida;
  }
  const comprador_paga_comision = quienPaga === 'comprador'
    ? total_comision
    : quienPaga === 'compartida'
      ? Math.ceil(total_comision / 2)
      : 0;
  const vendedor_paga_comision = quienPaga === 'vendedor'
    ? total_comision
    : quienPaga === 'compartida'
      ? Math.floor(total_comision / 2)
      : 0;
  const total_a_pagar = monto + comprador_paga_comision;
  const monto_neto = monto - vendedor_paga_comision;

  return {
    porcentaje: tramo.pct,
    monto_comision: total_comision,
    comision_tratoya,
    costo_epayco,
    costo_gmf,
    gmf_entrada,
    gmf_salida,
    gmf_mode: gmfMode,
    monto_neto,
    total_a_pagar,
    comprador_paga_comision,
    vendedor_paga_comision,
    descripcion: tramo.fijo !== null
      ? `Tarifa fija $${tramo.fijo.toLocaleString('es-CO')} COP`
      : `Comisión ${tramo.label} + IMP`,
  };
}

module.exports = {
  calcularComision,
  calcularCostoEpayco,
  calcularCostoGmf,
  getGmfMode,
  GMF_RATE,
  MONTO_MINIMO_TRATO,
  MONTO_MAXIMO_AUTOMATICO,
  TRAMOS,
};
