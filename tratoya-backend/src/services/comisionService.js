/**
 * SERVICIO DE COMISIONES
 * Calcula la comisión de TratoYa según el monto del trato
 */

const TRAMOS = [
  { max: 50000,    fijo: 1500,  pct: 0,     label: 'Tarifa fija' },
  { max: 500000,   fijo: null,  pct: 0.055, label: '5.5%' },
  { max: 2000000,  fijo: null,  pct: 0.045, label: '4.5%' },
  { max: 10000000, fijo: null,  pct: 0.035, label: '3.5%' },
  { max: 50000000, fijo: null,  pct: 0.029, label: '2.9%' },
];

const MONTO_MINIMO_TRATO = 50000;
const MONTO_MAXIMO_AUTOMATICO = 50000000;

function calcularComision(monto, quienPaga = 'comprador') {
  if (!Number.isFinite(monto) || monto < MONTO_MINIMO_TRATO) {
    const err = new Error(`El monto mínimo del trato es $${MONTO_MINIMO_TRATO.toLocaleString('es-CO')} COP`);
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }
  if (monto > MONTO_MAXIMO_AUTOMATICO) {
    const err = new Error('Para tratos superiores a $50.000.000 COP la comisión es negociable. Contacta soporte.');
    err.statusCode = 400;
    err.expose = true;
    throw err;
  }
  const tramo = TRAMOS.find(t => monto <= t.max) || TRAMOS[TRAMOS.length - 1];
  const monto_comision = tramo.fijo !== null
    ? tramo.fijo
    : Math.round(monto * tramo.pct);
  const comprador_paga_comision = quienPaga === 'comprador'
    ? monto_comision
    : quienPaga === 'compartida'
      ? Math.ceil(monto_comision / 2)
      : 0;
  const vendedor_paga_comision = quienPaga === 'vendedor'
    ? monto_comision
    : quienPaga === 'compartida'
      ? Math.floor(monto_comision / 2)
      : 0;
  const total_a_pagar = monto + comprador_paga_comision;
  const monto_neto = monto - vendedor_paga_comision;

  return {
    porcentaje: tramo.pct,
    monto_comision,
    monto_neto,
    total_a_pagar,
    comprador_paga_comision,
    vendedor_paga_comision,
    descripcion: tramo.fijo !== null
      ? `Tarifa fija $${tramo.fijo.toLocaleString('es-CO')} COP`
      : `Comisión ${tramo.label}`,
  };
}

module.exports = { calcularComision, MONTO_MINIMO_TRATO, MONTO_MAXIMO_AUTOMATICO, TRAMOS };
