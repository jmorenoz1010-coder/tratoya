// =============================================
// USERS ROUTE — src/routes/users.js
// =============================================
const express = require('express');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { Op } = require('sequelize');
const usersRouter = express.Router();
const auth = require('../middleware/auth');
const { User, CuentaBancaria, Notificacion } = require('../config/database');

usersRouter.use(auth);

const normalizeHandle = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .slice(0, 24);

const maskName = (value) => {
  const clean = String(value || '').trim();
  if (!clean) return '***';
  return `${clean.slice(0, 3)}*****`;
};

usersRouter.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash', 'refresh_token', 'two_factor_secret'] }
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

usersRouter.put('/profile', async (req, res, next) => {
  try {
    const { nombre, apellido, telefono, ciudad, usuario_unico, tipo_identificacion, cedula } = req.body;
    const updates = { nombre, apellido, telefono, ciudad, tipo_identificacion, cedula };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    if (usuario_unico !== undefined) {
      const handle = normalizeHandle(usuario_unico);
      if (!/^[a-z0-9]{5,24}$/.test(handle)) {
        return res.status(400).json({ success: false, message: 'El ID único debe tener entre 5 y 24 letras/números, sin espacios ni símbolos' });
      }
      const existing = await User.findOne({ where: { usuario_unico: handle, id: { [Op.ne]: req.user.id } } });
      if (existing) return res.status(409).json({ success: false, message: 'Ese ID único ya está en uso' });
      updates.usuario_unico = handle;
    }

    if (cedula !== undefined) {
      const existingDoc = await User.findOne({ where: { cedula, id: { [Op.ne]: req.user.id } } });
      if (existingDoc) return res.status(409).json({ success: false, message: 'Ese número de identificación ya está registrado' });
    }
    if (telefono !== undefined && telefono) {
      const existingTel = await User.findOne({ where: { telefono, id: { [Op.ne]: req.user.id } } });
      if (existingTel) return res.status(409).json({ success: false, message: 'Ese número de WhatsApp ya está registrado en otra cuenta' });
    }

    await req.user.update(updates);
    const fresh = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash', 'refresh_token', 'two_factor_secret'] } });
    res.json({ success: true, message: 'Perfil actualizado', data: fresh });
  } catch (err) { next(err); }
});

usersRouter.get('/lookup/:usuario_unico', async (req, res, next) => {
  try {
    const handle = normalizeHandle(req.params.usuario_unico);
    if (!/^[a-z0-9]{5,24}$/.test(handle)) {
      return res.status(400).json({ success: false, message: 'ID único inválido' });
    }
    const user = await User.findOne({
      where: { usuario_unico: handle, is_active: true, is_blocked: false },
      attributes: ['id','nombre','apellido','usuario_unico','reputacion','total_tratos'],
    });
    if (!user) return res.status(404).json({ success: false, message: 'No encontramos un usuario con ese ID' });
    if (user.id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes enviarte un trato a ti mismo' });
    res.json({
      success: true,
      data: {
        usuario_unico: user.usuario_unico,
        nombre_mask: maskName(user.nombre),
        apellido_mask: maskName(user.apellido),
        reputacion: user.reputacion,
        total_tratos: user.total_tratos,
      },
    });
  } catch (err) { next(err); }
});

usersRouter.get('/notifications', async (req, res, next) => {
  try {
    const notifs = await Notificacion.findAll({
      where: { usuario_id: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 30,
    });
    res.json({ success: true, data: notifs });
  } catch (err) { next(err); }
});

// GET /api/users/stream — SSE push notifications en tiempo real
usersRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Registrar conexión
  try {
    const { registrarConexion } = require('../services/pushService');
    registrarConexion(req.user.id, res);
  } catch { /* pushService no disponible */ }

  // Heartbeat cada 25s para mantener conexión activa
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  // Bienvenida inicial
  res.write(`data: ${JSON.stringify({ tipo: 'conectado', mensaje: 'Conexión establecida', usuario_id: req.user.id })}\n\n`);

  req.on('close', () => clearInterval(heartbeat));
});

usersRouter.put('/notifications/:id/read', async (req, res, next) => {
  try {
    await Notificacion.update({ leida: true }, { where: { id: req.params.id, usuario_id: req.user.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

usersRouter.get('/bank-accounts', async (req, res, next) => {
  try {
    const cuentas = await CuentaBancaria.findAll({ where: { usuario_id: req.user.id } });
    res.json({ success: true, data: cuentas });
  } catch (err) { next(err); }
});

usersRouter.post('/bank-accounts', async (req, res, next) => {
  try {
    const { banco, tipo, numero, titular } = req.body;
    if (!banco || !tipo || !numero) return res.status(400).json({ success: false, message: 'Banco, tipo y número son requeridos' });
    if (!['ahorros','corriente','nequi','daviplata','breb'].includes(tipo)) return res.status(400).json({ success: false, message: 'Tipo de cuenta inválido' });
    const cuenta = await CuentaBancaria.create({
      usuario_id: req.user.id,
      banco,
      tipo,
      numero,
      titular: titular || `${req.user.nombre} ${req.user.apellido}`,
      cedula_titular: req.user.cedula,
      principal: true,
    });
    res.status(201).json({ success: true, data: cuenta });
  } catch (err) { next(err); }
});

module.exports.users = usersRouter;


// =============================================
// PAYMENTS ROUTE — src/routes/payments.js
// =============================================
const paymentsRouter = express.Router();
const {
  Pago, Trato, PaymentIntent, PaymentEvent, LedgerEntry, AuditLog
} = require('../config/database');
const paymentUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const normalizeEpaycoStatus = (response, stateCode) => {
  const normalized = String(response || '').toLowerCase();
  const code = String(stateCode || '');
  if (normalized.includes('aceptada') || code === '1') return 'PAID';
  if (normalized.includes('rechazada') || code === '2') return 'PAYMENT_DECLINED';
  if (normalized.includes('pendiente') || code === '3') return 'PAYMENT_PENDING';
  if (normalized.includes('fallida') || code === '4') return 'PAYMENT_ERROR';
  return 'PAYMENT_PENDING';
};

const paymentFailedStatuses = ['PAYMENT_DECLINED', 'PAYMENT_ERROR', 'PAYMENT_VOIDED'];

const envBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).trim().toLowerCase());
};

function getEpaycoConfig() {
  const explicitEnv = String(process.env.EPAYCO_ENV || '').trim().toLowerCase();
  const isTest = explicitEnv
    ? !['production', 'prod', 'live'].includes(explicitEnv)
    : envBool(process.env.EPAYCO_TEST, process.env.NODE_ENV !== 'production');
  const env = isTest ? 'test' : 'production';
  const publicKey = process.env.EPAYCO_PUBLIC_KEY || process.env.EPAYCO_P_PUBLIC_KEY || '';
  const customerId = process.env.EPAYCO_CUSTOMER_ID || process.env.EPAYCO_P_CUST_ID_CLIENTE || process.env.EPAYCO_P_CUST_ID || '';
  const pKey = process.env.EPAYCO_PRIVATE_KEY || process.env.EPAYCO_SECRET_KEY || process.env.EPAYCO_P_KEY || '';
  const frontendUrl = process.env.FRONTEND_URL || 'https://tratoya.com';
  const backendUrl = process.env.BACKEND_URL || 'https://api.tratoya.com';
  const realEnabled = envBool(process.env.PAYMENTS_REAL_ENABLED);
  const maxTestAmountCop = Number(process.env.PAYMENTS_MAX_TEST_AMOUNT_COP || 100000);
  const checkoutVersion = String(process.env.EPAYCO_CHECKOUT_VERSION || '2').trim();
  const checkoutType = String(process.env.EPAYCO_CHECKOUT_TYPE || 'standard').trim().toLowerCase() === 'onpage' ? 'onpage' : 'standard';

  if (!publicKey) {
    const err = new Error('Falta variable ePayco: EPAYCO_PUBLIC_KEY');
    err.statusCode = 503;
    err.expose = true;
    throw err;
  }
  if (!customerId || !pKey) {
    logger.warn('EPAYCO_SIGNATURE_KEYS_MISSING: faltan EPAYCO_CUSTOMER_ID/EPAYCO_P_CUST_ID y EPAYCO_P_KEY para sesión v2 o validación de webhook');
  }
  return { env, isTest, publicKey, customerId, pKey, frontendUrl, backendUrl, realEnabled, maxTestAmountCop, checkoutVersion, checkoutType };
}

async function createEpaycoSmartSession(config, sessionPayload) {
  if (!config.pKey) {
    const err = new Error('Falta variable ePayco: EPAYCO_P_KEY');
    err.statusCode = 503;
    err.expose = true;
    throw err;
  }
  const basic = Buffer.from(`${config.publicKey}:${config.pKey}`).toString('base64');
  const login = await axios.post('https://apify.epayco.co/login', {}, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basic}`,
    },
    timeout: 15000,
  });
  const token = login.data?.token || login.data?.data?.token;
  if (!token) {
    const err = new Error(login.data?.textResponse || login.data?.titleResponse || login.data?.message || 'ePayco no devolvió token de autenticación');
    err.statusCode = 502;
    err.expose = true;
    throw err;
  }
  const session = await axios.post('https://apify.epayco.co/payment/session/create', sessionPayload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 15000,
  });
  const sessionId = session.data?.data?.sessionId || session.data?.sessionId;
  if (!sessionId) {
    const err = new Error(session.data?.textResponse || session.data?.titleResponse || 'ePayco no devolvió sessionId');
    err.statusCode = 502;
    err.expose = true;
    throw err;
  }
  return { sessionId, raw: session.data };
}

function canAccessDeal(trato, user) {
  const rol = user.rol || (user.is_admin ? 'admin' : 'user');
  return trato.comprador_id === user.id || trato.vendedor_id === user.id || user.is_admin || ['admin', 'superadmin', 'soporte'].includes(rol);
}

paymentsRouter.all('/epayco/response', (req, res) => {
  let payload = {};
  try {
    payload = readWebhookPayload(req);
  } catch {
    payload = { ...(req.query || {}) };
  }
  const reference = req.query.reference || payload.x_id_invoice || payload.x_extra3 || payload.invoice || payload.reference || '';
  const params = new URLSearchParams();
  if (reference) params.set('reference', reference);
  for (const key of ['ref_payco', 'x_ref_payco', 'x_transaction_id', 'x_response', 'x_cod_transaction_state']) {
    const value = req.query[key] || payload[key];
    if (value) params.set(key, value);
  }
  const frontendUrl = process.env.FRONTEND_URL || 'https://tratoya.com';
  const targetUrl = `${frontendUrl}/pago/resultado${params.toString() ? `?${params.toString()}` : ''}`;
  res.status(302);
  res.setHeader('Location', targetUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${targetUrl}"></head><body>Redirigiendo a TratoYa...</body></html>`);
});

paymentsRouter.use(auth);

paymentsRouter.post('/wompi/create', async (req, res, next) => {
  return res.status(410).json({ success: false, message: 'Wompi fue desactivado. TratoYa ahora procesa pagos por transferencia manual verificada.' });
});

paymentsRouter.post('/epayco/create', async (req, res, next) => {
  return res.status(410).json({
    success: false,
    message: 'ePayco fue desactivado. Usa /api/payments/manual/report para reportar transferencias manuales.',
  });
  try {
    logger.info('EPAYCO_CREATE_PAYMENT_START');
    const { dealId } = req.body || {};
    if (!dealId) return res.status(400).json({ success: false, message: 'dealId requerido' });

    const config = getEpaycoConfig();
    if (!config.isTest && !config.realEnabled) {
      return res.status(403).json({ success: false, message: 'Pagos reales deshabilitados por configuración' });
    }

    const trato = await Trato.findByPk(dealId);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    if (trato.comprador_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Solo el comprador puede pagar este trato' });
    }
    if (!canAccessDeal(trato, req.user)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para pagar este trato' });
    }
    if (!['borrador', 'activo', 'pago_pendiente'].includes(trato.estado)) {
      return res.status(400).json({ success: false, message: `No se puede pagar un trato en estado ${trato.estado}` });
    }

    const { calcularComision } = require('../services/comisionService');
    const montoBase = Math.round(Number(trato.monto || 0));
    const commission = calcularComision(montoBase, trato.quien_paga_comision || 'comprador');
    const amountCop = commission.total_a_pagar;
    if (!Number.isFinite(amountCop) || amountCop <= 0) {
      return res.status(400).json({ success: false, message: 'El monto del trato no es válido' });
    }
    if (config.isTest && amountCop > config.maxTestAmountCop) {
      return res.status(400).json({
        success: false,
        message: `Durante pruebas reales solo se permiten pagos hasta ${config.maxTestAmountCop} COP.`,
      });
    }

    const currency = 'COP';
    const amountInCents = amountCop * 100;
    const random = require('crypto').randomBytes(3).toString('hex').toUpperCase();
    const reference = `TY-${String(trato.codigo || trato.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 18)}-${Date.now()}-${random}`;
    const responseUrl = `${config.backendUrl}/api/payments/epayco/response?reference=${encodeURIComponent(reference)}`;
    const confirmationUrl = `${config.backendUrl}/api/webhooks/epayco`;
    const checkoutData = {
      name: `TratoYA ${trato.codigo || ''}`.trim(),
      description: trato.titulo,
      invoice: reference,
      currency,
      amount: String(amountCop),
      tax_base: String(amountCop),
      tax: '0',
      tax_ico: '0',
      country: 'CO',
      lang: 'es',
      external: 'false',
      response: responseUrl,
      confirmation: confirmationUrl,
      method_confirmation: 'POST',
      test: config.isTest,
      name_billing: `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email,
      email_billing: req.user.email,
      mobilephone_billing: req.user.telefono || '',
      number_doc_billing: req.user.cedula || '',
      extra1: trato.id,
      extra2: req.user.id,
      extra3: reference,
    };
    const smartSessionPayload = {
      checkout_version: '2',
      name: 'TratoYA',
      description: trato.titulo || `Trato ${trato.codigo || trato.id}`,
      currency,
      amount: amountCop,
      lang: 'ES',
      country: 'CO',
      taxBase: amountCop,
      tax: 0,
      response: responseUrl,
      confirmation: confirmationUrl,
      invoice: reference,
      Invoice: reference,
      method: 'GET',
      forceResponse: true,
      uniqueTransactionPerBill: true,
      extras: {
        extra1: String(trato.id),
        extra2: String(req.user.id),
        extra3: reference,
      },
      billing: {
        email: req.user.email,
        name: `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email,
        typeDoc: req.user.tipo_identificacion || 'CC',
        numberDoc: req.user.cedula || '',
        callingCode: '+57',
        mobilePhone: req.user.telefono || '',
      },
    };

    let smartSession = null;
    if (config.checkoutVersion === '2') {
      try {
        smartSession = await createEpaycoSmartSession(config, smartSessionPayload);
      } catch (sessionErr) {
        logger.warn(`EPAYCO_SMART_SESSION_FAILED: ${sessionErr.message}`);
        const err = new Error(`No se pudo iniciar ePayco Smart Checkout. Revisa las llaves API y los medios de pago habilitados en ePayco. Detalle: ${sessionErr.message}`);
        err.statusCode = sessionErr.statusCode || 502;
        err.expose = true;
        throw err;
      }
    }

    const intent = await PaymentIntent.create({
      provider: 'epayco',
      reference,
      amount_cents: amountInCents,
      amount_cop: amountCop,
      currency,
      status: 'CREATED',
      deal_id: trato.id,
      created_by_user_id: req.user.id,
      checkout_url: responseUrl,
      raw_response: {
        responseUrl,
        confirmationUrl,
        checkoutData,
        smartSessionPayload,
        smartSession: smartSession ? { sessionId: smartSession.sessionId, raw: smartSession.raw } : null,
        env: config.env,
        checkoutVersion: config.checkoutVersion,
      },
    });
    await trato.update({ estado: 'pago_pendiente' });
    await AuditLog.create({
      user_id: req.user.id,
      action: 'EPAYCO_PAYMENT_CREATED',
      entity_type: 'payment_intent',
      entity_id: intent.id,
      metadata: { reference, deal_id: trato.id, amount_cents: amountInCents },
    });

    logger.info(`EPAYCO_CREATE_PAYMENT_SUCCESS ${reference}`);
    const paymentData = {
      reference,
      amountInCents,
      amountCop,
      currency,
      provider: 'epayco',
      publicKey: config.publicKey,
      checkoutData,
      checkoutVersion: smartSession ? '2' : '1',
      checkoutType: config.checkoutType,
      sessionId: smartSession?.sessionId || null,
      test: config.isTest,
    };
    res.json({
      success: true,
      ok: true,
      data: paymentData,
      ...paymentData,
    });
  } catch (err) { next(err); }
});

