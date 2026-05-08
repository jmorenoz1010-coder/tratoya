const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const auth = require('../middleware/auth');
const kycRequired = require('../middleware/kycRequired');
const { Trato, User, Pago } = require('../config/database');
const { calcularComision, MONTO_MINIMO_TRATO } = require('../services/comisionService');
const { notificar } = require('../services/notificacionService');
const { generarCodigo } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── GET /api/tratos/public/:link ─────────────
router.get('/public/:link', async (req, res, next) => {
  try {
    const trato = await Trato.findOne({
      where: { link_compartir: req.params.link },
      include: [
        { model: User, as: 'vendedor', attributes: ['id','nombre','apellido','reputacion','kyc_nivel'] },
        { model: User, as: 'comprador', attributes: ['id','nombre','apellido','reputacion','kyc_nivel'] },
      ],
    });
    if (!trato) return res.status(404).json({ success: false, message: 'Link de trato no encontrado' });
    if (trato.estado === 'borrador' && trato.fecha_expiracion && dayjs().isAfter(dayjs(trato.fecha_expiracion))) {
      await trato.update({ estado: 'expirado' });
      return res.status(410).json({ success: false, message: 'Este link expiró. Pide al vendedor crear o reenviar un trato nuevo.' });
    }
    res.json({ success: true, data: trato });
  } catch (err) { next(err); }
});

// ── PUT /api/tratos/public/:link/activar ─────
router.put('/public/:link/activar', auth, async (req, res, next) => {
  try {
    const trato = await Trato.findOne({ where: { link_compartir: req.params.link } });
    if (!trato) return res.status(404).json({ success: false, message: 'Link de trato no encontrado' });
    if (trato.estado !== 'borrador') return res.status(400).json({ success: false, message: 'Este trato ya no puede activarse' });
    if (trato.fecha_expiracion && dayjs().isAfter(dayjs(trato.fecha_expiracion))) {
      await trato.update({ estado: 'expirado' });
      return res.status(410).json({ success: false, message: 'Este link expiró. Pide al vendedor crear o reenviar un trato nuevo.' });
    }
    if (trato.vendedor_id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes aceptar tu propio trato' });

    await trato.update({ comprador_id: req.user.id, estado: 'activo', fecha_activado: new Date() });

    await notificar(trato.vendedor_id, 'trato_activado', {
      titulo: '¡Alguien aceptó tu trato!',
      cuerpo: `Tu trato "${trato.titulo}" fue aceptado. El comprador procederá al pago.`,
      metadata: { trato_id: trato.id },
    });

    res.json({ success: true, message: 'Trato aceptado. Ya puedes proceder al pago.', data: trato });
  } catch (err) { next(err); }
});

router.use(auth); // Todas las demás rutas requieren autenticación

// ── GET /api/tratos ──────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { estado, rol, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (rol === 'comprador')    where.comprador_id = req.user.id;
    else if (rol === 'vendedor') where.vendedor_id = req.user.id;
    else where[Op.or] = [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }];

    if (estado) where.estado = estado;

    const { count, rows } = await Trato.findAndCountAll({
      where,
      include: [
        { model: User, as: 'comprador', attributes: ['id','nombre','apellido','reputacion','foto_perfil'] },
        { model: User, as: 'vendedor',  attributes: ['id','nombre','apellido','reputacion','foto_perfil'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) },
    });
  } catch (err) { next(err); }
});

