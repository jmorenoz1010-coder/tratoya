const logger = require('../utils/logger');

/**
 * Email service — Stub para desarrollo
 * TODO: Conectar con SendGrid en producción
 */
async function sendEmail(to, template, data = {}) {
  logger.info(`[EMAIL] Enviando plantilla "${template}" a ${to}`);
  // En producción usa SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({ to, from: process.env.EMAIL_FROM, templateId: TEMPLATES[template], dynamicTemplateData: data });
}

module.exports = { sendEmail };
