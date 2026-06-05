const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const fromAddress = () => process.env.EMAIL_FROM || 'TratoYA <hola@tratoya.com>';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO');
}

function shell(title, body) {
  return `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e6eaf1;">
            <tr>
              <td style="background:#1A1F5E;padding:28px 32px;color:#fff;">
                <div style="font-size:26px;font-weight:900;letter-spacing:-.02em;">Trato<span style="color:#F5A623;">YA</span></div>
                <div style="margin-top:6px;color:#dbe4ff;font-size:14px;">Tu pago protegido hasta que el trato se cumpla</div>
              </td>
            </tr>
            <tr><td style="padding:32px;">${body}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function button(label, href) {
  return `<a href="${href}" style="display:inline-block;background:#F5A623;color:#111827;text-decoration:none;font-weight:800;border-radius:999px;padding:14px 22px;margin:14px 0;">${escapeHtml(label)}</a>`;
}

async function sendMail(to, subject, html) {
  const tx = getTransporter();
  if (!tx) {
    logger.warn(`[WAITLIST_EMAIL] SMTP no configurado. Email omitido: ${subject} -> ${to}`);
    return false;
  }
  await tx.sendMail({ from: fromAddress(), to, subject, html });
  return true;
}

async function sendWaitlistConfirmation(user) {
  const link = `${frontendUrl()}/espera?ref=${encodeURIComponent(user.referral_code)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Me acabo de unir a TratoYA, el primer servicio de tratos seguros de Colombia. Unete con mi link y ambos subimos posiciones: ${link}`)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Acabo de unirme a @TratoYA. El servicio de tratos seguros que Colombia necesitaba. Unete aqui: ${link} #TratoYA #Fintech #Colombia`)}`;
  const html = shell(`Ya estas en la lista, ${user.nombre}`, `
    <h1 style="font-size:28px;line-height:1.15;margin:0 0 14px;">Ya estas en la lista, ${escapeHtml(user.nombre)} 🎉</h1>
    <p style="font-size:18px;line-height:1.6;margin:0 0 18px;">Eres el numero <strong>#${formatNumber(user.posicion)}</strong> en la lista de TratoYA.</p>
    <p style="line-height:1.6;color:#4b5563;">TratoYA ayuda a comprar, vender y contratar sin miedo. Protegemos el dinero hasta que ambas partes cumplan lo acordado.</p>
    <div style="background:#fff8e8;border:1px solid #f8d38a;border-radius:18px;padding:18px;margin:24px 0;">
      <div style="font-weight:800;color:#1A1F5E;margin-bottom:8px;">Tu link para subir posiciones:</div>
      <a href="${link}" style="color:#1A1F5E;word-break:break-all;">${link}</a>
      <p style="margin:12px 0 0;color:#374151;">Por cada amigo que se registre con tu link, subes 5 puestos.</p>
    </div>
    <p style="line-height:1.6;"><strong>Beneficio especial:</strong> los primeros 1.000 obtienen 0% de comision por 6 meses + badge Fundador.</p>
    ${button('Comparte tu link ahora', link)}
    <p style="color:#6b7280;">Compartir: <a href="${whatsapp}">WhatsApp</a> · <a href="${xUrl}">X</a> · Copia este texto para Instagram: ${link}</p>
    <p style="margin-top:28px;line-height:1.6;">Un abrazo,<br><strong>Jesus</strong><br>Fundador de TratoYA</p>
  `);
  return sendMail(user.email, `Ya estas en la lista, ${user.nombre} 🎉`, html);
}

async function sendPositionUpgradeEmail(user, puestos = 5) {
  const link = `${frontendUrl()}/espera?ref=${encodeURIComponent(user.referral_code)}`;
  const founder = user.es_fundador
    ? '<div style="background:#1A1F5E;color:#fff;border-radius:18px;padding:18px;margin:20px 0;"><strong>¡Eres Fundador TratoYA!</strong><br>Estas dentro del top 1.000 y desbloqueaste 0% de comision por 6 meses.</div>'
    : '';
  const html = shell(`Subiste en la lista`, `
    <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px;">¡Subiste en la lista! Ahora eres el #${formatNumber(user.posicion)} 📈</h1>
    <p style="line-height:1.6;">Tu referido se registro y subiste <strong>${formatNumber(puestos)}</strong> puestos.</p>
    <p style="line-height:1.6;">Ya llevas <strong>${formatNumber(user.referidos_count)}</strong> referidos.</p>
    ${Number(user.referidos_count) >= 3 ? '<p style="color:#1A1F5E;font-weight:800;">¡Vas muy bien! Sigue invitando.</p>' : ''}
    ${founder}
    ${button('Seguir compartiendo', link)}
  `);
  return sendMail(user.email, `¡Subiste en la lista! Ahora eres el #${formatNumber(user.posicion)} 📈`, html);
}

async function sendActivationEmail(user) {
  const appUrl = `${frontendUrl()}/app`;
  const founder = user.es_fundador
    ? '<p style="line-height:1.6;"><strong>Como Fundador TratoYA</strong>, conservas tu badge y 0% de comision por 6 meses.</p>'
    : '';
  const html = shell(`TratoYA te esta esperando`, `
    <h1 style="font-size:28px;line-height:1.15;margin:0 0 14px;">Llegó tu momento, ${escapeHtml(user.nombre)}</h1>
    <p style="line-height:1.7;">TratoYA ya te esta esperando. Desde ahora puedes crear tratos seguros, invitar a la otra parte, acordar condiciones y operar con una experiencia pensada para vender y comprar con confianza.</p>
    ${founder}
    ${button('Entrar a TratoYA', appUrl)}
    <p style="line-height:1.7;color:#4b5563;">Primeros pasos: crea tu cuenta, completa tus datos principales y publica tu primer trato con monto, condiciones y fecha de entrega.</p>
    <p style="margin-top:28px;line-height:1.6;">Nos vemos adentro,<br><strong>Jesus</strong><br>Fundador de TratoYA</p>
  `);
  return sendMail(user.email, `TratoYA te esta esperando, ${user.nombre} ✅`, html);
}

module.exports = {
  sendWaitlistConfirmation,
  sendPositionUpgradeEmail,
  sendActivationEmail,
};