// ── POST /api/tratos ─────────────────────────
router.post('/', kycRequired, [
  body('titulo').notEmpty().trim().isLength({ min: 5 }).withMessage('Título mínimo 5 caracteres'),
  body('tipo').isIn(['producto','servicio','reserva','vehiculo','inmueble','otro']),
  body('monto').isFloat({ min: MONTO_MINIMO_TRATO }).withMessage(`Monto mínimo $${MONTO_MINIMO_TRATO.toLocaleString('es-CO')} COP`),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { titulo, descripcion, tipo, monto, dias_inspeccion = 7, quien_paga_comision = 'comprador', notas } = req.body;
    const montoNumero = parseFloat(monto);
    const { porcentaje, monto_comision, monto_neto } = calcularComision(montoNumero, quien_paga_comision);
    const codigo = await generarCodigo();

    const trato = await Trato.create({
      codigo,
      titulo, descripcion, tipo,
      vendedor_id: req.user.id,
      monto,
      comision_pct: porcentaje,
      comision_monto: monto_comision,
      monto_neto,
      quien_paga_comision,
      dias_inspeccion,
      notas,
      estado: 'borrador',
      link_compartir: uuidv4().substring(0, 10),
      fecha_expiracion: dayjs().add(12, 'hour').toDate(),
      ip_creacion: req.ip,
    });

    await notificar(req.user.id, 'trato_creado', {
      titulo: '¡Trato creado!',
      cuerpo: `Tu trato "${titulo}" (${codigo}) está listo. Comparte el link con tu contraparte.`,
      metadata: { trato_id: trato.id },
    });

    logger.info(`[TRATO] Creado ${codigo} por ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: 'Trato creado exitosamente',
      data: { ...trato.toJSON(), link_publico: `${process.env.FRONTEND_URL}/t/${trato.link_compartir}` },
    });
  } catch (err) { next(err); }
});

// ── GET /api/tratos/:id ──────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const trato = await Trato.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [{ comprador_id: req.user.id }, { vendedor_id: req.user.id }],
      },
      include: [
        { model: User, as: 'comprador', attributes: ['id','nombre','apellido','reputacion','foto_perfil','kyc_nivel'] },
        { model: User, as: 'vendedor',  attributes: ['id','nombre','apellido','reputacion','foto_perfil','kyc_nivel'] },
        { model: Pago },
      ],
    });
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    res.json({ success: true, data: trato });
  } catch (err) { next(err); }
});

// ── PUT /api/tratos/:id/activar (comprador se une) ──
router.put('/:id/activar', async (req, res, next) => {
  try {
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    if (trato.estado !== 'borrador') return res.status(400).json({ success: false, message: 'Este trato ya no puede activarse' });
    if (trato.vendedor_id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes ser comprador de tu propio trato' });

    await trato.update({ comprador_id: req.user.id, estado: 'activo', fecha_activado: new Date() });

    await notificar(trato.vendedor_id, 'trato_activado', {
      titulo: '¡Alguien aceptó tu trato!',
      cuerpo: `Tu trato "${trato.titulo}" fue aceptado. El comprador procederá al pago.`,
      metadata: { trato_id: trato.id },
    });

    res.json({ success: true, message: 'Trato activado. El comprador puede proceder al pago.', data: trato });
  } catch (err) { next(err); }
});

// ── POST /api/tratos/:id/prueba-entrega (subir fotos) ──
router.post('/:id/prueba-entrega', async (req, res, next) => {
  try {
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
    upload.any()(req, res, async (err) => {
      if (err) return next(err);
      const trato = await Trato.findByPk(req.params.id);
      if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
      if (trato.vendedor_id !== req.user.id) return res.status(403).json({ success: false, message: 'Solo el vendedor puede subir pruebas' });

      const { s3Upload } = require('../services/s3Service');
      const urls = [];
      for (const file of (req.files || [])) {
        const ext = (file.originalname.split('.').pop() || 'jpg');
        const key = `entregas/${trato.id}/foto-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
        const url = await s3Upload(key, file.buffer, file.mimetype);
        urls.push(url);
      }

      if (urls.length < 2) {
        return res.status(400).json({ success: false, message: `Se necesitan mínimo 2 fotos. Solo subiste ${urls.length}.` });
      }

      const metadata = { ...(trato.metadata || {}), prueba_entrega_urls: urls, prueba_entrega_fecha: new Date().toISOString() };
      await trato.update({ metadata });
      logger.info(`[TRATO] Prueba entrega subida: ${trato.codigo} · ${urls.length} fotos`);
      res.json({ success: true, message: `${urls.length} fotos de prueba guardadas`, data: { urls } });
    });
  } catch (err) { next(err); }
});

