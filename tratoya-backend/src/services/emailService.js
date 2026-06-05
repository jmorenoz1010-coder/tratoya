// nodemailer se carga de forma lazy dentro de getTransporter()
// para que el backend NO crashee si el módulo no está disponible en el entorno
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════════
   EMAIL SERVICE — Nodemailer + SMTP
   ─────────────────────────────────────────────────────────────────
   OPCIÓN A — Brevo (RECOMENDADO, 300 emails/día gratis para siempre)
     https://app.brevo.com → Settings → SMTP & API → SMTP Keys
     SMTP_HOST=smtp-relay.brevo.com
     SMTP_PORT=587
     SMTP_USER=tu@email.com
     SMTP_PASS=xsmtpXXXXXXXXXXXXXX

   OPCIÓN B — Gmail (testing rápido, 500/día)
     Google Account → Seguridad → Contraseñas de aplicaciones → Generar
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=tu@gmail.com
     SMTP_PASS=xxxx xxxx xxxx xxxx

   EMAIL_FROM=TratoYa <noreply@tratoya.com>
════════════════════════════════════════════════════════════════════ */

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('[EMAIL] SMTP no configurado — modo stub. Define SMTP_HOST/SMTP_USER/SMTP_PASS en .env');
    return null;
  }
  try {
    // require lazy para no crashear al arrancar si el módulo no está disponible
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Brevo usa cert de Sendinblue (nombre anterior) — ignorar mismatch de hostname
      tls: { rejectUnauthorized: false },
    });
    logger.info(`[EMAIL] Transporter activo → ${SMTP_HOST}:${process.env.SMTP_PORT || '587'}`);
  } catch (e) {
    logger.warn(`[EMAIL] nodemailer no disponible (${e.message}) — modo stub`);
    return null;
  }
  return _transporter;
}

const FROM    = () => process.env.EMAIL_FROM || '"TratoYa" <soporte@tratoya.com>';
const APP_URL = () => process.env.FRONTEND_URL || 'https://tratoya.com';

// Logo incrustado como base64 (13 KB) — no depende de URLs externas
let _logoB64 = null;
function getLogoB64() {
  if (_logoB64) return _logoB64;
  try {
    const path = require('path');
    _logoB64 = require('fs').readFileSync(path.join(__dirname, '../assets/logo-email-b64.txt'), 'utf8').trim();
  } catch {
    // Fallback a URL pública si no hay base64
    _logoB64 = `${(process.env.FRONTEND_URL || 'https://tratoya.com').replace(/\/$/, '')}/logo-email.png`;
  }
  return _logoB64;
}

