const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../config/database');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const signToken = (id, expiresIn = '15m') => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn
});
const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
  expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
});

const normalizeHandle = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .slice(0, 24);

const makeUniqueHandle = async (base, currentId = null) => {
  const root = normalizeHandle(base) || `user${Date.now().toString().slice(-6)}`;
  let candidate = root;
  for (let i = 0; i < 20; i += 1) {
    const existing = await User.findOne({ where: { usuario_unico: candidate } });
    if (!existing || existing.id === currentId) return candidate;
    candidate = `${root}${Math.floor(100 + Math.random() * 900)}`;
  }
  return `${root}${Date.now().toString().slice(-5)}`;
};

const isStrongPassword = (password) =>
  typeof password === 'string'
  && password.length >= 12
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /\d/.test(password)
  && /[^A-Za-z0-9]/.test(password)
  && !/\s/.test(password);

// POST /api/auth/register
router.post('/register', [
  body('nombre').notEmpty().trim().withMessage('Nombre requerido'),
  body('apellido').notEmpty().trim().withMessage('Apellido requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').custom(isStrongPassword).withMessage('La contraseña debe tener mínimo 12 caracteres, mayúscula, minúscula, número, símbolo y no tener espacios'),
  body('tipo_identificacion').optional().isIn(['CC','CE','TI','PA','PEP','NIT','OTRO']).withMessage('Tipo de identificación inválido'),
  body('cedula').notEmpty().trim().withMessage('Número de identificación requerido'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => e.msg);
    return res.status(400).json({ success: false, message: msgs[0], errors: errors.array() });
  }
  try {
    const { nombre, apellido, email, password, telefono, cedula, tipo_identificacion = 'CC' } = req.body;
    const existe = await User.findOne({ where: { email } });
    if (existe) return res.status(409).json({ success: false, message: 'El email ya está registrado' });
    const cedulaExiste = await User.findOne({ where: { cedula } });
    if (cedulaExiste) return res.status(409).json({ success: false, message: 'El número de identificación ya está registrado' });
    if (telefono) {
      const telExiste = await User.findOne({ where: { telefono } });
      if (telExiste) return res.status(409).json({ success: false, message: 'El número de WhatsApp ya está registrado en otra cuenta' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const usuario_unico = await makeUniqueHandle(email.split('@')[0]);
    const user = await User.create({ nombre, apellido, email, usuario_unico, password_hash, telefono, cedula, tipo_identificacion });

    // Registro ligero: sin adjuntos. Se activa básico para permitir operar en beta.
    await user.update({ kyc_nivel: 'basico', email_verificado: true });

    await sendEmail(email, 'bienvenida', { nombre });
    logger.info(`[AUTH] Nuevo usuario registrado: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente.',
      data: { id: user.id, nombre: user.nombre, email: user.email, usuario_unico: user.usuario_unico },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => e.msg);
    return res.status(400).json({ success: false, message: msgs[0], errors: errors.array() });
  }
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ success: false, message: 'Cuenta suspendida. Contacta soporte@tratoya.co' });
    }

    if (!user.usuario_unico) {
      await user.update({ usuario_unico: await makeUniqueHandle(user.email.split('@')[0], user.id) });
    }

    const rol = user.rol || (user.is_admin ? 'admin' : 'user');
    const isAdminSession = ['admin', 'superadmin'].includes(rol);
    const token = signToken(user.id, isAdminSession ? (process.env.JWT_ADMIN_EXPIRES_IN || '3650d') : undefined);
    const refresh_token = signRefresh(user.id);
    await user.update({ last_login: new Date(), refresh_token: await bcrypt.hash(refresh_token, 6) });

    res.json({
      success: true,
      token,
      refresh_token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        usuario_unico: user.usuario_unico,
        tipo_identificacion: user.tipo_identificacion,
        cedula: user.cedula,
        rol,
        is_admin: user.is_admin,
        kyc_nivel: user.kyc_nivel,
        plan: user.plan,
        reputacion: user.reputacion,
        foto_perfil: user.foto_perfil,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ success: false, message: 'Refresh token requerido' });
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user || !user.refresh_token) return res.status(401).json({ success: false, message: 'Token inválido' });
    const isValid = await bcrypt.compare(refresh_token, user.refresh_token);
    if (!isValid) return res.status(401).json({ success: false, message: 'Refresh token inválido' });
    if (user.is_blocked) return res.status(403).json({ success: false, message: 'Cuenta suspendida' });
    const token = signToken(user.id);
    res.json({ success: true, token });
  } catch {
    res.status(401).json({ success: false, message: 'Refresh token inválido o expirado' });
  }
});

// POST /api/auth/logout
router.post('/logout', require('../middleware/auth'), async (req, res, next) => {
  try {
    await req.user.update({ refresh_token: null });
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), (req, res) => {
  const { password_hash, refresh_token, ...user } = req.user.toJSON();
  res.json({ success: true, data: user });
});

module.exports = router;
