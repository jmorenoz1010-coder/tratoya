// =============================================
// USERS ROUTE — src/routes/users.js
// =============================================
const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const usersRouter = express.Router();
const auth = require('../middleware/auth');
const { User, CuentaBancaria, Notificacion } = require('../config/database');

usersRouter.use(auth);

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
    const { nombre, apellido, telefono, ciudad } = req.body;
    await req.user.update({ nombre, apellido, telefono, ciudad });
    res.json({ success: true, message: 'Perfil actualizado' });
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
    const cuenta = await CuentaBancaria.create({ usuario_id: req.user.id, banco, tipo, numero, titular });
    res.status(201).json({ success: true, data: cuenta });
  } catch (err) { next(err); }
});

module.exports.users = usersRouter;


// =============================================
// PAYMENTS ROUTE — src/routes/payments.js
// =============================================
const paymentsRouter = express.Router();
const { Pago, Trato } = require('../config/database');

paymentsRouter.use(auth);

paymentsRouter.post('/create-order/:trato_id', async (req, res, next) => {
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
    if (process.env.NODE_ENV === 'production') {
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
      attributes: ['id'],
    });
    const tratoIds = tratos.map(t => t.id);
    const pagos = await Pago.findAll({
      where: { trato_id: { [Op.in]: tratoIds } },
      include: [{ model: Trato, attributes: ['codigo', 'titulo'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: pagos });
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
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
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
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
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
    const tratos = await Trato.findAll({
      where,
      include: [
        { model: User, as: 'vendedor', attributes: ['id', 'nombre', 'apellido', 'email'] },
        { model: User, as: 'comprador', attributes: ['id', 'nombre', 'apellido', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 250,
    });
    res.json({ success: true, data: tratos });
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

adminRouter.post('/tratos/:id/liberar', async (req, res, next) => {
  try {
    const { Trato, Pago, User } = require('../config/database');
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    await trato.update({ estado: 'completado', fecha_liberacion: new Date(), notas_internas: `Liberado por admin ${req.user.email}` });
    if (trato.vendedor_id) {
      await Pago.create({
        trato_id: trato.id,
        usuario_id: trato.vendedor_id,
        tipo: 'liberacion',
        monto: trato.monto_neto || trato.monto,
        pasarela: 'transferencia',
        estado: 'aprobado',
        fecha_aprobacion: new Date(),
        metadata: { admin_id: req.user.id },
      });
    }
    await actualizarReputacionUsuarios(trato, User).catch(() => {});
    res.json({ success: true, data: trato, message: 'Pago liberado' });
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
      metadata: { trato_id: trato.id, creado_por: req.user.id, destino },
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
    const pagos = await Pago.findAll({
      include: [
        { model: Trato, attributes: ['id', 'codigo', 'titulo'] },
        { model: User, attributes: ['id', 'nombre', 'apellido', 'email'] },
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
    res.json({ success: true, data: users.map(cleanUser) });
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
    if (password && password.length < 8) {
      return res.status(400).json({ success: false, message: 'Contraseña mínimo 8 caracteres' });
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
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Contraseña mínimo 8 caracteres' });
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
      metadata: { creado_por: req.user.id },
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
      metadata: { segmento, creado_por: req.user.id },
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

webhooksRouter.post('/wompi', async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    const signature = req.headers['x-event-checksum'];

    if (process.env.WOMPI_EVENTS_SECRET && signature) {
      const hash = crypto.createHash('sha256')
        .update(rawBody + process.env.WOMPI_EVENTS_SECRET)
        .digest('hex');
      if (hash !== signature) {
        logger.warn('[WEBHOOK] Firma Wompi inválida');
        return res.status(401).json({ received: false });
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (event.event === 'transaction.updated') {
      const { transaction } = event.data;
      const { status, reference, id: tid, amount_in_cents } = transaction;
      const codigo = reference.split('-')[0]; // TY-XXXXX

      const trato = await Trato.findOne({ where: { codigo } });
      if (!trato) return res.json({ received: true });

      if (status === 'APPROVED') {
        const { registrarPagoAprobado } = require('../services/pagoService');
        await registrarPagoAprobado({
          trato,
          reference,
          transactionId: tid,
          amountInCents: amount_in_cents,
          payload: transaction,
          metodoPago: transaction.payment_method_type || null,
        });
        const { notificar } = require('../services/notificacionService');
        await notificar(trato.vendedor_id, 'pago_retenido', {
          titulo: '🔒 ¡Pago retenido!',
          cuerpo: `$${(amount_in_cents / 100).toLocaleString('es-CO')} están seguros. Procede a entregar.`,
          metadata: { trato_id: trato.id },
        });
        logger.info(`[WEBHOOK] Pago aprobado → trato ${trato.codigo}`);
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('[WEBHOOK] Error: ' + err.message);
    res.status(500).json({ received: false });
  }
});

module.exports.webhooks = webhooksRouter;