/* ── Layout base ─────────────────────────────────────────────────── */
const wrap = (body) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f6f8;font-family:'Helvetica Neue',Arial,sans-serif}
  .w{max-width:560px;margin:28px auto 48px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09)}
  .logo-bar{background:#ffffff;padding:18px 32px;text-align:center;border-bottom:1px solid #eef2f7}
  .logo-bar a{display:inline-block;text-decoration:none}
  .logo-bar img{height:64px;width:auto;display:block;margin:0 auto}
  .hd{background:linear-gradient(135deg,#071819 0%,#0b2927 100%);padding:16px 32px 20px;text-align:center}
  .brand-sub{color:rgba(255,255,255,.55);font-size:12px;margin:0;letter-spacing:.02em}
  .bd{padding:32px}
  .bd h2{color:#071819;font-size:20px;font-weight:800;margin:0 0 12px;line-height:1.25}
  .bd p{color:#4a5568;font-size:14.5px;line-height:1.7;margin:0 0 14px}
  .cta{display:inline-block;margin:10px 0 18px;padding:14px 28px;background:linear-gradient(135deg,#9ed819,#4fb51e);color:#fff;text-decoration:none;border-radius:9px;font-weight:800;font-size:15px}
  .box{background:#f0f9e8;border:1.5px solid #c3e99a;border-radius:9px;padding:14px 18px;margin:14px 0}
  .box-red{background:#fff5f5;border-color:#f5cece}
  .box-orange{background:#fff8f0;border-color:#f5dcc0}
  .lbl{font-size:10.5px;font-weight:700;color:#4b8800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .lbl-red{color:#c0392b}.lbl-orange{color:#e07b00}
  .val{font-size:17px;font-weight:800;color:#071819}
  .badge{display:inline-block;padding:4px 13px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:16px}
  .badge-gn{background:#e8f5e9;color:#2e7d32}
  .badge-rd{background:#ffebee;color:#c62828}
  .badge-or{background:#fff3e0;color:#e65100}
  .divider{height:1px;background:#eef2f7;margin:18px 0}
  .ft{background:#f8faf5;border-top:1px solid #e5e9ee;padding:16px 32px;text-align:center}
  .ft p{font-size:11.5px;color:#9aa5b3;margin:0}
  .muted{font-size:12.5px!important;color:#9aa5b3!important}
</style></head>
<body><div class="w">
  <div class="logo-bar">
    <a href="${APP_URL()}" target="_blank">
      <img src="${getLogoB64()}" alt="TratoYa" />
    </a>
  </div>
  <div class="hd">
    <p class="brand-sub">Pagos seguros entre personas</p>
  </div>
  <div class="bd">${body}</div>
  <div class="ft"><p>Mensaje automático de TratoYa · <a href="mailto:soporte@tratoya.com" style="color:#4b8800">soporte@tratoya.com</a></p></div>
</div></body></html>`;

/* ── Templates ───────────────────────────────────────────────────── */
const TEMPLATES = {

  bienvenida: ({ nombre }) => ({
    subject: '¡Bienvenido a TratoYa! Tu cuenta está lista 🎉',
    html: wrap(`
      <span class="badge badge-gn">¡Cuenta creada!</span>
      <h2>Hola ${nombre}, bienvenido a TratoYa 👋</h2>
      <p>Ya puedes crear tratos seguros, proteger tus pagos y hacer negocios sin riesgo.</p>
      <p>Para desbloquear todos los límites, <strong>sube tu documento de identidad</strong> desde tu perfil.</p>
      <a href="${APP_URL()}" class="cta">Ir a mi cuenta →</a>
      <div class="divider"></div>
      <p class="muted">Si no creaste esta cuenta, ignora este mensaje.</p>
    `),
  }),

  verificacion_email: ({ nombre, link }) => ({
    subject: 'TratoYa · Verifica tu correo',
    html: wrap(`
      <h2>Verifica tu correo, ${nombre}</h2>
      <p>Haz clic para confirmar tu dirección y activar tu cuenta.</p>
      <a href="${link}" class="cta">Verificar mi correo →</a>
      <div class="divider"></div>
      <p class="muted">Este link expira en 24 horas. Si no creaste una cuenta, ignora esto.</p>
    `),
  }),

  recuperar_contrasena: ({ nombre, link }) => ({
    subject: 'TratoYa · Recupera tu contraseña',
    html: wrap(`
      <h2>Recupera tu contraseña</h2>
      <p>Hola ${nombre}, solicitaste restablecer tu contraseña. <strong>El link expira en 1 hora.</strong></p>
      <a href="${link}" class="cta">Restablecer contraseña →</a>
      <div class="divider"></div>
      <p class="muted">Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.</p>
    `),
  }),

  trato_creado_contraparte: ({ nombre, codigo, titulo, monto, link }) => ({
    subject: `TratoYa · Te invitaron a un trato — ${codigo}`,
    html: wrap(`
      <span class="badge badge-gn">Trato pendiente</span>
      <h2>Te invitaron a un trato seguro</h2>
      <p>Hola ${nombre}. Alguien creó el trato <strong>${titulo}</strong> por <strong>${monto}</strong> en TratoYa y te compartió el link.</p>
      <a href="${link}" class="cta">Ver el trato →</a>
    `),
  }),

  trato_aceptado_vendedor: ({ nombre, codigo, titulo, monto }) => ({
    subject: `TratoYa · Trato ${codigo} aceptado`,
    html: wrap(`
      <span class="badge badge-gn">Trato aceptado ✓</span>
      <h2>Tu trato fue aceptado</h2>
      <p>Hola ${nombre}. El trato <strong>${titulo}</strong> fue aceptado. El comprador puede proceder a realizar el pago.</p>
      <div class="box">
        <div class="lbl">Trato / Monto</div>
        <div class="val">${codigo} · ${monto}</div>
      </div>
      <a href="${APP_URL()}" class="cta">Ver trato →</a>
    `),
  }),

  pago_recibido_comprador: ({ nombre, codigo, titulo, monto }) => ({
    subject: `TratoYa · Comprobante recibido — ${codigo}`,
    html: wrap(`
      <span class="badge badge-or">Verificando ⏳</span>
      <h2>Recibimos tu comprobante</h2>
      <p>Hola ${nombre}. Estamos verificando la transferencia del trato <strong>${titulo}</strong>. Te avisamos en máximo 1 hora.</p>
      <div class="box box-orange">
        <div class="lbl lbl-orange">Monto reportado</div>
        <div class="val">${monto}</div>
      </div>
      <a href="${APP_URL()}" class="cta">Ver estado →</a>
    `),
  }),

  pago_confirmado_comprador: ({ nombre, codigo, titulo }) => ({
    subject: `TratoYa · Pago confirmado ✅ — ${codigo}`,
    html: wrap(`
      <span class="badge badge-gn">Pago confirmado ✅</span>
      <h2>Tu pago está protegido</h2>
      <p>Hola ${nombre}. Tu pago para <strong>${titulo}</strong> fue verificado. El dinero está en custodia de TratoYa y se liberará cuando confirmes la entrega.</p>
      <a href="${APP_URL()}" class="cta">Ver trato →</a>
    `),
  }),

  pago_confirmado_vendedor: ({ nombre, codigo, titulo }) => ({
    subject: `TratoYa · ¡Pago protegido — entrega ahora! — ${codigo}`,
    html: wrap(`
      <span class="badge badge-gn">¡Listo para entregar! 📦</span>
      <h2>El pago está protegido. Ya puedes entregar.</h2>
      <p>Hola ${nombre}. El pago del trato <strong>${titulo}</strong> fue confirmado. <strong>Procede con la entrega — el dinero se liberará cuando el comprador confirme que recibió todo bien.</strong></p>
      <a href="${APP_URL()}" class="cta">Ver trato →</a>
    `),
  }),

  pago_rechazado: ({ nombre, codigo, motivo }) => ({
    subject: `TratoYa · Pago no verificado — ${codigo}`,
    html: wrap(`
      <span class="badge badge-rd">Acción requerida ⚠️</span>
      <h2>No pudimos verificar tu pago</h2>
      <p>Hola ${nombre}. No encontramos la transferencia para el trato <strong>${codigo}</strong>.${motivo ? ` <strong>Razón:</strong> ${motivo}` : ''}</p>
      <div class="box box-red">
        <div class="lbl lbl-red">¿Qué hacer?</div>
        <div class="val" style="font-size:14px;font-weight:600">Vuelve al trato, verifica el monto exacto y la referencia de pago, y reporta de nuevo.</div>
      </div>
      <a href="${APP_URL()}" class="cta">Reintentar →</a>
    `),
  }),

  entrega_registrada_comprador: ({ nombre, codigo }) => ({
    subject: `TratoYa · El vendedor registró la entrega — ${codigo}`,
    html: wrap(`
      <span class="badge badge-or">Confirma la entrega ✅</span>
      <h2>El vendedor registró la entrega</h2>
      <p>Hola ${nombre}. El vendedor del trato <strong>${codigo}</strong> registró la entrega. <strong>Cuando recibas el producto en perfecto estado, confírmalo en la app para liberar el pago.</strong></p>
      <a href="${APP_URL()}" class="cta">Confirmar entrega →</a>
    `),
  }),

  entrega_confirmada_vendedor: ({ nombre, codigo, neto }) => ({
    subject: `TratoYa · ¡Pago liberado! 🎉 — ${codigo}`,
    html: wrap(`
      <span class="badge badge-gn">¡Pago liberado! 🎉</span>
      <h2>El comprador confirmó la entrega</h2>
      <p>Hola ${nombre}. El comprador del trato <strong>${codigo}</strong> confirmó que recibió todo bien.</p>
      <div class="box">
        <div class="lbl">Recibirás aprox.</div>
        <div class="val">${neto}</div>
      </div>
      <p class="muted">Tiempo de acreditación: máximo 24 horas hábiles.</p>
      <a href="${APP_URL()}" class="cta">Ver detalles →</a>
    `),
  }),

  disputa_abierta: ({ nombre, codigo, esTuDisputa }) => ({
    subject: `TratoYa · ${esTuDisputa ? 'Disputa registrada' : 'Disputa abierta'} — ${codigo}`,
    html: wrap(`
      <span class="badge badge-or">En revisión ⚖️</span>
      <h2>${esTuDisputa ? 'Tu disputa fue registrada' : 'Se abrió una disputa en tu trato'}</h2>
      <p>Hola ${nombre}. ${esTuDisputa
        ? `Recibimos tu disputa para el trato <strong>${codigo}</strong>. Nuestro equipo la revisará y te contactará pronto.`
        : `La contraparte del trato <strong>${codigo}</strong> abrió una disputa. Nuestro equipo revisará la situación y notificará a ambas partes.`
      }</p>
      <a href="${APP_URL()}" class="cta">Ver trato →</a>
    `),
  }),

  kyc_aprobado: ({ nombre, nivel }) => ({
    subject: 'TratoYa · ¡Identidad verificada!',
    html: wrap(`
      <span class="badge badge-gn">Verificado ✓</span>
      <h2>¡Tu identidad fue verificada!</h2>
      <p>Hola ${nombre}. Tu cuenta fue verificada al nivel <strong>${nivel || 'Verificado'}</strong>. Ya tienes acceso a todos los límites de tu nivel.</p>
      <a href="${APP_URL()}" class="cta">Ver mi perfil →</a>
    `),
  }),

  kyc_rechazado: ({ nombre, motivo }) => ({
    subject: 'TratoYa · Verificación pendiente — acción requerida',
    html: wrap(`
      <span class="badge badge-rd">Acción requerida</span>
      <h2>Necesitamos que reenvíes tus documentos</h2>
      <p>Hola ${nombre}. No pudimos verificar tus documentos.${motivo ? ` <strong>Razón:</strong> ${motivo}` : ' Asegúrate de que las fotos sean claras, bien iluminadas y legibles.'}</p>
      <a href="${APP_URL()}" class="cta">Reintentar verificación →</a>
    `),
  }),
};

/* ── Función principal ───────────────────────────────────────────── */
async function sendEmail(to, template, data = {}) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    logger.warn(`[EMAIL] Dirección inválida: "${to}"`);
    return;
  }

  const tp = getTransporter();
  if (!tp) {
    logger.info(`[EMAIL-STUB] template="${template}" to="${to}" data=${JSON.stringify(data)}`);
    return;
  }

  const builder = TEMPLATES[template];
  if (!builder) {
    logger.warn(`[EMAIL] Plantilla desconocida: "${template}". Disponibles: ${Object.keys(TEMPLATES).join(', ')}`);
    return;
  }

  const { subject, html } = builder(data);
  try {
    const info = await tp.sendMail({ from: FROM(), to, subject, html });
    logger.info(`[EMAIL] ✓ "${template}" → "${to}" msgId=${info.messageId}`);
  } catch (err) {
    logger.error(`[EMAIL] ✗ "${template}" → "${to}": ${err.message}`);
    // No relanzar — los emails no deben bloquear el flujo principal
  }
}

module.exports = { sendEmail };
