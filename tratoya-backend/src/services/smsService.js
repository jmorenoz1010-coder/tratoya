/**
 * ══════════════════════════════════════════════════════
 * TRATOYA · Servicio de SMS
 * Proveedor recomendado: TWILIO
 *
 * ¿Por qué Twilio?
 *  - Cobertura Colombia: Claro, Movistar, Tigo, WOM, ETB
 *  - API REST simple, SDK Node.js oficial
 *  - Trial gratuito con $15 USD de crédito
 *  - Panel de logs y entrega en tiempo real
 *  - Precio: ~$0.008 USD/SMS a Colombia
 *
 * Para activar:
 *  1. Registrarse en twilio.com
 *  2. Obtener TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *  3. Comprar un número (+1 o alfanumérico para Colombia)
 *  4. Instalar: npm install twilio
 *  5. Agregar variables en .env
 *
 * Alternativas colombianas:
 *  - SMS Masivos Colombia: smsmassivos.com
 *  - LabsMobile: labsmobile.com (buena API, español)
 *  - Infobip: infobip.com (enterprise, soporte Colombia)
 * ══════════════════════════════════════════════════════
 */

const logger = require('../utils/logger');

// ── Inicializar cliente Twilio (solo si están configuradas las vars) ──
let twilioClient = null;
const initTwilio = () => {
  if (twilioClient) return twilioClient;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.startsWith('ACxxxxxxxx')) {
    logger.warn('[SMS] Twilio no configurado. Agrega TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN al .env');
    return null;
  }
  try {
    const twilio = require('twilio');
    twilioClient = twilio(sid, token);
    logger.info('[SMS] Twilio inicializado correctamente');
    return twilioClient;
  } catch {
    logger.warn('[SMS] Módulo twilio no instalado. Ejecuta: npm install twilio');
    return null;
  }
};

/**
 * Envía un SMS a un número colombiano
 * @param {string} telefono  - Número en formato +573001234567
 * @param {string} mensaje   - Texto del SMS (máx. 160 chars para 1 crédito)
 */
const enviarSMS = async (telefono, mensaje) => {
  if (!telefono) {
    logger.debug('[SMS] No hay teléfono — omitiendo SMS');
    return { ok: false, razon: 'sin_telefono' };
  }

  // Normalizar número colombiano
  let numero = telefono.replace(/\s/g, '').replace(/-/g, '');
  if (!numero.startsWith('+')) {
    numero = numero.startsWith('57') ? `+${numero}` : `+57${numero}`;
  }

  const client = initTwilio();
  if (!client) {
    logger.warn(`[SMS] Simulando envío a ${numero}: ${mensaje}`);
    return { ok: false, razon: 'no_configurado', simulado: true };
  }

  try {
    const msg = await client.messages.create({
      body: `TratoYa: ${mensaje}`,
      from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_SENDER_ID,
      to: numero,
    });
    logger.info(`[SMS] Enviado a ${numero} · SID: ${msg.sid}`);
    return { ok: true, sid: msg.sid };
  } catch (err) {
    logger.error(`[SMS] Error enviando a ${numero}: ${err.message}`);
    return { ok: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════
// PLANTILLAS DE MENSAJES POR ETAPA DEL TRATO
// ═══════════════════════════════════════════════
const PLANTILLAS = {
  trato_creado_vendedor: (codigo, monto) =>
    `Creaste el trato ${codigo} por $${Number(monto).toLocaleString('es-CO')} COP. Comparte el link con el comprador.`,

  trato_aceptado_vendedor: (codigo, comprador) =>
    `${comprador} aceptó tu trato ${codigo}. Espera el pago.`,

  pago_retenido_vendedor: (codigo, monto) =>
    `💰 Pago retenido! $${Number(monto).toLocaleString('es-CO')} COP del trato ${codigo} están seguros. Envía el producto.`,

  pago_retenido_comprador: (codigo) =>
    `✅ Pago registrado en trato ${codigo}. El dinero queda retenido hasta que confirmes la entrega.`,

  guia_registrada_comprador: (codigo, guia, transportadora) =>
    `📦 El vendedor registró envío del trato ${codigo}. Guía: ${guia} (${transportadora}). Confirma cuando recibas.`,

  entrega_confirmada_vendedor: (codigo, monto) =>
    `🎉 Entrega confirmada! $${Number(monto).toLocaleString('es-CO')} COP del trato ${codigo} serán liberados en 24h.`,

  disputa_abierta: (codigo) =>
    `⚖️ Se abrió una disputa en el trato ${codigo}. Revisa la plataforma. Resolveremos en max. 72h.`,

  trato_completado: (codigo) =>
    `✅ Trato ${codigo} completado exitosamente. ¡Gracias por usar TratoYa!`,

  kyc_aprobado: () =>
    `✅ Tu identidad fue verificada en TratoYa. Ya puedes crear tratos sin límites.`,

  kyc_rechazado: () =>
    `❌ Tu verificación de identidad fue rechazada. Ingresa a TratoYa y vuelve a intentarlo.`,
};

/**
 * Envía SMS por evento específico del trato
 * @param {string} evento     - clave de PLANTILLAS
 * @param {string} telefono   - número del destinatario
 * @param {object} params     - parámetros de la plantilla
 */
const notificarPorSMS = async (evento, telefono, params = {}) => {
  const plantilla = PLANTILLAS[evento];
  if (!plantilla) {
    logger.warn(`[SMS] Plantilla '${evento}' no encontrada`);
    return;
  }
  const mensaje = plantilla(...Object.values(params));
  return enviarSMS(telefono, mensaje);
};

module.exports = { enviarSMS, notificarPorSMS, PLANTILLAS };
