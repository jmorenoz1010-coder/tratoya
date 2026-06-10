/**
 * ══════════════════════════════════════════════════════════════
 * TRATOYA · Servicio de WhatsApp — Meta Cloud API (oficial)
 * ──────────────────────────────────────────────────────────────
 * Tier gratuito: 1,000 conversaciones/mes sin costo
 * Colombia: 92% de penetración WhatsApp → mejor que SMS
 *
 * SETUP (10 minutos):
 *  1. Crea app en developers.facebook.com → WhatsApp → Getting Started
 *  2. Copia Phone Number ID y Temporary Access Token
 *  3. Para producción: genera un token permanente con una System User
 *  4. Agrega al .env:
 *       WA_PHONE_NUMBER_ID=  (de la app de Meta)
 *       WA_ACCESS_TOKEN=     (token de Meta)
 *       WA_VERIFY_TOKEN=     (string aleatorio para el webhook)
 *
 * Para pruebas inmediatas (SANDBOX):
 *  - El número de prueba de Meta funciona sin aprobar templates
 *  - Solo puedes enviar a números verificados en la sandbox
 *  - Para producción necesitas aprobar templates en Meta Business Manager
 *
 * Tipos de mensaje implementados:
 *  - TEXT   → dentro de ventana 24h (gratis, sin template)
 *  - TEMPLATE → fuera de 24h (requiere template aprobado)
 * ══════════════════════════════════════════════════════════════
 */

const logger = require('../utils/logger');

const WA_API = 'https://graph.facebook.com/v21.0';
const APP_URL = () => process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'https://tratoya.com';

/* ── Config ─────────────────────────────────────────────────── */
function getConfig() {
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token   = process.env.WA_ACCESS_TOKEN;
  if (!phoneId || !token || phoneId === 'TU_PHONE_NUMBER_ID') {
    return null;
  }
  return { phoneId, token };
}

/* ── Normalizar número colombiano ──────────────────────────── */
function normalizarTelefono(tel) {
  if (!tel) return null;
  let n = String(tel).replace(/[\s\-().]/g, '');
  if (!n.startsWith('+')) {
    n = n.startsWith('57') ? `+${n}` : `+57${n}`;
  }
  return n.replace('+', ''); // WhatsApp API espera sin +
}

