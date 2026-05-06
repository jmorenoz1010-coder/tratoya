/**
 * ══════════════════════════════════════════════════════
 * TRATOYA · Servicio de Notificaciones Unificado
 * Maneja 3 canales simultáneamente:
 *  1. Push en plataforma (SSE - tiempo real)
 *  2. Notificación en base de datos
 *  3. SMS (Twilio)
 * ══════════════════════════════════════════════════════
 */

const { Notificacion, User } = require('../config/database');
const logger = require('../utils/logger');

// Importaciones lazy para evitar errores si no están configurados
let pushService = null;
let smsService  = null;

const getPush = () => {
  if (!pushService) try { pushService = require('./pushService'); } catch { pushService = null; }
  return pushService;
};
const getSMS = () => {
  if (!smsService) try { smsService = require('./smsService'); } catch { smsService = null; }
  return smsService;
};

/**
 * Notifica a un usuario por los 3 canales (DB + Push SSE + SMS)
 *
 * @param {string}  usuario_id   UUID del usuario destinatario
 * @param {string}  tipo         Tipo de evento (trato_creado, pago_retenido, etc.)
 * @param {object}  payload      { titulo, cuerpo, metadata, sms_evento, sms_params }
 */
async function notificar(usuario_id, tipo, {
  titulo,
  cuerpo,
  metadata = {},
  sms_evento = null,    // clave de PLANTILLAS en smsService
  sms_params = {},      // params para la plantilla SMS
} = {}) {
  if (!usuario_id) return;

  try {
    // 1. Guardar en base de datos
    const notif = await Notificacion.create({ usuario_id, tipo, titulo, cuerpo, metadata });
    logger.info(`[NOTIF:DB] ${tipo} → ${usuario_id}: ${titulo}`);

    // 2. Push SSE en tiempo real
    const push = getPush();
    if (push) {
      push.pushAlUsuario(usuario_id, tipo, {
        notificacion_id: notif.id,
        titulo,
        cuerpo,
        metadata,
        timestamp: new Date().toISOString(),
      });
    }

    // 3. SMS (solo si hay evento SMS definido y el usuario tiene teléfono)
    const sms = getSMS();
    if (sms && sms_evento) {
      try {
        const user = await User.findByPk(usuario_id, { attributes: ['telefono'] });
        if (user?.telefono) {
          await sms.notificarPorSMS(sms_evento, user.telefono, sms_params);
        }
      } catch (smsErr) {
        logger.warn(`[NOTIF:SMS] Error: ${smsErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`[NOTIF] Error al notificar: ${err.message}`);
  }
}

/**
 * Notifica a múltiples usuarios (comprador Y vendedor)
 */
async function notificarAmbos(compradorId, vendedorId, tipo, compradorPayload, vendedorPayload) {
  await Promise.all([
    compradorId ? notificar(compradorId, tipo, compradorPayload) : Promise.resolve(),
    vendedorId  ? notificar(vendedorId,  tipo, vendedorPayload)  : Promise.resolve(),
  ]);
}

module.exports = { notificar, notificarAmbos };
