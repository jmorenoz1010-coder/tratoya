const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const auth = require('../middleware/auth');
const kycRequired = require('../middleware/kycRequired');
const { Trato, User, Pago, Mensaje } = require('../config/database');
const { calcularComision, MONTO_MINIMO_TRATO } = require('../services/comisionService');
const { notificar } = require('../services/notificacionService');
const { generarCodigo } = require('../utils/helpers');
const logger = require('../utils/logger');
const PUBLIC_FRONTEND_URL = 'https://www.tratoya.com';

const fmt = (n) => Number(n).toLocaleString('es-CO');
const tratoLink = (link) => `${PUBLIC_FRONTEND_URL}/t/${link}`;

// S-06: expone solo campos seguros del trato en el link público (sin notas internas,
// metadata, IDs internos ni IP de creación).
const toPublicTrato = (trato) => {
  if (!trato) return null;
  const t = typeof trato.toJSON === 'function' ? trato.toJSON() : trato;
  const persona = (u) => (u ? {
    nombre: u.nombre,
    apellido: u.apellido,
    reputacion: u.reputacion,
    kyc_nivel: u.kyc_nivel,
  } : null);
  return {
    codigo: t.codigo,
    titulo: t.titulo,
    descripcion: t.descripcion,
    tipo: t.tipo,
    monto: t.monto,
    comision_pct: t.comision_pct,
    comision_monto: t.comision_monto,
    monto_neto: t.monto_neto,
    quien_paga_comision: t.quien_paga_comision,
    moneda: t.moneda,
    estado: t.estado,
    dias_inspeccion: t.dias_inspeccion,
    link_compartir: t.link_compartir,
    fecha_creado: t.fecha_creado,
    fecha_expiracion: t.fecha_expiracion,
    vendedor: persona(t.vendedor),
    comprador: persona(t.comprador),
  };
};

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
    res.json({ success: true, data: toPublicTrato(trato) });
  } catch (err) { next(err); }
});

