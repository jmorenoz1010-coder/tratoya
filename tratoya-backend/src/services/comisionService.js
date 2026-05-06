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
  { max: Infinity, fijo: null,  pct: 0.020, label: '2.0% (negociable)' },
];

function calcularComision(monto) {
  const tramo = TRAMOS.find(t => monto <= t.max) || TRAMOS[TRAMOS.length - 1];
  const monto_comision = tramo.fijo !== null
    ? tramo.fijo
    : Math.round(monto * tramo.pct);
  const monto_neto = monto - monto_comision;

  return {
    porcentaje: tramo.pct,
    monto_comision,
    monto_neto,
    descripcion: tramo.fijo !== null
      ? `Tarifa fija $${tramo.fijo.toLocaleString('es-CO')} COP`
      : `Comisión ${tramo.label}`,
  };
}

module.exports = { calcularComision };
