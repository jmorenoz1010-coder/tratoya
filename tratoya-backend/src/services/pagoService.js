const crypto = require('crypto');
const logger = require('../utils/logger');

const WOMPI_BASE = process.env.WOMPI_BASE_URL || 'https://sandbox.wompi.co/v1';

/**
 * Genera los parámetros para abrir el widget de pago de Wompi
 */
async function crearOrdenWompi(trato) {
  const referencia = `${trato.codigo}-${Date.now()}`;
  const amountInCents = Math.round(parseFloat(trato.monto) * 100);
  const currency = 'COP';
  const publicKey = process.env.WOMPI_PUBLIC_KEY || '';
  const integrityKey = process.env.WOMPI_INTEGRITY_KEY || '';
  const demoMode = !publicKey || publicKey.includes('XXXX') || !integrityKey || integrityKey.includes('XXXX');

  // Hash de integridad requerido por Wompi
  const integridadStr = `${referencia}${amountInCents}${currency}${integrityKey}`;
  const signature = crypto.createHash('sha256').update(integridadStr).digest('hex');

  const checkoutParams = new URLSearchParams({
    'public-key': publicKey,
    currency,
    'amount-in-cents': String(amountInCents),
    reference: referencia,
    'signature:integrity': signature,
    'redirect-url': `${process.env.FRONTEND_URL}/pagos/respuesta`,
  });

  return {
    publicKey,
    currency,
    amountInCents,
    reference: referencia,
    signature,
    redirectUrl: `${process.env.FRONTEND_URL}/pagos/respuesta`,
    checkoutUrl: `https://checkout.wompi.co/p/?${checkoutParams.toString()}`,
    demoMode,
    metadata: {
      trato_id: trato.id,
      codigo: trato.codigo,
    },
  };
}

async function registrarPagoAprobado({ trato, reference, transactionId, amountInCents, payload = {}, metodoPago = null }) {
  const { Pago } = require('../config/database');
  const monto = amountInCents ? amountInCents / 100 : parseFloat(trato.monto || 0);
  const metodoMap = {
    CARD: 'tarjeta_credito',
    CREDIT_CARD: 'tarjeta_credito',
    DEBIT_CARD: 'tarjeta_debito',
    PSE: 'pse',
    NEQUI: 'nequi',
    DAVIPLATA: 'daviplata',
    BANCOLOMBIA_TRANSFER: 'bancolombia',
  };
  const metodoNormalizado = metodoMap[String(metodoPago || '').toUpperCase()] || metodoPago || null;

  const pago = await Pago.findOne({
    where: {
      trato_id: trato.id,
      tipo: 'retencion',
      pasarela: 'wompi',
      pasarela_ref: reference,
    },
    order: [['createdAt', 'DESC']],
  });

  if (pago) {
    await pago.update({
      usuario_id: trato.comprador_id,
      monto,
      pasarela_ref: transactionId || reference,
      pasarela_estado: 'APPROVED',
      metodo_pago: metodoNormalizado || pago.metodo_pago,
      estado: 'aprobado',
      fecha_aprobacion: new Date(),
      webhook_payload: payload,
      metadata: { ...(pago.metadata || {}), reference, transactionId },
    });
  } else {
    await Pago.create({
      trato_id: trato.id,
      usuario_id: trato.comprador_id,
      tipo: 'retencion',
      monto,
      pasarela: 'wompi',
      pasarela_ref: transactionId || reference,
      pasarela_estado: 'APPROVED',
      metodo_pago: metodoNormalizado,
      estado: 'aprobado',
      fecha_aprobacion: new Date(),
      webhook_payload: payload,
      metadata: { reference, transactionId },
    });
  }

  if (trato.estado !== 'pago_retenido') {
    await trato.update({ estado: 'pago_retenido', fecha_pago: new Date() });
  }
}

/**
 * Verifica el estado de una transacción Wompi
 */
async function verificarTransaccionWompi(transaccion_id) {
  const axios = require('axios');
  const response = await axios.get(`${WOMPI_BASE}/transactions/${transaccion_id}`, {
    headers: { Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}` }
  });
  return response.data.data;
}

/**
 * Libera el pago al vendedor cuando el comprador confirma
 */
async function liberarPago(trato_id) {
  const { Trato, Pago, User } = require('../config/database');
  const { notificar } = require('./notificacionService');

  const trato = await Trato.findByPk(trato_id, {
    include: [{ model: User, as: 'vendedor' }]
  });

  if (!trato || trato.estado !== 'confirmado') {
    logger.warn(`[PAGO] Trato ${trato_id} no puede liberarse (estado: ${trato?.estado})`);
    return;
  }

  try {
    await trato.update({ estado: 'completado', fecha_liberacion: new Date() });

    await Pago.create({
      trato_id,
      usuario_id: trato.vendedor_id,
      tipo: 'liberacion',
      monto: trato.monto_neto,
      pasarela: 'transferencia',
      estado: 'aprobado',
      fecha_aprobacion: new Date(),
    });

    for (const userId of [trato.comprador_id, trato.vendedor_id].filter(Boolean)) {
      const usuario = await User.findByPk(userId);
      if (!usuario) continue;
      const total = Number(usuario.total_tratos || 0) + 1;
      const exitosos = Number(usuario.tratos_exitosos || 0) + 1;
      const reputacion = Math.min(5, 3.6 + Math.min(exitosos, 20) * 0.07 + Math.max(0, exitosos - 20) * 0.015);
      await usuario.update({ total_tratos: total, tratos_exitosos: exitosos, reputacion: reputacion.toFixed(2) });
    }

    await notificar(trato.vendedor_id, 'pago_liberado', {
      titulo: '💰 ¡Tu pago fue liberado!',
      cuerpo: `Recibirás $${parseFloat(trato.monto_neto).toLocaleString('es-CO')} COP en tu cuenta registrada.`,
      metadata: { trato_id, monto: trato.monto_neto },
    });

    await notificar(trato.comprador_id, 'trato_completado', {
      titulo: '✅ Trato completado',
      cuerpo: `El trato "${trato.titulo}" fue completado. ¡Deja tu reseña!`,
      metadata: { trato_id },
    });

    logger.info(`[PAGO] Liberado $${trato.monto_neto} → trato ${trato.codigo}`);
  } catch (err) {
    logger.error(`[PAGO] Error liberando trato ${trato_id}: ${err.message}`);
    await trato.update({ estado: 'confirmado' });
    throw err;
  }
}

module.exports = { crearOrdenWompi, verificarTransaccionWompi, registrarPagoAprobado, liberarPago };
