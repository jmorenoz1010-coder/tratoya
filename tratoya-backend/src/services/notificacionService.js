/**
 * ══════════════════════════════════════════════════════════════
 * TRATOYA · Servicio de Notificaciones Unificado
 * ──────────────────────────────────────────────────────────────
 * Maneja 4 canales simultáneamente:
 *  1. Push en plataforma (SSE - tiempo real, sin deps externas)
 *  2. Notificación en base de datos
 *  3. Email (Brevo/SMTP via Nodemailer)
 *  4. WhatsApp (Meta Cloud API)
 *
 * Uso en rutas:
 *   await notificar(userId, 'evento', {
 *     titulo:           'Título push',
 *     cuerpo:           'Cuerpo push',
 *     metadata:         {},
 *     // Email (opcional):
 *     email_template:   'nombre_template',   // clave de emailService.TEMPLATES
 *     email_data:       { nombre, codigo },   // datos para el template
 *     // WhatsApp (opcional):
 *     wa_evento:        'nombre_evento',      // clave de whatsappService.MENSAJES
 *     wa_params:        { nombre, codigo },   // datos para el mensaje
 *     // SMS legacy (opcional):
 *     sms_evento:       'nombre_evento',
 *     sms_params:       {},
 *   });
 * ══════════════════════════════════════════════════════════════
 */

const { Notificacion, User } = require('../config/database');
const logger = require('../utils/logger');

// ── Importaciones lazy (no crashean si no están configurados) ──
let _push = null, _sms = null, _email = null, _wa = null;
const getPush  = () => { if (!_push)  try { _push  = require('./pushService');      } catch {} return _push;  };
const getSMS   = () => { if (!_sms)   try { _sms   = require('./smsService');       } catch {} return _sms;   };
const getEmail = () => { if (!_email) try { _email = require('./emailService');     } catch {} return _email; };
const getWA    = () => { if (!_wa)    try { _wa    = require('./whatsappService');  } catch {} return _wa;    };

/**
 * Notifica a un usuario por todos los canales configurados
 *
 * @param {string}  usuario_id        UUID del usuario destinatario
 * @param {string}  tipo              Tipo de evento (trato_creado, pago_retenido, etc.)
 * @param {object}  payload
 * @param {string}  payload.titulo    Título para notif push
 * @param {string}  payload.cuerpo    Cuerpo para notif push
 * @param {object}  [payload.metadata]
 * @param {string}  [payload.email_template]   Template de email a usar
 * @param {object}  [payload.email_data]        Datos para el template email
 * @param {string}  [payload.wa_evento]         Evento de WhatsApp a enviar
 * @param {object}  [payload.wa_params]         Params para el mensaje WhatsApp
 * @param {string}  [payload.sms_evento]        Evento SMS legacy (Twilio)
 * @param {object}  [payload.sms_params]        Params para el SMS
 */