// ── POST /api/tratos/:id/registrar-guia ──────
router.post('/:id/registrar-guia', async (req, res, next) => {
  try {
    const { guia, transportadora, tracking_url, medio_envio, numero_contacto, punto_encuentro } = req.body;
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    if (trato.vendedor_id !== req.user.id) return res.status(403).json({ success: false, message: 'Solo el vendedor puede registrar la guía' });
    if (trato.estado !== 'pago_retenido') return res.status(400).json({ success: false, message: 'El pago debe estar retenido para registrar guía' });

    // Campos según medio de envío
    const updates = {
      estado: 'en_entrega',
      fecha_entrega: new Date(),
      transportadora: transportadora || 'Otro',
      guia_envio: guia || medio_envio || 'registro_manual',
      tracking_url: tracking_url || null,
    };

    // Guardar info extra en metadata
    const meta = { ...(trato.metadata || {}), medio_envio: medio_envio || 'servientrega' };
    if (numero_contacto) meta.numero_contacto_domiciliario = numero_contacto;
    if (numero_contacto) meta.telefono_domiciliario = numero_contacto;
    if (punto_encuentro) meta.punto_encuentro = punto_encuentro;
    meta.datos_entrega = {
      medio_envio: medio_envio || 'servientrega',
      transportadora: transportadora || (medio_envio === 'domiciliario' ? 'Domiciliario' : medio_envio === 'en_persona' ? 'En persona' : 'Servientrega'),
      guia: guia || null,
      tracking_url: tracking_url || null,
      numero_contacto: numero_contacto || null,
      punto_encuentro: punto_encuentro || null,
    };
    updates.metadata = meta;

    await trato.update(updates);

    const fecha_limite = dayjs().add(trato.dias_inspeccion, 'day').toDate();

    // Mensaje personalizado según medio
    let mensajeComprador;
    if (medio_envio === 'domiciliario') {
      mensajeComprador = `Un domiciliario llevará tu compra. Número de contacto: ${numero_contacto}. Tienes ${trato.dias_inspeccion} días para confirmar.`;
    } else if (medio_envio === 'en_persona') {
      mensajeComprador = `La entrega es en persona. Punto: ${punto_encuentro}. Tienes ${trato.dias_inspeccion} días para confirmar.`;
    } else {
      mensajeComprador = `Guía ${guia} (${transportadora}). Tienes ${trato.dias_inspeccion} días para confirmar.`;
    }

    await notificar(trato.comprador_id, 'trato_en_entrega', {
      titulo: '📦 ¡Tu compra está en camino!',
      cuerpo: mensajeComprador,
      metadata: { trato_id: trato.id, medio_envio, fecha_limite },
      sms_evento: 'guia_registrada_comprador',
      sms_params: { codigo: trato.codigo, guia: guia || medio_envio, transportadora: transportadora || medio_envio },
    });

    res.json({ success: true, message: 'Envío registrado', data: { medio_envio, fecha_limite } });
  } catch (err) { next(err); }
});

// ── POST /api/tratos/:id/confirmar ───────────
router.post('/:id/confirmar', async (req, res, next) => {
  try {
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    if (trato.comprador_id !== req.user.id) return res.status(403).json({ success: false, message: 'Solo el comprador puede confirmar' });
    if (!['en_entrega', 'pendiente_confirmacion'].includes(trato.estado)) {
      return res.status(400).json({ success: false, message: `No se puede confirmar en estado: ${trato.estado}` });
    }

    await trato.update({ estado: 'confirmado', fecha_confirmacion: new Date() });

    const { liberarPago } = require('../services/pagoService');
    liberarPago(trato.id).catch(err => logger.error('[TRATO] Error liberando pago:', err));

    res.json({ success: true, message: 'Confirmado. El pago será liberado en las próximas horas.' });
  } catch (err) { next(err); }
});

// ── POST /api/tratos/:id/cancelar ────────────
router.post('/:id/cancelar', [
  body('motivo').notEmpty().withMessage('Motivo requerido'),
], async (req, res, next) => {
  try {
    const trato = await Trato.findByPk(req.params.id);
    if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
    const esParticipante = [trato.comprador_id, trato.vendedor_id].includes(req.user.id);
    if (!esParticipante) return res.status(403).json({ success: false, message: 'Sin permiso' });
    if (!['borrador', 'activo'].includes(trato.estado)) {
      return res.status(400).json({ success: false, message: 'No cancelable en este estado. Si hay pago retenido, abre una disputa.' });
    }
    await trato.update({ estado: 'cancelado', notas_internas: `Cancelado: ${req.body.motivo}` });
    res.json({ success: true, message: 'Trato cancelado' });
  } catch (err) { next(err); }
});

module.exports = router;
