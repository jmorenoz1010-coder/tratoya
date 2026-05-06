const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../config/database');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});
const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
  expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
});

// POST /api/auth/register
router.post('/register', [
  body('nombre').notEmpty().trim().withMessage('Nombre requerido'),
  body('apellido').notEmpty().trim().withMessage('Apellido requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { nombre, apellido, email, password, telefono } = req.body;
    const existe = await User.findOne({ where: { email } });
    if (existe) return res.status(409).json({ success: false, message: 'El email ya está registrado' });

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ nombre, apellido, email, password_hash, telefono });

    // Para pruebas: activar KYC básico automáticamente (en producción se hace con selfie)
    await user.update({ kyc_nivel: 'basico', email_verificado: true });

    await sendEmail(email, 'bienvenida', { nombre });
    logger.info(`[AUTH] Nuevo usuario registrado: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente.',
      data: { id: user.id, nombre: user.nombre, email: user.email },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Email o contraseña incorrectos' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ success: false, message: 'Cuenta suspendida. Contacta soporte@tratoya.co' });
    }

    const token = signToken(user.id);
    const refresh_token = signRefresh(user.id);
    await user.update({ last_login: new Date(), refresh_token: await bcrypt.hash(refresh_token, 6) });
    const rol = user.rol || (user.is_admin ? 'admin' : 'user');

    res.json({
      success: true,
      token,
      refresh_token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
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
    if (!user) return res.status(401).json({ success: false, message: 'Token inválido' });
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