async function notificar(usuario_id, tipo, {
  titulo,
  cuerpo,
  metadata     = {},
  email_template = null,
  email_data     = {},
  wa_evento      = null,
  wa_params      = {},
  sms_evento     = null,
  sms_params     = {},
} = {}) {
  if (!usuario_id) return;

  try {
    // ── 1. Guardar en base de datos ──────────────────────────
    const notif = await Notificacion.create({ usuario_id, tipo, titulo, cuerpo, metadata });
    logger.info(`[NOTIF:DB] ${tipo} → ${usuario_id}: ${titulo}`);

    // ── 2. Push SSE en tiempo real ───────────────────────────
    const push = getPush();
    if (push) {
      push.pushAlUsuario(usuario_id, tipo, {
        notificacion_id: notif.id,
        titulo, cuerpo, metadata,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Obtener datos del usuario (para email, WA y SMS) ─────
    const needsUser = email_template || wa_evento || sms_evento;
    let user = null;
    if (needsUser) {
      try {
        user = await User.findByPk(usuario_id, {
          attributes: ['id', 'nombre', 'apellido', 'email', 'telefono'],
        });
      } catch (err) {
        logger.warn(`[NOTIF] No se pudo obtener usuario ${usuario_id}: ${err.message}`);
      }
    }

    // ── 3. Email ─────────────────────────────────────────────
    if (email_template && user?.email) {
      const emailSvc = getEmail();
      if (emailSvc) {
        // Magic-login: el botón del correo inicia sesión y abre el trato directo.
        let cta_url;
        try {
          const { magicLink } = require('../utils/magicLink');
          const next = metadata?.trato_id ? `/?page=detalle&trato=${metadata.trato_id}` : '/';
          cta_url = magicLink(user.id, next);
        } catch { /* sin magic link si falla */ }
        const data = {
          nombre: user.nombre || 'Usuario',
          ...email_data,
          ...(cta_url ? { cta_url } : {}),
        };
        emailSvc.sendEmail(user.email, email_template, data).catch(err =>
          logger.warn(`[NOTIF:EMAIL] Error: ${err.message}`)
        );
      }
    }

    // ── 4. WhatsApp ──────────────────────────────────────────
    if (wa_evento && user?.telefono) {
      const waSvc = getWA();
      if (waSvc) {
        const params = {
          nombre: user.nombre || 'Usuario',
          ...wa_params,
        };
        waSvc.notificarWA(wa_evento, user.telefono, params).catch(err =>
          logger.warn(`[NOTIF:WA] Error: ${err.message}`)
        );
      }
    }

    // ── 5. SMS legacy (Twilio) ───────────────────────────────
    if (sms_evento && user?.telefono) {
      const smsSvc = getSMS();
      if (smsSvc) {
        smsSvc.notificarPorSMS(sms_evento, user.telefono, sms_params).catch(err =>
          logger.warn(`[NOTIF:SMS] Error: ${err.message}`)
        );
      }
    }

  } catch (err) {
    logger.error(`[NOTIF] Error al notificar usuario ${usuario_id}: ${err.message}`);
  }
}

/**
 * Notifica a múltiples usuarios (comprador Y vendedor) simultáneamente
 */
async function notificarAmbos(compradorId, vendedorId, tipo, compradorPayload, vendedorPayload) {
  await Promise.all([
    compradorId ? notificar(compradorId, tipo, compradorPayload) : Promise.resolve(),
    vendedorId  ? notificar(vendedorId,  tipo, vendedorPayload)  : Promise.resolve(),
  ]);
}

/**
 * Notifica a AMBAS partes el estado actual del trato + su próximo paso.
 * Usa un único evento WhatsApp ('estado_trato') que se enruta por un solo
 * template (tratoya_estado_trato). Llamar después de cada cambio de estado.
 *
 * @param {object} trato  Instancia/objeto del trato (debe traer estado, codigo, comprador_id, vendedor_id)
 */
async function notificarEstadoTrato(trato) {
  if (!trato) return;
  const { estadoLabel, pasoSiguiente } = require('../utils/tratoEstado');
  const estado = estadoLabel(trato.estado);
  const codigo = trato.codigo || 'tu trato';
  const partes = [
    { id: trato.comprador_id, rol: 'comprador' },
    { id: trato.vendedor_id, rol: 'vendedor' },
  ];
  await Promise.all(partes.map(({ id, rol }) => {
    if (!id) return Promise.resolve();
    const paso = pasoSiguiente(trato.estado, rol);
    return notificar(id, 'estado_trato', {
      titulo: `Tu trato ${codigo}: ${estado}`,
      cuerpo: `Próximo paso: ${paso}`,
      metadata: { trato_id: trato.id, estado: trato.estado },
      email_template: 'estado_trato',
      email_data: { codigo, estado, paso },
      wa_evento: 'estado_trato',
      wa_params: { codigo, estado, paso },
    }).catch(() => {});
  }));
}

module.exports = { notificar, notificarAmbos, notificarEstadoTrato };