/* ── Envío de mensaje de texto (dentro de ventana 24h) ───────── */
async function enviarTexto(telefono, texto) {
  const cfg = getConfig();
  const numero = normalizarTelefono(telefono);

  if (!numero) {
    logger.debug('[WA] Sin número de teléfono — omitiendo WhatsApp');
    return { ok: false, razon: 'sin_telefono' };
  }

  if (!cfg) {
    logger.warn(`[WA-STUB] → ${numero}: ${texto.slice(0, 80)}...`);
    return { ok: false, razon: 'no_configurado', simulado: true };
  }

  try {
    const resp = await fetch(`${WA_API}/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'text',
        text: { body: texto, preview_url: false },
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      logger.error(`[WA] Error ${resp.status} → ${numero}: ${JSON.stringify(data.error)}`);
      return { ok: false, error: data.error };
    }

    logger.info(`[WA] ✓ Mensaje enviado a ${numero} · ID: ${data.messages?.[0]?.id}`);
    return { ok: true, messageId: data.messages?.[0]?.id };

  } catch (err) {
    logger.error(`[WA] Excepción → ${numero}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/* ── Envío via template aprobado (fuera de ventana 24h) ─────── */
async function enviarTemplate(telefono, templateName, lang = 'es_CO', components = []) {
  const cfg = getConfig();
  const numero = normalizarTelefono(telefono);

  if (!numero || !cfg) {
    logger.debug(`[WA] Template "${templateName}" omitido — sin config o teléfono`);
    return { ok: false };
  }

  try {
    const resp = await fetch(`${WA_API}/${cfg.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: { name: templateName, language: { code: lang }, components },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      logger.error(`[WA] Template error ${resp.status}: ${JSON.stringify(data.error)}`);
      return { ok: false, error: data.error };
    }
    logger.info(`[WA] ✓ Template "${templateName}" enviado a ${numero}`);
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    logger.error(`[WA] Template excepción: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

const TEMPLATE_PARAM_KEYS = {
  trato_creado_contraparte: ['nombre', 'titulo', 'monto', 'codigo', 'link'],
  trato_aceptado_vendedor: ['nombre', 'titulo', 'codigo', 'monto', 'app_url'],
  pago_recibido_comprador: ['nombre', 'titulo', 'codigo', 'monto', 'app_url'],
  pago_confirmado_comprador: ['nombre', 'titulo', 'codigo', 'app_url'],
  pago_confirmado_vendedor: ['nombre', 'titulo', 'codigo', 'app_url'],
  pago_rechazado: ['nombre', 'codigo', 'motivo', 'app_url'],
  entrega_registrada_comprador: ['nombre', 'codigo', 'detalle', 'app_url'],
  entrega_confirmada_pendiente_pago: ['nombre', 'codigo', 'neto', 'app_url'],
  entrega_confirmada_vendedor: ['nombre', 'codigo', 'neto', 'app_url'],
  disputa_abierta: ['nombre', 'codigo', 'app_url'],
  trato_completado: ['nombre', 'codigo', 'app_url'],
};

const TEMPLATE_NAMES = {
  entrega_confirmada_pendiente_pago: 'tratoya_entrega_confirmada_vendedor',
};

function templateComponents(evento, params) {
  const envKey = `WA_TEMPLATE_PARAMS_${evento.toUpperCase()}`;
  const keys = String(process.env[envKey] || TEMPLATE_PARAM_KEYS[evento]?.join(',') || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (!keys.length) return [];
  return [{
    type: 'body',
    parameters: keys.map((key) => ({ type: 'text', text: String(key === 'app_url' ? APP_URL() : params[key] ?? '-') })),
  }];
}

/* ══════════════════════════════════════════════════════════════
   PLANTILLAS DE MENSAJES (texto, dentro de ventana 24h)
   Formato: emoji + marca + línea separadora + contenido + CTA
   Max: 4096 caracteres. Recomendado: <500 para leer fácil.
   ══════════════════════════════════════════════════════════════ */
const MENSAJES = {

  bienvenida: ({ nombre }) =>
    `🎉 *¡Bienvenido a TratoYa, ${nombre}!*\n\nYa puedes hacer negocios seguros entre personas.\n\n🔒 El dinero queda protegido hasta que ambas partes confirmen. Sin riesgos.\n\n→ ${APP_URL()}`,

  recuperar_contrasena: ({ nombre, link }) =>
    `🔐 *TratoYa — Restablecer contraseña*\n\nHola ${nombre}, recibimos una solicitud para cambiar tu contraseña.\n\n*Haz clic aquí para continuar:*\n${link}\n\n⚠️ _Este link expira en 1 hora. Si no lo solicitaste, ignora este mensaje._`,

  trato_creado_vendedor: ({ codigo, titulo, monto }) =>
    `✅ *TratoYa — Trato creado*\n\n*Código:* ${codigo}\n*Producto/Servicio:* ${titulo}\n*Monto:* $${monto}\n\nComparte el link del trato con tu contraparte para que pueda pagar.\n\n→ ${APP_URL()}`,

  trato_creado_contraparte: ({ nombre, codigo, titulo, monto, link }) =>
    `🤝 *TratoYa — Te invitaron a un trato*\n\nHola ${nombre},\n\n*${titulo}*\n💰 Monto: $${monto} COP\n📋 Código: ${codigo}\n\nEl pago queda protegido por TratoYa hasta que confirmes que recibiste lo acordado.\n\n→ Ver trato: ${link}`,

  trato_aceptado_vendedor: ({ nombre, codigo, titulo, monto }) =>
    `🎯 *TratoYa — ¡Tu trato fue aceptado!*\n\nHola ${nombre},\n\n*${titulo}* (${codigo}) fue aceptado.\n💰 Monto: $${monto} COP\n\nEl comprador ya puede proceder con el pago. Te avisamos cuando el dinero esté protegido.\n\n→ ${APP_URL()}`,

  pago_recibido_comprador: ({ nombre, codigo, titulo, monto }) =>
    `⏳ *TratoYa — Verificando tu pago*\n\nHola ${nombre},\n\nRecibimos tu comprobante para el trato *${titulo}* (${codigo}).\n💰 Monto reportado: $${monto} COP\n\nEstamos verificando la transferencia. En máximo 1 hora te confirmamos.\n\n→ ${APP_URL()}`,

  pago_confirmado_comprador: ({ nombre, codigo, titulo }) =>
    `🔒 *TratoYa — Pago protegido*\n\nHola ${nombre},\n\nTu pago para *${titulo}* (${codigo}) está verificado y protegido en custodia TratoYa.\n\nEl dinero se liberará al vendedor cuando confirmes que recibiste lo acordado. ¡Estás protegido!\n\n→ Confirmar entrega: ${APP_URL()}`,

  pago_confirmado_vendedor: ({ nombre, codigo, titulo }) =>
    `💸 *TratoYa — ¡Pago protegido, listo para entregar!*\n\nHola ${nombre},\n\nEl pago del trato *${titulo}* (${codigo}) está verificado y en custodia de TratoYa.\n\n📦 *Procede con la entrega.* El dinero se liberará cuando el comprador confirme que recibió todo bien.\n\n→ ${APP_URL()}`,

  pago_rechazado: ({ nombre, codigo, motivo }) =>
    `⚠️ *TratoYa — Pago no verificado*\n\nHola ${nombre},\n\nNo encontramos tu transferencia para el trato *${codigo}*.\n${motivo ? `\n*Razón:* ${motivo}\n` : ''}\nVerifica el monto exacto y la referencia de pago, y vuelve a reportarlo.\n\n→ ${APP_URL()}`,

  entrega_registrada_comprador: ({ nombre, codigo, detalle }) =>
    `📦 *TratoYa — ¡Tu compra está en camino!*\n\nHola ${nombre},\n\nEl vendedor del trato *${codigo}* registró la entrega.\n${detalle ? `\n${detalle}\n` : ''}\nCuando recibas el producto en perfecto estado, confírmalo en la app para que el vendedor reciba su pago.\n\n→ Confirmar entrega: ${APP_URL()}`,

  entrega_confirmada_comprador: ({ nombre, codigo }) =>
    `✅ *TratoYA — Entrega confirmada*\n\nHola ${nombre}, confirmaste la entrega del trato *${codigo}*.\n\nTratoYA realizará la consignación manual al vendedor y te notificará cuando el proceso finalice.\n\n→ ${APP_URL()}`,

  entrega_confirmada_pendiente_pago: ({ nombre, codigo }) =>
    `✅ *TratoYA — Entrega confirmada*\n\nHola ${nombre}, el comprador confirmó la entrega del trato *${codigo}*.\n\nEl pago quedó listo para consignación manual. Te notificaremos cuando los fondos hayan sido enviados.\n\n→ ${APP_URL()}`,

  entrega_confirmada_vendedor: ({ nombre, codigo, neto }) =>
    `🎉 *TratoYa — ¡Pago liberado!*\n\nHola ${nombre},\n\nEl comprador confirmó la entrega del trato *${codigo}*.\n\n💰 *Recibirás aprox. $${neto} COP*\nTiempo de acreditación: máx. 24 horas hábiles.\n\n→ ${APP_URL()}`,

  disputa_abierta: ({ nombre, codigo, esTuDisputa }) =>
    `⚖️ *TratoYa — ${esTuDisputa ? 'Disputa registrada' : 'Disputa abierta'}*\n\nHola ${nombre},\n\n${esTuDisputa
      ? `Tu disputa para el trato *${codigo}* fue registrada. Nuestro equipo la revisará en máx. 72 horas y te contactará.`
      : `La contraparte del trato *${codigo}* abrió una disputa. Nuestro equipo revisará y notificará a ambas partes.`
    }\n\n→ Ver trato: ${APP_URL()}`,

  kyc_aprobado: ({ nombre, nivel }) =>
    `✅ *TratoYa — ¡Identidad verificada!*\n\nHola ${nombre},\n\nTu cuenta fue verificada al nivel *${nivel || 'Verificado'}*. Ya tienes acceso completo a todos los límites.\n\n→ ${APP_URL()}`,

  kyc_rechazado: ({ nombre, motivo }) =>
    `❌ *TratoYa — Verificación pendiente*\n\nHola ${nombre},\n\nNo pudimos verificar tus documentos.${motivo ? `\n*Razón:* ${motivo}` : '\nAsegúrate de que las fotos sean claras y legibles.'}\n\n→ Reintentar: ${APP_URL()}`,

  trato_completado: ({ nombre, codigo }) =>
    `🏆 *TratoYa — ¡Trato completado!*\n\nHola ${nombre},\n\nEl trato *${codigo}* se completó exitosamente. ¡Gracias por usar TratoYa!\n\nSi quedaste satisfecho, deja una reseña desde tu perfil. 🌟\n\n→ ${APP_URL()}`,
};

/* ── Función principal de notificación ─────────────────────── */
async function notificarWA(evento, telefono, params = {}) {
  const builder = MENSAJES[evento];
  if (!builder) {
    logger.warn(`[WA] Evento '${evento}' no tiene plantilla de mensaje`);
    return { ok: false, razon: 'plantilla_no_encontrada' };
  }
  const texto = builder(params);
  if (String(process.env.WA_USE_TEMPLATES).toLowerCase() === 'true') {
    const prefix = process.env.WA_TEMPLATE_PREFIX || 'tratoya_';
    const templateName = process.env[`WA_TEMPLATE_${evento.toUpperCase()}`] || TEMPLATE_NAMES[evento] || `${prefix}${evento}`;
    const templateResult = await enviarTemplate(
      telefono,
      templateName,
      process.env.WA_TEMPLATE_LANGUAGE || 'es_CO',
      templateComponents(evento, params),
    );
    if (templateResult.ok) return templateResult;
    logger.warn(`[WA] Falló template "${templateName}", intentando texto dentro de ventana de 24h`);
  }
  return enviarTexto(telefono, texto);
}

/* ── Webhook de verificación (para recibir mensajes) ────────── */
function verificarWebhook(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    logger.info('[WA] Webhook verificado correctamente');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Token inválido' });
}

/* ── Procesar mensajes entrantes (opcional, para respuestas) ── */
function procesarMensajeEntrante(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;
    const mensaje = value?.messages?.[0];

    if (!mensaje) return null;

    return {
      de:       mensaje.from,
      tipo:     mensaje.type,
      texto:    mensaje.text?.body || null,
      timestamp: mensaje.timestamp,
      waId:     mensaje.id,
    };
  } catch {
    return null;
  }
}

module.exports = {
  enviarTexto,
  enviarTemplate,
  notificarWA,
  verificarWebhook,
  procesarMensajeEntrante,
  MENSAJES,
};