// ── PUT /api/tratos/public/:link/activar ─────
router.put('/public/:link/activar', auth, async (req, res, next) => {
  try {
    const trato = await Trato.findOne({ where: { link_compartir: req.params.link } });
    if (!trato) return res.status(404).json({ success: false, message: 'Link de trato no encontrado' });
    if (trato.estado !== 'borrador') return res.status(400).json({ success: false, message: 'Este trato ya no puede activarse' });
    // S-02: un trato con comprador ya asignado no puede ser tomado por otro usuario.
    if (trato.comprador_id && trato.comprador_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Este trato ya tiene un comprador asignado.' });
    }
    if (trato.fecha_expiracion && dayjs().isAfter(dayjs(trato.fecha_expiracion))) {
      await trato.update({ estado: 'expirado' });
      return res.status(410).json({ success: false, message: 'Este link expiró. Pide al vendedor crear o reenviar un trato nuevo.' });
    }
    if (trato.vendedor_id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes aceptar tu propio trato' });

    await trato.update({ comprador_id: req.user.id, estado: 'activo', fecha_activado: new Date() });

    // Obtener vendedor para email
    const vendedor = await User.findByPk(trato.vendedor_id, { attributes: ['nombre'] });
    await notificar(trato.vendedor_id, 'trato_activado', {
      titulo: '¡Alguien aceptó tu trato!',
      cuerpo: `Tu trato "${trato.titulo}" fue aceptado. El comprador procederá al pago.`,
      metadata: { trato_id: trato.id },
      email_template: 'trato_aceptado_vendedor',
      email_data: { nombre: vendedor?.nombre, codigo: trato.codigo, titulo: trato.titulo, monto: fmt(trato.monto) },
      wa_evento: 'trato_aceptado_vendedor',
      wa_params: { codigo: trato.codigo, titulo: trato.titulo, monto: fmt(trato.monto) },
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
  body('tipo').isIn(['producto','servicio','reserva','vehiculo','inmueble','otro']).withMessage('Tipo de trato inválido'),
  body('monto').isFloat({ min: MONTO_MINIMO_TRATO }).withMessage(`Monto mínimo $${MONTO_MINIMO_TRATO.toLocaleString('es-CO')} COP`),
  body('dias_inspeccion').optional().isInt({ min: 1, max: 7 }).withMessage('El tiempo máximo de inspección es 7 días'),
  body('quien_paga_comision').isIn(['comprador','vendedor','compartida']).withMessage('Define quién paga la comisión'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => e.msg);
    return res.status(400).json({ success: false, message: msgs[0], errors: errors.array() });
  }
  try {
    const { titulo, descripcion, tipo, monto, dias_inspeccion = 7, quien_paga_comision, notas, contraparte_usuario_unico } = req.body;
    const montoNumero = parseFloat(monto);
    const diasInspeccion = Math.min(7, Math.max(1, parseInt(dias_inspeccion, 10) || 7));
    const { porcentaje, monto_comision, monto_neto } = calcularComision(montoNumero, quien_paga_comision);
    const codigo = await generarCodigo();
    let contraparte = null;
    const handle = String(contraparte_usuario_unico || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
    if (handle) {
      contraparte = await User.findOne({ where: { usuario_unico: handle, is_active: true, is_blocked: false } });
      if (!contraparte) return res.status(404).json({ success: false, message: 'No encontramos un usuario registrado con ese nombre de usuario' });
      if (contraparte.id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes enviarte un trato a ti mismo' });
    }

    const trato = await Trato.create({
      codigo,
      titulo, descripcion, tipo,
      vendedor_id: req.user.id,
      comprador_id: contraparte?.id || null,
      monto,
      comision_pct: porcentaje,
      comision_monto: monto_comision,
      monto_neto,
      quien_paga_comision,
      dias_inspeccion: diasInspeccion,
      notas,
      estado: contraparte ? 'activo' : 'borrador',
      link_compartir: uuidv4().substring(0, 10),
      fecha_activado: contraparte ? new Date() : null,
      fecha_expiracion: dayjs().add(12, 'hour').toDate(),
      ip_creacion: req.ip,
      metadata: contraparte ? { invitacion_directa: true, contraparte_usuario_unico: contraparte.usuario_unico } : {},
    });

    await notificar(req.user.id, 'trato_creado', {
      titulo: '¡Trato creado!',
      cuerpo: `Tu trato "${titulo}" (${codigo}) está listo. Comparte el link con tu contraparte.`,
      metadata: { trato_id: trato.id },
    });

    if (contraparte) {
      await Mensaje.create({
        trato_id: trato.id,
        remitente_id: req.user.id,
        tipo: 'sistema',
        contenido: `Te enviaron el trato directo ${codigo}: ${titulo}. Puedes revisarlo y continuar con el pago desde Mis Tratos.`,
      });
      await notificar(contraparte.id, 'trato_directo', {
        titulo: 'Nuevo trato directo',
        cuerpo: `${req.user.nombre} te envió "${titulo}". Revisa el trato para aceptarlo y pagar.`,
        accion_url: `/trato/${trato.id}`,
        metadata: { trato_id: trato.id, codigo },
        email_template: 'trato_creado_contraparte',
        email_data: { nombre: contraparte.nombre, codigo, titulo, monto: fmt(montoNumero), link: tratoLink(trato.link_compartir) },
        wa_evento: 'trato_creado_contraparte',
        wa_params: { nombre: contraparte.nombre, codigo, titulo, monto: fmt(montoNumero), link: tratoLink(trato.link_compartir) },
      });
    }

    logger.info(`[TRATO] Creado ${codigo} por ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: contraparte ? 'Trato creado y enviado a tu contraparte' : 'Trato creado exitosamente',
      data: { ...trato.toJSON(), link_publico: `${PUBLIC_FRONTEND_URL}/t/${trato.link_compartir}` },
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
    // S-02: si el trato ya tiene un comprador asignado, nadie más puede tomarlo.
    if (trato.comprador_id && trato.comprador_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Este trato ya tiene un comprador asignado.' });
    }
    if (trato.vendedor_id === req.user.id) return res.status(400).json({ success: false, message: 'No puedes ser comprador de tu propio trato' });

    await trato.update({ comprador_id: req.user.id, estado: 'activo', fecha_activado: new Date() });

    const vendedorActivo = await User.findByPk(trato.vendedor_id, { attributes: ['nombre'] });
    await notificar(trato.vendedor_id, 'trato_activado', {
      titulo: '¡Alguien aceptó tu trato!',
      cuerpo: `Tu trato "${trato.titulo}" fue aceptado. El comprador procederá al pago.`,
      metadata: { trato_id: trato.id },
      email_template: 'trato_aceptado_vendedor',
      email_data: { nombre: vendedorActivo?.nombre, codigo: trato.codigo, titulo: trato.titulo, monto: fmt(trato.monto) },
      wa_evento: 'trato_aceptado_vendedor',
      wa_params: { codigo: trato.codigo, titulo: trato.titulo, monto: fmt(trato.monto) },
    });

    res.json({ success: true, message: 'Trato activado. El comprador puede proceder al pago.', data: trato });
  } catch (err) { next(err); }
});

// ── POST /api/tratos/:id/prueba-entrega (subir fotos) ──
router.post('/:id/prueba-entrega', async (req, res, next) => {
  try {
    const multer = require('multer');
    const { validateUpload } = require('../utils/fileValidation');
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 5 } });
    upload.any()(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, message: 'No se pudo procesar el archivo. Verifica el tamaño (máx 8 MB).' });
      const trato = await Trato.findByPk(req.params.id);
      if (!trato) return res.status(404).json({ success: false, message: 'Trato no encontrado' });
      if (trato.vendedor_id !== req.user.id) return res.status(403).json({ success: false, message: 'Solo el vendedor puede subir pruebas' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'Debes adjuntar al menos 1 foto de prueba de entrega.' });

      const { s3Upload } = require('../services/s3Service');
      const urls = [];
      for (const file of (req.files || [])) {
        const check = validateUpload(file);
        if (!check.ok) return res.status(400).json({ success: false, message: check.message });
        const key = `entregas/${trato.id}/foto-${Date.now()}-${Math.random().toString(16).slice(2)}.${check.ext}`;
        const url = await s3Upload(key, file.buffer, check.mime);
        urls.push(url);
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

    const compradorEntrega = await User.findByPk(trato.comprador_id, { attributes: ['nombre'] });
    await notificar(trato.comprador_id, 'trato_en_entrega', {
      titulo: '📦 ¡Tu compra está en camino!',
      cuerpo: mensajeComprador,
      metadata: { trato_id: trato.id, medio_envio, fecha_limite },
      sms_evento: 'guia_registrada_comprador',
      sms_params: { codigo: trato.codigo, guia: guia || medio_envio, transportadora: transportadora || medio_envio },
      email_template: 'entrega_registrada_comprador',
      email_data: { nombre: compradorEntrega?.nombre, codigo: trato.codigo },
      wa_evento: 'entrega_registrada_comprador',
      wa_params: { codigo: trato.codigo, detalle: mensajeComprador },
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

    await Promise.all([
      notificar(trato.vendedor_id, 'entrega_confirmada', {
        titulo: 'Entrega confirmada',
        cuerpo: `El comprador confirmó la entrega del trato ${trato.codigo}. TratoYA realizará la consignación manual.`,
        metadata: { trato_id: trato.id },
        email_template: 'entrega_confirmada_pendiente_pago',
        email_data: { codigo: trato.codigo, titulo: trato.titulo },
        wa_evento: 'entrega_confirmada_pendiente_pago',
        wa_params: { codigo: trato.codigo, titulo: trato.titulo, neto: Number(trato.monto_neto || trato.monto).toLocaleString('es-CO') },
      }),
      notificar(trato.comprador_id, 'entrega_confirmada', {
        titulo: 'Entrega confirmada',
        cuerpo: `Confirmaste la entrega del trato ${trato.codigo}. El pago quedó listo para consignación al vendedor.`,
        metadata: { trato_id: trato.id },
        email_template: 'entrega_confirmada_comprador',
        email_data: { codigo: trato.codigo, titulo: trato.titulo },
        wa_evento: 'entrega_confirmada_comprador',
        wa_params: { codigo: trato.codigo, titulo: trato.titulo },
      }),
    ]);

    res.json({ success: true, message: 'Entrega confirmada. TratoYA realizará la consignación manual al vendedor.' });
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