paymentsRouter.get('/status', async (req, res, next) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ success: false, message: 'reference requerido' });
    const intent = await PaymentIntent.findOne({ where: { reference }, include: [{ model: Trato }] });
    if (!intent) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    const trato = intent.Trato || await Trato.findByPk(intent.deal_id);
    if (!trato || !canAccessDeal(trato, req.user)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este pago' });
    }
    res.json({
      success: true,
      ok: true,
      data: {
        provider: intent.provider,
        reference: intent.reference,
        status: intent.status,
        amountCop: Number(intent.amount_cop),
        amountInCents: intent.amount_cents,
        currency: intent.currency,
        dealId: intent.deal_id,
        transactionId: intent.wompi_transaction_id,
        updatedAt: intent.updated_at || intent.updatedAt,
      },
      provider: intent.provider,
      reference: intent.reference,
      status: intent.status,
      amountCop: Number(intent.amount_cop),
      amountInCents: intent.amount_cents,
      currency: intent.currency,
      dealId: intent.deal_id,
      transactionId: intent.wompi_transaction_id,
      updatedAt: intent.updated_at || intent.updatedAt,
    });
  } catch (err) { next(err); }
});

paymentsRouter.post('/manual/report', paymentUpload.single('receipt'), async (req, res, next) => {
  try {
    const { dealId, transactionRef = '', transferConcept = '', method = 'breb', notes = '' } = req.body || {};
    if (!dealId) return res.status(400).json({ success: false, message: 'dealId requerido' });

    const trato = await Trato.findByPk(dealId);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    if (trato.comprador_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Solo el comprador puede reportar el pago de este trato' });
    }
    if (!['activo', 'pago_pendiente'].includes(trato.estado)) {
      return res.status(400).json({ success: false, message: `No se puede reportar pago en estado ${trato.estado}` });
    }
    const existingPayment = await Pago.findOne({
      where: { trato_id: trato.id, tipo: 'retencion' },
      order: [['createdAt', 'DESC']],
    });
    if (existingPayment && ['procesando', 'aprobado'].includes(existingPayment.estado)) {
      return res.status(409).json({ success: false, message: 'Este pago ya fue reportado. No puedes pagar dos veces el mismo trato.' });
    }
    if (existingPayment?.estado === 'rechazado') {
      const retryAt = new Date(new Date(existingPayment.updatedAt || existingPayment.createdAt).getTime() + 10 * 60 * 1000);
      if (Date.now() < retryAt.getTime()) {
        const mins = Math.ceil((retryAt.getTime() - Date.now()) / 60000);
        return res.status(429).json({ success: false, message: `Pago fallido. Espera ${mins} minuto(s) para volver a intentarlo.` });
      }
    }

    const { calcularComision } = require('../services/comisionService');
    const montoBase = Math.round(Number(trato.monto || 0));
    const commission = calcularComision(montoBase, trato.quien_paga_comision || 'comprador');
    const amountCop = commission.total_a_pagar;
    const cleanRef = String(transactionRef || '').trim().slice(0, 80);
    const cleanConcept = String(transferConcept || '').trim().slice(0, 180);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar el comprobante de pago' });
    }
    const { s3Upload } = require('../services/s3Service');
    const receiptKey = `payments/${trato.codigo || trato.id}/${Date.now()}-${String(req.file.originalname || 'comprobante').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const receiptUrl = await s3Upload(receiptKey, req.file.buffer, req.file.mimetype);
    const reference = `MANUAL-${String(trato.codigo || trato.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 18)}-${Date.now()}`;
    const paymentMetadata = {
      reference,
      trato_codigo: trato.codigo,
      payment_reference_required: trato.codigo,
      transaction_ref: cleanRef || null,
      transfer_concept: cleanConcept || null,
      reference_in_concept: cleanConcept ? cleanConcept.toUpperCase().includes(String(trato.codigo || '').toUpperCase()) : false,
      method,
      notes,
      receipt_url: receiptUrl,
      receipt_name: req.file.originalname,
      receipt_mimetype: req.file.mimetype,
      amount_expected: amountCop,
      seller_receives: commission.monto_neto,
      commission_visible: commission.monto_comision,
      commission_base: commission.comision_tratoya,
      costo_gmf: commission.costo_gmf,
      reported_at: new Date().toISOString(),
      review_sla_hours: 1,
    };

    const intent = await PaymentIntent.create({
      provider: 'manual',
      reference,
      amount_cents: Math.round(amountCop * 100),
      amount_cop: amountCop,
      currency: 'COP',
      status: 'PAYMENT_REPORTED',
      deal_id: trato.id,
      created_by_user_id: req.user.id,
      raw_response: paymentMetadata,
    });

    await Pago.create({
      trato_id: trato.id,
      usuario_id: req.user.id,
      tipo: 'retencion',
      monto: amountCop,
      pasarela: 'transferencia',
      pasarela_ref: cleanRef || trato.codigo,
      pasarela_estado: 'REPORTED',
      metodo_pago: method === 'nequi' ? 'nequi' : 'transferencia',
      estado: 'procesando',
      comision_pasarela: 0,
      neto_desembolso: commission.monto_neto,
      metadata: { ...paymentMetadata, payment_intent_id: intent.id },
    });

    await trato.update({
      estado: 'pago_pendiente',
      metadata: {
        ...(trato.metadata || {}),
        manual_payment: paymentMetadata,
        payment_status: 'PAGO_REPORTADO',
      },
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: 'MANUAL_PAYMENT_REPORTED',
      entity_type: 'payment_intent',
      entity_id: intent.id,
      metadata: { deal_id: trato.id, reference, transaction_ref: cleanRef, amount_cop: amountCop },
    });

    res.json({
      success: true,
      ok: true,
      message: 'Pago reportado. Lo revisaremos en máximo 1 hora.',
      data: {
        reference,
        amountCop,
        transactionRef: cleanRef,
        reviewSlaHours: 1,
        status: 'PAYMENT_REPORTED',
      },
    });
  } catch (err) { next(err); }
});

paymentsRouter.post('/create-order/:trato_id', async (req, res, next) => {
  return res.status(410).json({ success: false, message: 'Este endpoint fue desactivado. Usa /api/payments/manual/report.' });
});

paymentsRouter.post('/create-order-disabled/:trato_id', async (req, res, next) => {
  try {
    const trato = await Trato.findByPk(req.params.trato_id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    if (trato.comprador_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Solo el comprador puede pagar' });
    }
    if (!['activo', 'pago_pendiente'].includes(trato.estado)) {
      return res.status(400).json({ success: false, message: `No se puede pagar un trato en estado ${trato.estado}` });
    }

    const { crearOrdenWompi } = require('../services/pagoService');
    const orden = await crearOrdenWompi(trato);

    await trato.update({ estado: 'pago_pendiente' });
    const pagoExistente = await Pago.findOne({
      where: { trato_id: trato.id, tipo: 'retencion', estado: { [Op.in]: ['pendiente', 'procesando'] } },
      order: [['createdAt', 'DESC']],
    });
    if (pagoExistente) {
      await pagoExistente.update({
        pasarela_ref: orden.reference,
        pasarela_estado: 'PENDING',
        metadata: { ...(pagoExistente.metadata || {}), checkoutUrl: orden.checkoutUrl, demoMode: orden.demoMode },
      });
    } else {
      await Pago.create({
        trato_id: trato.id,
        usuario_id: req.user.id,
        tipo: 'retencion',
        monto: trato.monto,
        pasarela: 'wompi',
        pasarela_ref: orden.reference,
        pasarela_estado: 'PENDING',
        estado: 'pendiente',
        metadata: { checkoutUrl: orden.checkoutUrl, demoMode: orden.demoMode },
      });
    }
    res.json({ success: true, data: orden });
  } catch (err) { next(err); }
});

paymentsRouter.get('/status/:transaction_id', async (req, res, next) => {
  return res.status(410).json({ success: false, message: 'La verificación Wompi fue desactivada. Usa /api/payments/status?reference=...' });
});

paymentsRouter.get('/status-disabled/:transaction_id', async (req, res, next) => {
  try {
    const { verificarTransaccionWompi, registrarPagoAprobado } = require('../services/pagoService');
    const trx = await verificarTransaccionWompi(req.params.transaction_id);
    const codigo = (trx.reference || '').split('-')[0];
    const trato = await Trato.findOne({ where: { codigo } });
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado para esta transacción' });

    if (trx.status === 'APPROVED') {
      await registrarPagoAprobado({
        trato,
        reference: trx.reference,
        transactionId: trx.id,
        amountInCents: trx.amount_in_cents,
        payload: trx,
        metodoPago: trx.payment_method_type || null,
      });
    }
    res.json({ success: true, data: { transaction: trx, trato_estado: trato.estado } });
  } catch (err) { next(err); }
});

paymentsRouter.post('/sandbox-approve/:trato_id', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.BETA_ALLOW_SANDBOX_PAYMENTS !== 'true') {
      return res.status(403).json({ success: false, message: 'Simulación no disponible en producción' });
    }
    const trato = await Trato.findByPk(req.params.trato_id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    const rol = req.user.rol || (req.user.is_admin ? 'admin' : 'user');
    const esComprador = trato.comprador_id === req.user.id;
    const esCreador = trato.vendedor_id === req.user.id;
    const esOperadorBeta = esCreador || req.user.is_admin || ['admin', 'superadmin'].includes(rol);
    if (!esComprador && !esOperadorBeta) {
      return res.status(403).json({ success: false, message: 'Solo el comprador puede pagar' });
    }
    if (!trato.comprador_id && esOperadorBeta) {
      await trato.update({ comprador_id: req.user.id, estado: 'activo', fecha_activado: new Date() });
    }
    const pago = await Pago.findOne({
      where: { trato_id: trato.id, tipo: 'retencion' },
      order: [['createdAt', 'DESC']],
    });
    const reference = pago?.pasarela_ref || `${trato.codigo}-SANDBOX`;
    const { registrarPagoAprobado } = require('../services/pagoService');
    await registrarPagoAprobado({
      trato,
      reference,
      transactionId: `sandbox-${Date.now()}`,
      amountInCents: Math.round(parseFloat(trato.monto) * 100),
      payload: { status: 'APPROVED', sandbox: true, reference },
      metodoPago: req.body?.metodo_pago || 'pse',
    });
    const { notificar } = require('../services/notificacionService');
    const { notificarAmbos } = require('../services/notificacionService');
    await notificarAmbos(
      trato.comprador_id, trato.vendedor_id, 'pago_retenido',
      {
        titulo: '🔒 Pago retenido',
        cuerpo: `Tu pago de $${parseFloat(trato.monto).toLocaleString('es-CO')} COP está seguro en TratoYa.`,
        metadata: { trato_id: trato.id },
        sms_evento: 'pago_retenido_comprador',
        sms_params: { codigo: trato.codigo },
      },
      {
        titulo: '🔒 Pago retenido — procede a entregar',
        cuerpo: `$${parseFloat(trato.monto).toLocaleString('es-CO')} COP del trato ${trato.codigo} están seguros. Envía el producto.`,
        metadata: { trato_id: trato.id, sandbox: true },
        sms_evento: 'pago_retenido_vendedor',
        sms_params: { codigo: trato.codigo, monto: trato.monto },
      }
    );
    res.json({ success: true, message: 'Pago sandbox aprobado y retenido', data: { trato_id: trato.id, estado: 'pago_retenido' } });
  } catch (err) { next(err); }
});

paymentsRouter.get('/history', async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const tratos = await Trato.findAll({
      where: { [Op.or]: [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }] },
      attributes: ['id', 'codigo', 'titulo', 'monto', 'estado'],
    });
    const tratoIds = tratos.map(t => t.id);
    const tratoMap = Object.fromEntries(tratos.map(t => [t.id, t]));

    // PaymentIntents — estado real de cada cobro ePayco
    const intents = await PaymentIntent.findAll({
      where: { deal_id: { [Op.in]: tratoIds } },
      order: [['createdAt', 'DESC']],
    });

    // Pagos confirmados (webhook)
    const pagos = await Pago.findAll({
      where: { trato_id: { [Op.in]: tratoIds } },
      order: [['createdAt', 'DESC']],
    });

    // Unificar en una sola lista normalizada con el estado real
    const normalize = (item, source) => {
      if (source === 'intent') {
        const trato = tratoMap[item.deal_id] || {};
        // Mapear status de ePayco al estado mostrado en UI
        const statusMap = {
          PAID: 'aprobado', PAYMENT_PENDING: 'pendiente', CREATED: 'creado',
          PAYMENT_REPORTED: 'procesando', PAYMENT_DECLINED: 'rechazado', PAYMENT_ERROR: 'error', PAYMENT_VOIDED: 'anulado',
        };
        return {
          id: item.id,
          tipo: 'cargo',
          monto: item.amount_cop,
          pasarela: item.provider || 'epayco',
          estado: statusMap[item.status] || item.status?.toLowerCase() || 'pendiente',
          estado_raw: item.status,
          referencia: item.reference,
          Trato: { codigo: trato.codigo, titulo: trato.titulo },
          createdAt: item.createdAt,
          _source: 'intent',
        };
      }
      const trato = tratoMap[item.trato_id] || {};
      return { ...item.toJSON(), Trato: { codigo: trato.codigo, titulo: trato.titulo }, _source: 'pago' };
    };

    const history = [
      ...intents.map(i => normalize(i, 'intent')),
      ...pagos.map(p => normalize(p, 'pago')),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: history });
  } catch (err) { next(err); }
});

module.exports.payments = paymentsRouter;


// =============================================
// MESSAGES ROUTE — src/routes/messages.js
// =============================================
const messagesRouter = express.Router();
const { Mensaje } = require('../config/database');
const { body: bodyMsg, validationResult: validMsg } = require('express-validator');

messagesRouter.use(auth);

messagesRouter.get('/:trato_id', async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const trato = await Trato.findOne({
      where: {
        id: req.params.trato_id,
        [Op.or]: [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }],
      }
    });
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });

    const msgs = await Mensaje.findAll({
      where: { trato_id: req.params.trato_id },
      include: [{ model: User, as: 'remitente', attributes: ['id','nombre','foto_perfil'] }],
      order: [['createdAt', 'ASC']],
    });
    res.json({ success: true, data: msgs });
  } catch (err) { next(err); }
});

messagesRouter.post('/:trato_id', [
  bodyMsg('contenido').notEmpty().trim().withMessage('Mensaje vacío'),
], async (req, res, next) => {
  const errors = validMsg(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => e.msg);
    return res.status(400).json({ success: false, message: msgs[0], errors: errors.array() });
  }
  try {
    const { Op } = require('sequelize');
    const trato = await Trato.findOne({
      where: {
        id: req.params.trato_id,
        [Op.or]: [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }],
      }
    });
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });

    const msg = await Mensaje.create({
      trato_id: req.params.trato_id,
      remitente_id: req.user.id,
      contenido: req.body.contenido,
      tipo: req.body.tipo || 'texto',
    });
    const receptor = trato.comprador_id === req.user.id ? trato.vendedor_id : trato.comprador_id;
    if (receptor) {
      const { notificar } = require('../services/notificacionService');
      await notificar(receptor, 'mensaje_trato', {
        titulo: `Nuevo mensaje en ${trato.codigo}`,
        cuerpo: req.body.contenido.slice(0, 160),
        metadata: { trato_id: trato.id, mensaje_id: msg.id },
      }).catch(() => {});
    }
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
});

module.exports.messages = messagesRouter;


// =============================================
// REVIEWS ROUTE — src/routes/reviews.js
// =============================================
const reviewsRouter = express.Router();
reviewsRouter.use(auth);

async function recalcularReputacionPorResenas(userId) {
  const { User, Resena } = require('../config/database');
  const resenas = await Resena.findAll({ where: { destinatario_id: userId } });
  const user = await User.findByPk(userId);
  if (!user) return;
  if (!resenas.length) return user.update({ total_resenas: 0 });
  const promedio = resenas.reduce((s, r) => s + Number(r.calificacion || 0), 0) / resenas.length;
  const exitosos = Number(user.tratos_exitosos || 0);
  const bonusExperiencia = Math.min(0.25, exitosos * 0.01);
  const reputacion = Math.min(5, Math.max(1, promedio + bonusExperiencia));
  await user.update({ reputacion: reputacion.toFixed(2), total_resenas: resenas.length });
}

reviewsRouter.get('/deal/:trato_id', async (req, res, next) => {
  try {
    const { Trato, Resena, User } = require('../config/database');
    const trato = await Trato.findByPk(req.params.trato_id);
    if (!trato || ![trato.comprador_id, trato.vendedor_id].includes(req.user.id)) {
      return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    }
    const resenas = await Resena.findAll({
      where: { trato_id: trato.id },
      include: [
        { model: User, as: 'autor', attributes: ['id', 'nombre', 'apellido'] },
        { model: User, as: 'destinatario', attributes: ['id', 'nombre', 'apellido'] },
      ],
      order: [['createdAt', 'DESC']],
    }).catch(async () => Resena.findAll({ where: { trato_id: trato.id }, order: [['createdAt', 'DESC']] }));
    res.json({ success: true, data: resenas });
  } catch (err) { next(err); }
});

reviewsRouter.post('/deal/:trato_id', async (req, res, next) => {
  try {
    const { Trato, Resena } = require('../config/database');
    const { calificacion, comentario = '' } = req.body;
    const rating = Number(calificacion);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'La valoración debe estar entre 1 y 5 estrellas' });
    }
    const trato = await Trato.findByPk(req.params.trato_id);
    if (!trato || ![trato.comprador_id, trato.vendedor_id].includes(req.user.id)) {
      return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    }
    if (trato.estado !== 'completado') {
      return res.status(400).json({ success: false, message: 'Solo puedes reseñar tratos completados' });
    }
    const destinatarioId = req.user.id === trato.comprador_id ? trato.vendedor_id : trato.comprador_id;
    if (!destinatarioId) return res.status(400).json({ success: false, message: 'El trato no tiene contraparte para reseñar' });

    const [resena, created] = await Resena.findOrCreate({
      where: { trato_id: trato.id, autor_id: req.user.id },
      defaults: {
        trato_id: trato.id,
        autor_id: req.user.id,
        destinatario_id: destinatarioId,
        calificacion: rating,
        comentario: comentario.trim().slice(0, 1000),
      },
    });
    if (!created) {
      await resena.update({ calificacion: rating, comentario: comentario.trim().slice(0, 1000), destinatario_id: destinatarioId });
    }
    await recalcularReputacionPorResenas(destinatarioId);
    res.status(created ? 201 : 200).json({ success: true, data: resena, message: created ? 'Reseña publicada' : 'Reseña actualizada' });
  } catch (err) { next(err); }
});

module.exports.reviews = reviewsRouter;


// =============================================
// DISPUTES ROUTE — src/routes/disputes.js
// =============================================
const disputesRouter = express.Router();
const { Disputa } = require('../config/database');
const { body: bodyD, validationResult: validD } = require('express-validator');
const dayjs = require('dayjs');

disputesRouter.use(auth);

disputesRouter.post('/', [
  bodyD('trato_id').isUUID().withMessage('trato_id inválido'),
  bodyD('motivo').notEmpty().withMessage('Motivo requerido'),
  bodyD('descripcion').isLength({ min: 20 }).withMessage('Descripción mínimo 20 caracteres'),
  bodyD('tipo').isIn(['producto_danado','no_recibido','diferente','servicio_incompleto','fraude','otro']),
], async (req, res, next) => {
  const errors = validD(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => e.msg);
    return res.status(400).json({ success: false, message: msgs[0], errors: errors.array() });
  }
  try {
    const { trato_id, motivo, descripcion, tipo } = req.body;
    const { Op } = require('sequelize');
    const trato = await Trato.findOne({
      where: { id: trato_id, [Op.or]: [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }] }
    });
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });

    const yaExiste = await Disputa.findOne({ where: { trato_id } });
    if (yaExiste) return res.status(400).json({ success: false, message: 'Ya existe una disputa para este trato' });

    const disputa = await Disputa.create({
      trato_id, abierta_por: req.user.id,
      motivo, descripcion, tipo,
      fecha_limite: dayjs().add(72, 'hour').toDate(),
    });

    await trato.update({ estado: 'disputado' });

    const contraparte = trato.comprador_id === req.user.id ? trato.vendedor_id : trato.comprador_id;
    const { notificar } = require('../services/notificacionService');
    await notificar(contraparte, 'disputa_abierta', {
      titulo: '⚖️ Disputa abierta en tu trato',
      cuerpo: `El trato "${trato.titulo}" tiene una disputa. Responderemos en máximo 72h.`,
      metadata: { disputa_id: disputa.id, trato_id },
    });

    res.status(201).json({ success: true, message: 'Disputa abierta. Un mediador revisará en 72 horas.', data: disputa });
  } catch (err) { next(err); }
});

disputesRouter.get('/', async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const disputas = await Disputa.findAll({
      include: [{
        model: Trato,
        where: { [Op.or]: [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }] },
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: disputas });
  } catch (err) { next(err); }
});

module.exports.disputes = disputesRouter;


// =============================================
// KYC ROUTE — src/routes/kyc.js
// =============================================
const kycRouter = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

kycRouter.use(auth);

kycRouter.post('/upload', upload.fields([
  { name: 'cedula_frente', maxCount: 1 },
  { name: 'cedula_reverso', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const { s3Upload } = require('../services/s3Service');
    const updates = { kyc_estado: 'en_revision' };

    for (const [field, files] of Object.entries(req.files || {})) {
      const file = files[0];
      const ext = file.originalname.split('.').pop();
      const key = `kyc/${req.user.id}/${field}-${Date.now()}.${ext}`;
      updates[`${field}_url`] = await s3Upload(key, file.buffer, file.mimetype);
    }

    if (req.body.cedula) updates.cedula = req.body.cedula;
    if (req.body.fecha_nacimiento) updates.fecha_nacimiento = req.body.fecha_nacimiento;

    // En desarrollo: aprobar automáticamente
    if (process.env.NODE_ENV === 'development') {
      updates.kyc_nivel = 'basico';
      updates.kyc_estado = 'aprobado';
      updates.kyc_verificado_en = new Date();
    }

    await req.user.update(updates);
    res.json({ success: true, message: 'Documentos recibidos y verificados (modo desarrollo).' });
  } catch (err) { next(err); }
});

kycRouter.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      kyc_nivel: req.user.kyc_nivel,
      kyc_estado: req.user.kyc_estado,
      kyc_verificado_en: req.user.kyc_verificado_en,
      email_verificado: req.user.email_verificado,
      telefono_verificado: req.user.telefono_verificado,
    }
  });
});

module.exports.kyc = kycRouter;


// =============================================
// ADMIN ROUTE — src/routes/admin.js
// =============================================
const adminRouter = express.Router();

adminRouter.use(auth);
adminRouter.use((req, res, next) => {
  const rol = req.user.rol || (req.user.is_admin ? 'admin' : 'user');
  if (!req.user.is_admin && !['admin', 'superadmin'].includes(rol)) {
    return res.status(403).json({ success: false, message: 'Acceso de administrador requerido' });
  }
  next();
});

const requireSuperadmin = (req, res, next) => {
  if (req.user.rol !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Acceso de superadmin requerido' });
  }
  next();
};

const ADMIN_ROLES = ['invitado', 'user', 'soporte', 'moderador', 'admin', 'superadmin'];

const cleanUser = (user) => {
  const data = user.toJSON ? user.toJSON() : user;
  const rol = data.rol || (data.is_admin ? 'admin' : 'user');
  const estado = data.is_blocked ? 'suspendido' : data.is_active ? 'activo' : 'inactivo';
  delete data.password_hash;
  delete data.refresh_token;
  return { ...data, rol, estado, require_2fa: data.require_2fa || false };
};

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const { Trato, Pago, Disputa } = require('../config/database');
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const inicioMes = new Date(inicioHoy.getFullYear(), inicioHoy.getMonth(), 1);
    const [totalUsers, totalTratos, totalPagos, disputasAbiertas, kycPendientes, registrosHoy, tratosHoy, pagosHoy, comisionesMes] = await Promise.all([
      User.count(),
      Trato.count(),
      Pago.sum('monto', { where: { estado: 'aprobado' } }),
      Disputa.count({ where: { estado: { [Op.in]: ['abierta', 'en_revision', 'esperando_info'] } } }),
      User.count({ where: { kyc_estado: { [Op.in]: ['pendiente', 'en_revision'] } } }),
      User.count({ where: { createdAt: { [Op.gte]: inicioHoy } } }),
      Trato.count({ where: { createdAt: { [Op.gte]: inicioHoy } } }),
      Pago.count({ where: { createdAt: { [Op.gte]: inicioHoy } } }),
      Pago.sum('monto', { where: { tipo: 'comision', estado: 'aprobado', createdAt: { [Op.gte]: inicioMes } } }),
    ]);
    res.json({
      success: true,
      data: {
        usuarios: totalUsers,
        totalUsers,
        tratos: totalTratos,
        totalTratos,
        volumen: Number(totalPagos || 0),
        totalPagos: Number(totalPagos || 0),
        disputas_abiertas: disputasAbiertas,
        kyc_pendientes: kycPendientes,
        registros_hoy: registrosHoy,
        tratos_hoy: tratosHoy,
        pagos_hoy: pagosHoy,
        comisiones_mes: Number(comisionesMes || 0),
      }
    });
  } catch (err) { next(err); }
});

adminRouter.get('/reviews', async (req, res, next) => {
  try {
    const { Resena, Trato, User } = require('../config/database');
    let resenas = [];
    try {
      resenas = await Resena.findAll({
        include: [
          { model: Trato, attributes: ['id', 'codigo', 'titulo', 'estado'] },
          { model: User, as: 'autor', attributes: ['id', 'nombre', 'apellido', 'email'] },
          { model: User, as: 'destinatario', attributes: ['id', 'nombre', 'apellido', 'email'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: 100,
      });
    } catch {
      resenas = await Resena.findAll({ order: [['createdAt', 'DESC']], limit: 100 });
    }
    res.json({ success: true, data: resenas });
  } catch (err) { next(err); }
});

adminRouter.get('/tratos', async (req, res, next) => {
  try {
    const { Trato, User } = require('../config/database');
    const { q } = req.query;
    const where = {};
    if (q) {
      where[Op.or] = [
        { codigo: { [Op.iLike]: `%${q}%` } },
        { titulo: { [Op.iLike]: `%${q}%` } },
      ];
    }
    const partyAttrs = ['id', 'nombre', 'apellido', 'email', 'telefono', 'usuario_unico', 'tipo_identificacion', 'cedula'];
    const tratos = await Trato.findAll({
      where,
      include: [
        { model: User, as: 'vendedor', attributes: partyAttrs },
        { model: User, as: 'comprador', attributes: partyAttrs },
      ],
      order: [['createdAt', 'DESC']],
      limit: 250,
    });
    res.json({ success: true, data: tratos });
  } catch (err) { next(err); }
});

adminRouter.get('/tratos/:id/detalle', async (req, res, next) => {
  try {
    const {
      Trato, User, Pago, PaymentIntent, PaymentEvent, LedgerEntry, CuentaBancaria,
      AuditLog, Disputa, Mensaje, Resena
    } = require('../config/database');
    const userAttrs = [
      'id', 'nombre', 'apellido', 'email', 'telefono', 'usuario_unico', 'tipo_identificacion', 'cedula',
      'rol', 'estado', 'kyc_nivel', 'kyc_estado', 'reputacion',
      'total_resenas', 'total_tratos', 'tratos_exitosos', 'createdAt'
    ];
    let trato = await Trato.findByPk(req.params.id, {
      include: [
        { model: User, as: 'vendedor', attributes: userAttrs },
        { model: User, as: 'comprador', attributes: userAttrs },
      ],
    }).catch(() => null);
    if (!trato) {
      trato = await Trato.findByPk(req.params.id);
    }
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });

    const safe = async (label, fn, fallback) => {
      try { return await fn(); }
      catch (error) {
        console.error('ADMIN_DEAL_DETAIL_SECTION_FAILED', label, error.message);
        return fallback;
      }
    };

    const [pagos, intents, ledger, disputa, mensajes, resenas, auditLogs] = await Promise.all([
      safe('pagos', () => Pago.findAll({
        where: { trato_id: trato.id },
        include: [{ model: User, attributes: ['id', 'nombre', 'apellido', 'email'] }],
        order: [['createdAt', 'DESC']],
        limit: 100,
      }), []),
      safe('payment_intents', () => PaymentIntent.findAll({
        where: { deal_id: trato.id },
        include: [{ model: User, as: 'creator', attributes: ['id', 'nombre', 'apellido', 'email'] }],
        order: [['createdAt', 'DESC']],
        limit: 50,
      }), []),
      safe('ledger', () => LedgerEntry.findAll({
        where: { deal_id: trato.id },
        order: [['created_at', 'DESC']],
        limit: 100,
      }), []),
      safe('disputa', () => Disputa.findOne({
        where: { trato_id: trato.id },
        include: [{ model: User, as: 'aperturista', attributes: ['id', 'nombre', 'apellido', 'email'] }],
        order: [['createdAt', 'DESC']],
      }), null),
      safe('mensajes', () => Mensaje.findAll({
        where: { trato_id: trato.id },
        include: [{ model: User, as: 'remitente', attributes: ['id', 'nombre', 'apellido', 'email', 'rol'] }],
        order: [['createdAt', 'ASC']],
        limit: 250,
      }), []),
      safe('resenas', () => Resena.findAll({
        where: { trato_id: trato.id },
        include: [
          { model: User, as: 'autor', attributes: ['id', 'nombre', 'apellido', 'email'] },
          { model: User, as: 'destinatario', attributes: ['id', 'nombre', 'apellido', 'email'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: 50,
      }), []),
      safe('audit_logs', () => AuditLog.findAll({
        where: { entity_type: { [Op.in]: ['deal', 'trato', 'payment_intent'] }, entity_id: trato.id },
        order: [['created_at', 'DESC']],
        limit: 100,
      }), []),
    ]);

    const refs = intents.map(i => i.reference).filter(Boolean);
    const txIds = intents.map(i => i.wompi_transaction_id).filter(Boolean);
    const paymentEvents = (refs.length || txIds.length)
      ? await safe('payment_events', () => PaymentEvent.findAll({
        where: {
          [Op.or]: [
            ...(refs.length ? [{ reference: { [Op.in]: refs } }] : []),
            ...(txIds.length ? [{ wompi_transaction_id: { [Op.in]: txIds } }] : []),
          ],
        },
        order: [['received_at', 'DESC']],
        limit: 100,
      }), [])
      : [];
    const userIds = [trato.vendedor_id, trato.comprador_id].filter(Boolean);
    const cuentasBancarias = userIds.length ? await safe('cuentas_bancarias', () => CuentaBancaria.findAll({
      where: { usuario_id: { [Op.in]: userIds } },
      order: [['createdAt', 'DESC']],
      limit: 20,
    }), []) : [];

    res.json({
      success: true,
      data: { trato, pagos, payment_intents: intents, payment_events: paymentEvents, ledger, disputa, mensajes, resenas, audit_logs: auditLogs, cuentas_bancarias: cuentasBancarias },
    });
  } catch (err) { next(err); }
});

adminRouter.post('/tratos/:id/cancelar', async (req, res, next) => {
  try {
    const { Trato, Pago } = require('../config/database');
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    await trato.update({ estado: 'cancelado', notas_internas: `Cancelado por admin ${req.user.email}` });
    await Pago.update({ estado: 'reembolsado' }, { where: { trato_id: trato.id, estado: { [Op.in]: ['pendiente', 'procesando', 'aprobado'] } } });
    res.json({ success: true, data: trato, message: 'Trato cancelado' });
  } catch (err) { next(err); }
});

adminRouter.post('/tratos/:id/liberar', paymentUpload.single('release_receipt'), async (req, res, next) => {
  try {
    const { Trato, Pago, User } = require('../config/database');
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    const referenciaLiberacion = String(req.body?.referencia_liberacion || req.body?.referencia || '').trim().slice(0, 120);
    let releaseReceiptUrl = null;
    if (req.file) {
      const { s3Upload } = require('../services/s3Service');
      const safeName = String(req.file.originalname || 'comprobante-liberacion').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const key = `releases/${trato.codigo || trato.id}/${Date.now()}-${safeName}`;
      releaseReceiptUrl = await s3Upload(key, req.file.buffer, req.file.mimetype);
    }
    await trato.update({
      estado: 'completado',
      fecha_liberacion: new Date(),
      notas_internas: `Liberado por admin ${req.user.email}${referenciaLiberacion ? ` · Ref: ${referenciaLiberacion}` : ''}`,
      metadata: {
        ...(trato.metadata || {}),
        release_reference: referenciaLiberacion || undefined,
        release_receipt_url: releaseReceiptUrl || undefined,
        release_receipt_name: req.file?.originalname || undefined,
        release_status: 'LIBERADO',
        released_by_admin_id: req.user.id,
        released_at: new Date().toISOString(),
      },
    });
    if (trato.vendedor_id) {
      await Pago.create({
        trato_id: trato.id,
        usuario_id: trato.vendedor_id,
        tipo: 'liberacion',
        monto: trato.monto_neto || trato.monto,
        pasarela: 'transferencia',
        pasarela_ref: referenciaLiberacion || null,
        pasarela_estado: 'LIBERADO',
        estado: 'aprobado',
        fecha_aprobacion: new Date(),
        fecha_desembolso: new Date(),
        metadata: { admin_id: req.user.id, referencia_liberacion: referenciaLiberacion || null, release_receipt_url: releaseReceiptUrl, release_receipt_name: req.file?.originalname || null },
      });
    }
    const { notificarAmbos } = require('../services/notificacionService');
    await notificarAmbos(
      trato.comprador_id,
      trato.vendedor_id,
      'pago_liberado',
      {
        titulo: 'Pago liberado',
        cuerpo: `El pago del trato ${trato.codigo} fue liberado. Se verá reflejado máximo en 1 hora.`,
        metadata: { trato_id: trato.id, referencia_liberacion: referenciaLiberacion || null, release_receipt_url: releaseReceiptUrl },
      },
      {
        titulo: 'Pago liberado a tu favor',
        cuerpo: `Liberamos los fondos del trato ${trato.codigo}. Se verá reflejado máximo en 1 hora.`,
        metadata: { trato_id: trato.id, referencia_liberacion: referenciaLiberacion || null, release_receipt_url: releaseReceiptUrl },
      }
    ).catch(() => {});
    await actualizarReputacionUsuarios(trato, User).catch(() => {});
    res.json({ success: true, data: trato, message: 'Pago liberado' });
  } catch (err) { next(err); }
});

adminRouter.post('/pagos/:id/confirmar', async (req, res, next) => {
  try {
    const { Pago, Trato, PaymentIntent, LedgerEntry, AuditLog } = require('../config/database');
    const pago = await Pago.findByPk(req.params.id);
    if (!pago) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    const trato = await Trato.findByPk(pago.trato_id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    const metadata = pago.metadata || {};
    const reference = metadata.reference;

    await pago.update({
      estado: 'aprobado',
      pasarela_estado: 'CONFIRMADO',
      fecha_aprobacion: new Date(),
      metadata: {
        ...metadata,
        confirmed_by_admin_id: req.user.id,
        confirmed_at: new Date().toISOString(),
      },
    });
    if (reference) {
      await PaymentIntent.update(
        { status: 'PAID', raw_response: { ...(metadata || {}), confirmed_by_admin_id: req.user.id, confirmed_at: new Date().toISOString() } },
        { where: { reference } }
      ).catch(() => {});
    }
    await trato.update({
      estado: 'pago_retenido',
      fecha_pago: new Date(),
      metadata: {
        ...(trato.metadata || {}),
        payment_status: 'PAGO_CONFIRMADO',
        manual_payment_confirmed_at: new Date().toISOString(),
        manual_payment_confirmed_by: req.user.id,
      },
    });
    await LedgerEntry.create({
      deal_id: trato.id,
      payment_intent_id: metadata.payment_intent_id || null,
      type: 'escrow_manual_received',
      amount_cents: Math.round(Number(pago.monto || 0) * 100),
      description: `Pago manual confirmado por admin para ${trato.codigo}`,
    }).catch(() => {});
    await AuditLog.create({
      user_id: req.user.id,
      action: 'MANUAL_PAYMENT_CONFIRMED',
      entity_type: 'deal',
      entity_id: trato.id,
      metadata: { pago_id: pago.id, reference, transaction_ref: pago.pasarela_ref },
    }).catch(() => {});
    const { notificarAmbos } = require('../services/notificacionService');
    await notificarAmbos(
      trato.comprador_id,
      trato.vendedor_id,
      'pago_retenido',
      {
        titulo: 'Pago confirmado',
        cuerpo: `Tu pago del trato ${trato.codigo} quedó confirmado y en custodia TratoYA.`,
        metadata: { trato_id: trato.id, pago_id: pago.id },
      },
      {
        titulo: 'Pago confirmado, puedes entregar',
        cuerpo: `El pago del trato ${trato.codigo} está en custodia TratoYA. Puedes entregar con seguridad.`,
        metadata: { trato_id: trato.id, pago_id: pago.id },
      }
    ).catch(() => {});
    res.json({ success: true, data: { pago, trato }, message: 'Pago confirmado y retenido' });
  } catch (err) { next(err); }
});

adminRouter.post('/pagos/:id/rechazar', async (req, res, next) => {
  try {
    const { Pago, Trato, PaymentIntent, AuditLog } = require('../config/database');
    const pago = await Pago.findByPk(req.params.id);
    if (!pago) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    const trato = await Trato.findByPk(pago.trato_id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    const metadata = pago.metadata || {};
    await pago.update({
      estado: 'rechazado',
      pasarela_estado: 'RECHAZADO',
      metadata: { ...metadata, rejected_by_admin_id: req.user.id, rejected_at: new Date().toISOString(), retry_after_minutes: 10 },
    });
    if (metadata.reference) await PaymentIntent.update({ status: 'PAYMENT_DECLINED' }, { where: { reference: metadata.reference } }).catch(() => {});
    await trato.update({
      estado: 'activo',
      metadata: { ...(trato.metadata || {}), payment_status: 'PAGO_RECHAZADO', retry_payment_after: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    });
    await AuditLog.create({
      user_id: req.user.id,
      action: 'MANUAL_PAYMENT_REJECTED',
      entity_type: 'deal',
      entity_id: trato.id,
      metadata: { pago_id: pago.id, transaction_ref: pago.pasarela_ref, retry_after_minutes: 10 },
    }).catch(() => {});
    const { notificar } = require('../services/notificacionService');
    await notificar(trato.comprador_id, 'pago_rechazado', {
      titulo: 'Pago no verificado',
      cuerpo: `No pudimos verificar el pago del trato ${trato.codigo}. Podrás intentarlo de nuevo en 10 minutos.`,
      metadata: { trato_id: trato.id, pago_id: pago.id },
    }).catch(() => {});
    res.json({ success: true, data: { pago, trato }, message: 'Pago rechazado. Reintento en 10 minutos.' });
  } catch (err) { next(err); }
});

async function actualizarReputacionUsuarios(trato, UserModel) {
  const ids = [trato.comprador_id, trato.vendedor_id].filter(Boolean);
  for (const id of ids) {
    const user = await UserModel.findByPk(id);
    if (!user) continue;
    const total = Number(user.total_tratos || 0) + 1;
    const exitosos = Number(user.tratos_exitosos || 0) + 1;
    const score = Math.min(5, 3.6 + Math.min(exitosos, 20) * 0.07 + Math.max(0, exitosos - 20) * 0.015);
    await user.update({ total_tratos: total, tratos_exitosos: exitosos, reputacion: score.toFixed(2) });
  }
}

adminRouter.post('/tratos/:id/contactar', async (req, res, next) => {
  try {
    const { destino = 'ambos', titulo = 'Mensaje de soporte TratoYA', cuerpo } = req.body;
    if (!cuerpo || cuerpo.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Mensaje requerido' });
    }
    const { Trato, User, Mensaje } = require('../config/database');
    const trato = await Trato.findByPk(req.params.id, {
      include: [
        { model: User, as: 'comprador', attributes: ['id', 'nombre', 'apellido', 'email'] },
        { model: User, as: 'vendedor', attributes: ['id', 'nombre', 'apellido', 'email'] },
      ],
    });
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    const targets = [];
    if (['comprador', 'ambos'].includes(destino) && trato.comprador_id) targets.push(trato.comprador_id);
    if (['vendedor', 'ambos'].includes(destino) && trato.vendedor_id) targets.push(trato.vendedor_id);
    const uniqueTargets = [...new Set(targets)];
    if (!uniqueTargets.length) return res.status(400).json({ success: false, message: 'El trato aún no tiene destinatarios disponibles' });

    const { notificar } = require('../services/notificacionService');
    await Promise.all(uniqueTargets.map(usuario_id => notificar(usuario_id, 'admin_trato', {
      titulo,
      cuerpo,
      metadata: { trato_id: trato.id, creado_por: req.user.id, destino, from_admin: true, sender_label: 'Soporte - TratoYA' },
    })));
    await Mensaje.create({
      trato_id: trato.id,
      remitente_id: req.user.id,
      tipo: 'sistema',
      contenido: `[Soporte TratoYA] ${cuerpo}`,
    });
    res.status(201).json({ success: true, data: { enviados: uniqueTargets.length }, message: 'Mensaje enviado' });
  } catch (err) { next(err); }
});

adminRouter.get('/pagos', async (req, res, next) => {
  try {
    const { Pago, Trato, User } = require('../config/database');
    const { q } = req.query;
    const tratoWhere = q ? {
      [Op.or]: [
        { codigo: { [Op.iLike]: `%${q}%` } },
        { titulo: { [Op.iLike]: `%${q}%` } },
      ],
    } : undefined;
    const tratoInclude = {
      model: Trato,
      attributes: ['id', 'codigo', 'titulo', 'estado', 'monto', 'monto_neto', 'vendedor_id', 'comprador_id', 'metadata'],
      include: [
        { model: User, as: 'vendedor', attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'usuario_unico'] },
        { model: User, as: 'comprador', attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'usuario_unico'] },
      ],
    };
    if (tratoWhere) tratoInclude.where = tratoWhere;
    const pagos = await Pago.findAll({
      include: [
        tratoInclude,
        { model: User, attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'usuario_unico'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 250,
    });
    res.json({ success: true, data: pagos.map(p => {
      const json = p.toJSON();
      json.referencia_externa = json.pasarela_ref;
      return json;
    }) });
  } catch (err) { next(err); }
});

adminRouter.get('/disputes', async (req, res, next) => {
  try {
    const { Disputa, Trato, User } = require('../config/database');
    const disputas = await Disputa.findAll({
      include: [
        { model: Trato, include: [
          { model: User, as: 'comprador', attributes: ['id', 'nombre', 'apellido', 'email'] },
          { model: User, as: 'vendedor', attributes: ['id', 'nombre', 'apellido', 'email'] },
        ] },
        { model: User, as: 'aperturista', attributes: ['id', 'nombre', 'apellido', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json({ success: true, data: disputas.map(d => {
      const json = d.toJSON();
      if (json.estado === 'cerrada') json.estado = 'resuelta';
      return json;
    }) });
  } catch (err) { next(err); }
});

adminRouter.post('/disputes/:id/resolver', async (req, res, next) => {
  try {
    const { Disputa, Trato } = require('../config/database');
    const disputa = await Disputa.findByPk(req.params.id);
    if (!disputa) return res.status(404).json({ success: false, message: 'Disputa no encontrada' });
    const resolucion = req.body.fallo === 'vendedor' ? 'favor_vendedor' : req.body.fallo === 'split' ? 'acuerdo_mutuo' : 'favor_comprador';
    await disputa.update({
      estado: 'cerrada',
      resolucion,
      notas_mediador: req.body.notas,
      mediador_id: req.user.id,
      fecha_resolucion: new Date(),
    });
    const trato = await Trato.findByPk(disputa.trato_id);
    if (trato) await trato.update({ estado: req.body.fallo === 'vendedor' ? 'completado' : 'cancelado' });
    res.json({ success: true, data: disputa, message: 'Disputa resuelta' });
  } catch (err) { next(err); }
});

adminRouter.get('/kyc/pendientes', async (req, res, next) => {
  try {
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { kyc_estado: { [Op.in]: ['pendiente', 'en_revision'] } },
          { cedula_frente_url: { [Op.ne]: null } },
          { selfie_url: { [Op.ne]: null } },
        ],
      },
      order: [['updatedAt', 'DESC']],
      limit: 100,
    });
    const data = users.map(u => {
      const json = cleanUser(u);
      return { ...json, User: json };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

adminRouter.post('/kyc/:id/aprobar', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({ kyc_estado: 'aprobado', kyc_nivel: 'basico', kyc_verificado_en: new Date() });
    res.json({ success: true, data: cleanUser(user), message: 'KYC aprobado' });
  } catch (err) { next(err); }
});

adminRouter.post('/kyc/:id/rechazar', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({ kyc_estado: 'rechazado' });
    res.json({ success: true, data: cleanUser(user), message: 'KYC rechazado' });
  } catch (err) { next(err); }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const { q, estado } = req.query;
    const where = {};
    if (q) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${q}%` } },
        { apellido: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
        { usuario_unico: { [Op.iLike]: `%${q}%` } },
        { cedula: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (estado === 'suspendido') where.is_blocked = true;
    if (estado === 'activo') { where.is_active = true; where.is_blocked = false; }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    const userIds = users.map(u => u.id);
    let cuentasMap = {};
    if (userIds.length > 0) {
      try {
        const cuentas = await CuentaBancaria.findAll({
          where: { usuario_id: { [Op.in]: userIds } },
          order: [['createdAt', 'DESC']],
        });
        cuentas.forEach(c => {
          if (!cuentasMap[c.usuario_id]) cuentasMap[c.usuario_id] = [];
          if (cuentasMap[c.usuario_id].length < 5) cuentasMap[c.usuario_id].push(c.toJSON());
        });
      } catch { /* no crash si la tabla de cuentas no está disponible */ }
    }
    const data = users.map(u => {
      const clean = cleanUser(u);
      clean.CuentaBancarias = cuentasMap[u.id] || [];
      return clean;
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

adminRouter.get('/users/:id/detalle', async (req, res, next) => {
  try {
    const { Trato, Pago } = require('../config/database');
    const user = await User.findByPk(req.params.id, {
      include: [{ model: CuentaBancaria, separate: true, order: [['createdAt', 'DESC']] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const tratos = await Trato.findAll({
      where: { [Op.or]: [{ comprador_id: user.id }, { vendedor_id: user.id }] },
      include: [
        { model: User, as: 'comprador', attributes: ['id', 'nombre', 'apellido', 'email', 'usuario_unico'] },
        { model: User, as: 'vendedor', attributes: ['id', 'nombre', 'apellido', 'email', 'usuario_unico'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    const pagos = await Pago.findAll({
      where: { usuario_id: user.id },
      include: [{ model: Trato, attributes: ['id', 'codigo', 'titulo', 'estado'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    res.json({ success: true, data: { user: cleanUser(user), cuentas_bancarias: user.CuentaBancaria || user.CuentaBancariae || user.CuentaBancarias || [], tratos, pagos } });
  } catch (err) { next(err); }
});

adminRouter.post('/users', requireSuperadmin, async (req, res, next) => {
  try {
    const { nombre, apellido = '', email, password, telefono, rol = 'user' } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos' });
    }
    if (!ADMIN_ROLES.includes(rol)) {
      return res.status(400).json({ success: false, message: 'Rol inválido' });
    }
    const existe = await User.findOne({ where: { email } });
    if (existe) return res.status(409).json({ success: false, message: 'El email ya está registrado' });

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      nombre,
      apellido,
      email,
      telefono,
      password_hash,
      rol,
      is_admin: ['admin', 'superadmin'].includes(rol),
      is_active: true,
    });
    res.status(201).json({ success: true, data: cleanUser(user), message: 'Usuario creado' });
  } catch (err) { next(err); }
});

adminRouter.patch('/users/:id/rol', requireSuperadmin, async (req, res, next) => {
  try {
    const { rol } = req.body;
    if (!ADMIN_ROLES.includes(rol)) {
      return res.status(400).json({ success: false, message: 'Rol inválido' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({ rol, is_admin: ['admin', 'superadmin'].includes(rol) });
    res.json({ success: true, data: cleanUser(user), message: 'Rol actualizado' });
  } catch (err) { next(err); }
});

adminRouter.patch('/users/:id/credentials', requireSuperadmin, async (req, res, next) => {
  try {
    const { nombre, apellido = '', email, password, rol } = req.body;
    if (!nombre || !email) {
      return res.status(400).json({ success: false, message: 'Nombre y email son requeridos' });
    }
    if (rol && !ADMIN_ROLES.includes(rol)) {
      return res.status(400).json({ success: false, message: 'Rol inválido' });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ success: false, message: 'Contraseña mínimo 6 caracteres' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const emailOwner = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } });
    if (emailOwner) return res.status(409).json({ success: false, message: 'Ese email ya está en uso' });

    const nextRol = rol || user.rol || (user.is_admin ? 'admin' : 'user');
    const updates = {
      nombre,
      apellido,
      email,
      rol: nextRol,
      is_admin: ['admin', 'superadmin'].includes(nextRol),
    };
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 12);
      updates.refresh_token = null;
    }
    if (email !== user.email) updates.refresh_token = null;

    await user.update(updates);
    res.json({ success: true, data: cleanUser(user), message: 'Credenciales actualizadas' });
  } catch (err) { next(err); }
});

adminRouter.patch('/users/:id/estado', async (req, res, next) => {
  try {
    const { estado } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({
      is_active: estado !== 'inactivo',
      is_blocked: estado === 'suspendido',
    });
    res.json({ success: true, data: cleanUser(user), message: 'Estado actualizado' });
  } catch (err) { next(err); }
});

adminRouter.post('/users/:id/reset-password', requireSuperadmin, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Contraseña mínimo 6 caracteres' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({ password_hash: await bcrypt.hash(password, 12), refresh_token: null });
    res.json({ success: true, message: 'Contraseña restablecida' });
  } catch (err) { next(err); }
});

adminRouter.post('/users/:id/notificacion', async (req, res, next) => {
  try {
    const { titulo, cuerpo } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { notificar } = require('../services/notificacionService');
    await notificar(user.id, 'admin', {
      titulo,
      cuerpo,
      metadata: { creado_por: req.user.id, from_admin: true, sender_label: 'Soporte - TratoYA' },
    });
    res.status(201).json({ success: true, data: { usuario_id: user.id }, message: 'Notificación creada' });
  } catch (err) { next(err); }
});

adminRouter.patch('/users/:id/security', requireSuperadmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({ require_2fa: !!req.body.require_2fa });
    res.json({ success: true, data: cleanUser(user), message: 'Seguridad actualizada' });
  } catch (err) { next(err); }
});

adminRouter.patch('/users/:id/kyc', async (req, res, next) => {
  try {
    const { kyc_nivel } = req.body;
    const validLevels = ['ninguno', 'basico', 'verificado', 'premium'];
    if (!validLevels.includes(kyc_nivel)) return res.status(400).json({ success: false, message: 'Nivel KYC inválido. Usa: ninguno, basico, verificado, premium' });
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({
      kyc_nivel,
      kyc_estado: kyc_nivel !== 'ninguno' ? 'aprobado' : 'pendiente',
    });
    res.json({ success: true, data: cleanUser(await User.findByPk(req.params.id, { attributes: { exclude: ['password_hash', 'refresh_token'] } })), message: `Nivel de verificación actualizado a ${kyc_nivel}` });
  } catch (err) { next(err); }
});

adminRouter.post('/users/:id/revoke-sessions', requireSuperadmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await user.update({ refresh_token: null });
    res.json({ success: true, message: 'Sesiones revocadas' });
  } catch (err) { next(err); }
});

adminRouter.post('/notificaciones/masiva', async (req, res, next) => {
  try {
    const { titulo, cuerpo, segmento = 'todos' } = req.body;
    if (!titulo || !cuerpo) return res.status(400).json({ success: false, message: 'Título y mensaje requeridos' });
    const where = {};
    if (segmento === 'sin_kyc') where.kyc_estado = { [Op.ne]: 'aprobado' };
    if (segmento === 'con_trato_activo') {
      // Mantener beta estable: el segmento avanzado se resuelve en una etapa posterior.
    }
    const users = await User.findAll({ where, attributes: ['id'], limit: 1000 });
    const { notificar } = require('../services/notificacionService');
    await Promise.all(users.map(u => notificar(u.id, 'admin_masiva', {
      titulo,
      cuerpo,
      metadata: { segmento, creado_por: req.user.id, from_admin: true, sender_label: 'Soporte - TratoYA' },
    })));
    res.json({ success: true, data: { enviados: users.length }, message: 'Notificación enviada' });
  } catch (err) { next(err); }
});

adminRouter.get('/tickets', async (req, res, next) => {
  try {
    const { TicketSoporte, User } = require('../config/database');
    const tickets = await TicketSoporte.findAll({
      include: [{ model: User, as: 'usuario', attributes: ['id', 'nombre', 'apellido', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json({ success: true, data: tickets });
  } catch (err) { next(err); }
});

adminRouter.post('/tickets', async (req, res, next) => {
  try {
    const { TicketSoporte } = require('../config/database');
    const { usuario_email, categoria = 'general', asunto, descripcion, prioridad = 'media' } = req.body;
    if (!asunto || !descripcion) return res.status(400).json({ success: false, message: 'Asunto y descripción son requeridos' });
    const user = usuario_email ? await User.findOne({ where: { email: usuario_email } }) : null;
    const ticket = await TicketSoporte.create({
      usuario_id: user?.id,
      usuario_email: usuario_email || user?.email,
      categoria,
      asunto,
      descripcion,
      prioridad,
      respuestas: [],
    });
    res.status(201).json({ success: true, data: ticket, message: 'Ticket creado' });
  } catch (err) { next(err); }
});

adminRouter.post('/tickets/:id/respuesta', async (req, res, next) => {
  try {
    const { TicketSoporte } = require('../config/database');
    const ticket = await TicketSoporte.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    const respuestas = Array.isArray(ticket.respuestas) ? ticket.respuestas : [];
    respuestas.push({ contenido: req.body.contenido, admin_id: req.user.id, admin_email: req.user.email, createdAt: new Date().toISOString() });
    await ticket.update({ respuestas, estado: 'en_proceso' });
    res.json({ success: true, data: ticket, message: 'Respuesta guardada' });
  } catch (err) { next(err); }
});

adminRouter.patch('/tickets/:id/estado', async (req, res, next) => {
  try {
    const { TicketSoporte } = require('../config/database');
    const ticket = await TicketSoporte.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    await ticket.update({ estado: req.body.estado });
    res.json({ success: true, data: ticket, message: 'Estado actualizado' });
  } catch (err) { next(err); }
});

adminRouter.get('/logs', async (req, res) => {
  res.json({
    success: true,
    data: [
      { level: 'info', message: 'Panel admin operativo', timestamp: new Date().toISOString() },
      { level: 'info', message: `Último acceso admin: ${req.user.email}`, timestamp: new Date().toISOString() },
    ],
  });
});

adminRouter.put('/configuracion', async (req, res) => {
  res.json({ success: true, data: req.body, message: 'Configuración guardada' });
});

adminRouter.get('/actividad-reciente', async (req, res, next) => {
  try {
    const { Trato, Pago, Disputa } = require('../config/database');
    const [users, tratos, pagos, disputas] = await Promise.all([
      User.findAll({ order: [['createdAt', 'DESC']], limit: 10 }),
      Trato.findAll({ order: [['createdAt', 'DESC']], limit: 10 }),
      Pago.findAll({ order: [['createdAt', 'DESC']], limit: 10 }),
      Disputa.findAll({ order: [['createdAt', 'DESC']], limit: 10 }),
    ]);
    const eventos = [
      ...users.map(u => ({ tipo: 'registro', descripcion: `Nuevo registro: ${u.nombre} ${u.apellido} (${u.email})`, createdAt: u.createdAt, meta: { usuario_id: u.id } })),
      ...tratos.map(t => ({ tipo: 'trato', descripcion: `Trato ${t.codigo || t.id}: ${t.titulo} por ${Number(t.monto || 0).toLocaleString('es-CO')}`, createdAt: t.createdAt, meta: { estado: t.estado } })),
      ...pagos.map(p => ({ tipo: 'pago', descripcion: `Pago ${p.tipo} ${p.estado}: ${Number(p.monto || 0).toLocaleString('es-CO')} COP`, createdAt: p.createdAt, meta: { pasarela: p.pasarela } })),
      ...disputas.map(d => ({ tipo: 'disputa', descripcion: `Disputa ${d.estado}: ${d.motivo}`, createdAt: d.createdAt, meta: { disputa_id: d.id } })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);
    res.json({ success: true, data: eventos });
  } catch (err) { next(err); }
});

module.exports.admin = adminRouter;


// =============================================
// WEBHOOKS — src/routes/webhooks.js
// =============================================
const webhooksRouter = express.Router();
const crypto = require('crypto');
const logger = require('../utils/logger');

function readWebhookPayload(req) {
  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf8');
    try { return JSON.parse(raw || '{}'); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
  }
  return { ...(req.query || {}), ...(req.body || {}) };
}

webhooksRouter.all('/epayco', async (req, res) => {
  let savedEvent = null;
  try {
    logger.info('EPAYCO_WEBHOOK_RECEIVED');
    const payload = readWebhookPayload(req);
    const reference = payload.x_id_invoice || payload.x_extra3 || payload.invoice || payload.reference || null;
    const refPayco = payload.x_ref_payco || payload.ref_payco || null;
    const txId = payload.x_transaction_id || refPayco || null;
    const response = payload.x_response || payload.x_respuesta || null;
    const stateCode = payload.x_cod_transaction_state || payload.x_transaction_state || payload.x_cod_response || null;
    const amount = payload.x_amount || payload.x_amount_ok || null;
    const currency = payload.x_currency_code || 'COP';
    const checksum = payload.x_signature || null;
    const customerId = process.env.EPAYCO_CUSTOMER_ID || process.env.EPAYCO_P_CUST_ID_CLIENTE || process.env.EPAYCO_P_CUST_ID || '';
    const pKey = process.env.EPAYCO_PRIVATE_KEY || process.env.EPAYCO_SECRET_KEY || process.env.EPAYCO_P_KEY || '';
    const expectedChecksum = customerId && pKey && refPayco && txId && amount && currency
      ? crypto.createHash('sha256').update(`${customerId}^${pKey}^${refPayco}^${txId}^${amount}^${currency}`).digest('hex')
      : null;
    const isValidSignature = Boolean(expectedChecksum && checksum && expectedChecksum === checksum);
    const internalStatus = normalizeEpaycoStatus(response, stateCode);

    const duplicateBefore = checksum && txId && internalStatus
      ? await PaymentEvent.findOne({
        where: {
          provider: 'epayco',
          wompi_transaction_id: txId,
          status: internalStatus,
          event_checksum: checksum,
          is_valid_signature: true,
        },
      })
      : null;

    savedEvent = await PaymentEvent.create({
      provider: 'epayco',
      event_type: 'transaction.updated',
      event_checksum: checksum,
      wompi_transaction_id: txId,
      reference,
      status: internalStatus,
      raw_payload: payload,
      received_at: new Date(),
      is_valid_signature: isValidSignature,
    });

    if (!isValidSignature) {
      logger.warn(`EPAYCO_WEBHOOK_SIGNATURE_INVALID ${reference || 'sin-reference'}`);
      await savedEvent.update({ processing_error: 'Firma ePayco inválida' });
      return res.status(400).json({ received: false });
    }
    logger.info(`EPAYCO_WEBHOOK_SIGNATURE_VALID ${reference || 'sin-reference'}`);

    const intent = await PaymentIntent.findOne({ where: { reference, provider: 'epayco' } });
    if (!intent) {
      await savedEvent.update({ processed_at: new Date(), processing_error: 'payment_intent no encontrado' });
      return res.json({ received: true });
    }

    const amountCents = Math.round(Number(amount || 0) * 100);
    if (amountCents !== Number(intent.amount_cents)) {
      await savedEvent.update({ processed_at: new Date(), processing_error: 'Monto no coincide' });
      return res.status(400).json({ received: false });
    }
    if (currency !== intent.currency || currency !== 'COP') {
      await savedEvent.update({ processed_at: new Date(), processing_error: 'Moneda no válida' });
      return res.status(400).json({ received: false });
    }

    const trato = await Trato.findByPk(intent.deal_id);
    const alreadyPaid = intent.status === 'PAID' && internalStatus === 'PAID';
    await intent.update({
      status: internalStatus,
      wompi_transaction_id: txId,
      raw_response: payload,
    });

    if (!duplicateBefore && !alreadyPaid && internalStatus === 'PAID') {
      let commission = null;
      if (trato) {
        try {
          const { calcularComision } = require('../services/comisionService');
          commission = calcularComision(Number(trato.monto || 0), trato.quien_paga_comision || 'comprador');
        } catch (commissionErr) {
          logger.warn(`EPAYCO_COMMISSION_RECALC_FAILED ${reference}: ${commissionErr.message}`);
        }
      }
      if (trato) {
        await trato.update({
          estado: 'pago_retenido',
          fecha_pago: new Date(),
          metadata: {
            ...(trato.metadata || {}),
            payment_status: 'FONDOS_RECIBIDOS',
            epayco_reference: reference,
            epayco_ref_payco: refPayco,
            total_pagado_comprador: Number(amount),
            comision_visible: commission?.monto_comision,
            comision_tratoya_neta: commission?.comision_tratoya,
            costo_epayco_estimado: commission?.costo_epayco,
          },
        });
      }
      await LedgerEntry.create({
        deal_id: intent.deal_id,
        payment_intent_id: intent.id,
        type: 'PAYMENT_RECEIVED',
        amount_cents: amountCents,
        description: 'Pago recibido por ePayco',
      });
      await Pago.create({
        trato_id: intent.deal_id,
        usuario_id: intent.created_by_user_id,
        tipo: 'retencion',
        monto: Number(amount),
        moneda: 'COP',
        pasarela: 'epayco',
        pasarela_ref: txId || reference,
        pasarela_estado: response || stateCode,
        estado: 'aprobado',
        fecha_aprobacion: new Date(),
        webhook_payload: payload,
        metadata: { reference, ref_payco: refPayco, payment_intent_id: intent.id, real: true },
      });
      if (commission) {
        await LedgerEntry.create({
          deal_id: intent.deal_id,
          payment_intent_id: intent.id,
          type: 'PLATFORM_FEE',
          amount_cents: Math.round(Number(commission.comision_tratoya || 0) * 100),
          description: 'Comisión neta TratoYA',
        });
        await LedgerEntry.create({
          deal_id: intent.deal_id,
          payment_intent_id: intent.id,
          type: 'GATEWAY_FEE_ESTIMATED',
          amount_cents: Math.round(Number(commission.costo_epayco || 0) * 100),
          description: 'Costo estimado ePayco incluido en la comisión',
        });
        await Pago.create({
          trato_id: intent.deal_id,
          usuario_id: null,
          tipo: 'comision',
          monto: Number(commission.comision_tratoya || 0),
          moneda: 'COP',
          pasarela: 'epayco',
          pasarela_ref: txId || reference,
          pasarela_estado: response || stateCode,
          estado: 'aprobado',
          fecha_aprobacion: new Date(),
          comision_pasarela: Number(commission.costo_epayco || 0),
          neto_desembolso: Number(commission.comision_tratoya || 0),
          webhook_payload: payload,
          metadata: {
            reference,
            ref_payco: refPayco,
            payment_intent_id: intent.id,
            comision_visible: commission.monto_comision,
            costo_epayco_estimado: commission.costo_epayco,
            quien_paga_comision: trato?.quien_paga_comision || 'comprador',
            total_pagado_comprador: commission.total_a_pagar,
            vendedor_recibe: commission.monto_neto,
            real: true,
          },
        });
      }
      await AuditLog.create({
        user_id: intent.created_by_user_id,
        action: 'EPAYCO_PAYMENT_APPROVED',
        entity_type: 'payment_intent',
        entity_id: intent.id,
        metadata: { reference, deal_id: intent.deal_id, epayco_transaction_id: txId, ref_payco: refPayco },
      });
      if (trato) {
        const { notificarAmbos } = require('../services/notificacionService');
        await notificarAmbos(trato.comprador_id, trato.vendedor_id, 'pago_retenido', {
          titulo: 'Pago en custodia de TratoYA',
          cuerpo: `Tu pago de $${Number(amount).toLocaleString('es-CO')} COP fue recibido por ePayco.`,
          metadata: { trato_id: trato.id, reference },
        }, {
          titulo: 'Pago en custodia de TratoYA',
          cuerpo: `El pago del trato ${trato.codigo} fue recibido. Puedes proceder con la entrega.`,
          metadata: { trato_id: trato.id, reference },
        });
      }
      logger.info(`EPAYCO_PAYMENT_APPROVED ${reference}`);
    } else if (paymentFailedStatuses.includes(internalStatus)) {
      if (trato) await trato.update({ estado: 'activo' });
      await AuditLog.create({
        user_id: intent.created_by_user_id,
        action: 'EPAYCO_PAYMENT_FAILED',
        entity_type: 'payment_intent',
        entity_id: intent.id,
        metadata: { reference, deal_id: intent.deal_id, epayco_transaction_id: txId, response, stateCode },
      });
      logger.info(`EPAYCO_PAYMENT_FAILED ${reference}`);
    }

    await savedEvent.update({ processed_at: new Date() });
    return res.json({ received: true });
  } catch (err) {
    logger.error('[EPAYCO_WEBHOOK] Error: ' + err.message);
    if (savedEvent) {
      try { await savedEvent.update({ processed_at: new Date(), processing_error: err.message }); } catch {}
    }
    return res.status(500).json({ received: false });
  }
});

webhooksRouter.post('/wompi', async (req, res) => {
  return res.status(410).json({ received: false, message: 'Wompi desactivado. Usa /api/webhooks/epayco.' });
});

webhooksRouter.post('/wompi-disabled', async (req, res) => {
  let savedEvent = null;
  try {
    logger.info('WOMPI_WEBHOOK_RECEIVED');
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = Buffer.isBuffer(req.body) ? JSON.parse(rawBody || '{}') : event;
    const headerChecksum = req.headers['x-event-checksum'];
    const bodyChecksum = payload?.signature?.checksum;
    const checksum = bodyChecksum || headerChecksum || null;
    const properties = payload?.signature?.properties || [];
    const timestamp = payload?.timestamp || '';
    const tx = payload?.data?.transaction || {};
    const eventType = payload?.event || payload?.event_type || null;
    const txId = tx.id || null;
    const status = tx.status || null;
    const reference = tx.reference || null;

    const getByPath = (root, path) => String(path.split('.').reduce((acc, key) => acc?.[key], root) ?? '');
    const signedValues = Array.isArray(properties)
      ? properties.map(path => getByPath(payload.data || {}, path)).join('')
      : '';
    const expectedChecksum = process.env.WOMPI_EVENTS_SECRET
      ? crypto.createHash('sha256').update(`${signedValues}${timestamp}${process.env.WOMPI_EVENTS_SECRET}`).digest('hex')
      : null;
    const isValidSignature = Boolean(expectedChecksum && checksum && expectedChecksum === checksum);

    const duplicateBefore = checksum && txId && status
      ? await PaymentEvent.findOne({
        where: {
          provider: 'wompi',
          wompi_transaction_id: txId,
          status,
          event_checksum: checksum,
          is_valid_signature: true,
        },
      })
      : null;

    savedEvent = await PaymentEvent.create({
      provider: 'wompi',
      event_type: eventType,
      event_checksum: checksum,
      wompi_transaction_id: txId,
      reference,
      status,
      raw_payload: payload,
      received_at: new Date(),
      is_valid_signature: isValidSignature,
    });

    if (!isValidSignature) {
      logger.warn(`WOMPI_WEBHOOK_SIGNATURE_INVALID ${reference || 'sin-reference'}`);
      await savedEvent.update({ processing_error: 'Firma Wompi inválida' });
      return res.status(401).json({ received: false });
    }
    logger.info(`WOMPI_WEBHOOK_SIGNATURE_VALID ${reference || 'sin-reference'}`);

    if (eventType !== 'transaction.updated') {
      await savedEvent.update({ processed_at: new Date() });
      return res.json({ received: true });
    }

    const intent = await PaymentIntent.findOne({ where: { reference } });
    if (!intent) {
      await savedEvent.update({ processed_at: new Date(), processing_error: 'payment_intent no encontrado' });
      return res.json({ received: true });
    }
    if (Number(tx.amount_in_cents) !== Number(intent.amount_cents)) {
      await savedEvent.update({ processed_at: new Date(), processing_error: 'Monto no coincide' });
      return res.status(400).json({ received: false });
    }
    if (tx.currency !== intent.currency || tx.currency !== 'COP') {
      await savedEvent.update({ processed_at: new Date(), processing_error: 'Moneda no válida' });
      return res.status(400).json({ received: false });
    }

    const internalStatus = normalizeWompiStatus(status);
    const trato = await Trato.findByPk(intent.deal_id);
    const alreadyPaid = intent.status === 'PAID' && internalStatus === 'PAID';

    await intent.update({
      status: internalStatus,
      wompi_transaction_id: txId,
      raw_response: payload,
    });

    if (!duplicateBefore && !alreadyPaid && internalStatus === 'PAID') {
      if (trato) {
        await trato.update({
          estado: 'pago_retenido',
          fecha_pago: new Date(),
          metadata: { ...(trato.metadata || {}), payment_status: 'FONDOS_RECIBIDOS', wompi_reference: reference },
        });
      }
      await LedgerEntry.create({
        deal_id: intent.deal_id,
        payment_intent_id: intent.id,
        type: 'PAYMENT_RECEIVED',
        amount_cents: tx.amount_in_cents,
        description: 'Pago recibido por Wompi',
      });
      await Pago.create({
        trato_id: intent.deal_id,
        usuario_id: intent.created_by_user_id,
        tipo: 'retencion',
        monto: Number(tx.amount_in_cents) / 100,
        moneda: 'COP',
        pasarela: 'wompi',
        pasarela_ref: txId || reference,
        pasarela_estado: status,
        estado: 'aprobado',
        fecha_aprobacion: new Date(),
        webhook_payload: payload,
        metadata: { reference, payment_intent_id: intent.id, real: true },
      });
      await AuditLog.create({
        user_id: intent.created_by_user_id,
        action: 'WOMPI_PAYMENT_APPROVED',
        entity_type: 'payment_intent',
        entity_id: intent.id,
        metadata: { reference, deal_id: intent.deal_id, wompi_transaction_id: txId },
      });
      if (trato) {
        const { notificarAmbos } = require('../services/notificacionService');
        await notificarAmbos(trato.comprador_id, trato.vendedor_id, 'pago_retenido', {
          titulo: 'Pago en custodia de TratoYA',
          cuerpo: `Tu pago de $${(tx.amount_in_cents / 100).toLocaleString('es-CO')} COP fue recibido por Wompi.`,
          metadata: { trato_id: trato.id, reference },
        }, {
          titulo: 'Pago en custodia de TratoYA',
          cuerpo: `El pago del trato ${trato.codigo} fue recibido. Puedes proceder con la entrega.`,
          metadata: { trato_id: trato.id, reference },
        });
      }
      logger.info(`WOMPI_PAYMENT_APPROVED ${reference}`);
    } else if (paymentFailedStatuses.includes(internalStatus)) {
      if (trato) await trato.update({ estado: 'activo' });
      await AuditLog.create({
        user_id: intent.created_by_user_id,
        action: 'WOMPI_PAYMENT_FAILED',
        entity_type: 'payment_intent',
        entity_id: intent.id,
        metadata: { reference, deal_id: intent.deal_id, wompi_transaction_id: txId, status },
      });
      logger.info(`${internalStatus === 'PAYMENT_DECLINED' ? 'WOMPI_PAYMENT_DECLINED' : 'WOMPI_PAYMENT_ERROR'} ${reference}`);
    }

    await savedEvent.update({ processed_at: new Date() });
    res.json({ received: true });
  } catch (err) {
    logger.error('[WEBHOOK] Error: ' + err.message);
    if (savedEvent) {
      try { await savedEvent.update({ processed_at: new Date(), processing_error: err.message }); } catch {}
    }
    res.status(500).json({ received: false });
  }
});

module.exports.webhooks = webhooksRouter;
