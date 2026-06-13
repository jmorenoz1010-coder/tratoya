const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { User } = require('../config/database');
const { sendEmail } = require('../services/emailService');
const { registerLimiter, refreshLimiter } = require('../middleware/rateLimiters');
const { issueOAuthCode, consumeOAuthCode } = require('../utils/oauthCodes');
const logger = require('../utils/logger');

// S-10: límites estrictos en endpoints sensibles (fuerza bruta / abuso).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' },
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta de nuevo en una hora.' },
});

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

const publicUser = (user) => {
  const rol = user.rol || (user.is_admin ? 'admin' : 'user');
  return {
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
  };
};

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const callbackUrl = (provider) => process.env.API_PUBLIC_URL ? `${process.env.API_PUBLIC_URL.replace(/\/$/, '')}/api/auth/oauth/${provider}/callback` : null;
const localCallbackUrl = (req, provider) => `${req.protocol}://${req.get('host')}/api/auth/oauth/${provider}/callback`;

const socialRedirect = async (res, user) => {
  const rol = user.rol || (user.is_admin ? 'admin' : 'user');
  const isAdminSession = ['admin', 'superadmin'].includes(rol);
  const token = signToken(user.id, isAdminSession ? (process.env.JWT_ADMIN_EXPIRES_IN || '7d') : undefined);
  const refresh_token = signRefresh(user.id);
  await user.update({ last_login: new Date(), refresh_token: await bcrypt.hash(refresh_token, 12) });
  // Código de un solo uso — los tokens nunca viajan en la URL (evita logs/referrer).
  const code = await issueOAuthCode({ token, refresh_token, user: publicUser(user) });
  return res.redirect(`${frontendUrl()}/auth/callback?code=${encodeURIComponent(code)}`);
};

const upsertSocialUser = async ({ email, nombre, apellido }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    const err = new Error('El proveedor no devolvió un email válido.');
    err.status = 400;
    throw err;
  }

  let user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    user = await User.create({
      nombre: nombre || 'Usuario',
      apellido: apellido || 'TratoYa',
      email: normalizedEmail,
      usuario_unico: await makeUniqueHandle(normalizedEmail.split('@')[0]),
      password_hash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
      kyc_nivel: 'basico',
      email_verificado: true,
      is_active: true,
      is_blocked: false,
    });
  } else {
    const updates = {
      email_verificado: true,
      is_active: true,
      is_blocked: false,
    };
    if (!user.usuario_unico) updates.usuario_unico = await makeUniqueHandle(normalizedEmail.split('@')[0], user.id);
    if (!user.nombre && nombre) updates.nombre = nombre;
    if (!user.apellido && apellido) updates.apellido = apellido;
    await user.update(updates);
  }
  return user;
};

const appleClientSecret = () => {
  const privateKey = String(process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!process.env.APPLE_TEAM_ID || !process.env.APPLE_CLIENT_ID || !process.env.APPLE_KEY_ID || !privateKey) return null;
  return jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      aud: 'https://appleid.apple.com',
      sub: process.env.APPLE_CLIENT_ID,
    },
    privateKey,
    { algorithm: 'ES256', keyid: process.env.APPLE_KEY_ID }
  );
};

const isStrongPassword = (password) =>
  typeof password === 'string'
  && password.length >= 6
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /\d/.test(password)
  && /[^A-Za-z0-9]/.test(password)
  && !/\s/.test(password);

// GET /api/auth/oauth/:provider
router.get('/oauth/:provider', (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  if (!['google', 'apple'].includes(provider)) {
    return res.status(404).json({ success: false, message: 'Proveedor social no soportado' });
  }

  if (provider === 'google') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(501).json({ success: false, message: 'Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET para activar Google.' });
    }
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || callbackUrl('google') || localCallbackUrl(req, 'google');
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  if (!process.env.APPLE_CLIENT_ID || !appleClientSecret()) {
    return res.status(501).json({ success: false, message: 'Configura APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID y APPLE_PRIVATE_KEY para activar Apple.' });
  }
  const redirectUri = process.env.APPLE_REDIRECT_URI || callbackUrl('apple') || localCallbackUrl(req, 'apple');
  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email',
  });
  return res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

router.get('/oauth/google/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, message: 'Código OAuth requerido' });
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || callbackUrl('google') || localCallbackUrl(req, 'google');
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) return res.status(400).json({ success: false, message: tokenData.error_description || 'Google no autorizó el inicio de sesión' });
    const profileResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResp.json();
    if (!profileResp.ok) return res.status(400).json({ success: false, message: 'No se pudo obtener el perfil de Google' });
    const user = await upsertSocialUser({
      email: profile.email,
      nombre: profile.given_name || profile.name,
      apellido: profile.family_name || '',
    });
    return socialRedirect(res, user);
  } catch (err) { next(err); }
});

router.post('/oauth/apple/callback', async (req, res, next) => {
  try {
    const { code, user: rawUser } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'Código OAuth requerido' });
    const clientSecret = appleClientSecret();
    const redirectUri = process.env.APPLE_REDIRECT_URI || callbackUrl('apple') || localCallbackUrl(req, 'apple');
    const tokenResp = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) return res.status(400).json({ success: false, message: tokenData.error_description || 'Apple no autorizó el inicio de sesión' });
    const decoded = jwt.decode(tokenData.id_token) || {};
    let appleUser = {};
    try { appleUser = rawUser ? JSON.parse(rawUser) : {}; } catch { appleUser = {}; }
    const user = await upsertSocialUser({
      email: decoded.email,
      nombre: appleUser.name?.firstName || 'Usuario',
      apellido: appleUser.name?.lastName || 'Apple',
    });
    return socialRedirect(res, user);
  } catch (err) { next(err); }
});

// POST /api/auth/register
router.post('/register', registerLimiter, [
  body('nombre').notEmpty().trim().withMessage('Nombre requerido'),
  body('apellido').notEmpty().trim().withMessage('Apellido requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').custom(isStrongPassword).withMessage('La contraseña debe tener mínimo 6 caracteres, mayúscula, minúscula, número, símbolo y no tener espacios'),
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
router.post('/login', authLimiter, [
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

    let passwordOk = false;
    if (user && user.password_hash) {
      try { passwordOk = await bcrypt.compare(password, user.password_hash); } catch { passwordOk = false; }
    }
    if (!passwordOk) {
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
    const token = signToken(user.id, isAdminSession ? (process.env.JWT_ADMIN_EXPIRES_IN || '7d') : undefined);
    const refresh_token = signRefresh(user.id);
    await user.update({ last_login: new Date(), refresh_token: await bcrypt.hash(refresh_token, 10) });

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

// POST /api/auth/oauth/exchange — canjea código OAuth por tokens (un solo uso)
router.post('/oauth/exchange', refreshLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'Código requerido' });
    const data = await consumeOAuthCode(code);
    if (!data) return res.status(401).json({ success: false, message: 'Código inválido o expirado. Intenta iniciar sesión de nuevo.' });
    res.json({ success: true, token: data.token, refresh_token: data.refresh_token, user: data.user });
  } catch {
    res.status(500).json({ success: false, message: 'No se pudo completar el inicio de sesión social.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', refreshLimiter, async (req, res, next) => {
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
    const newRefresh = signRefresh(user.id);
    await user.update({ refresh_token: await bcrypt.hash(newRefresh, 12) });
    res.json({ success: true, token, refresh_token: newRefresh });
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

// POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, [
  body('email').isEmail().normalizeEmail(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Email inválido' });
    const { email } = req.body;
    // Always return 200 to avoid user enumeration
    const user = await User.findOne({ where: { email: email.toLowerCase().trim(), is_active: true } });
    if (user) {
      // Token signed with JWT_SECRET + current password hash (invalidates when password changes)
      const secret = process.env.JWT_SECRET + user.password_hash;
      const token = jwt.sign({ id: user.id, sub: 'reset' }, secret, { expiresIn: '1h' });
      const link = `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}&id=${user.id}`;
      const { sendEmail } = require('../services/emailService');
      await sendEmail(user.email, 'recuperar_contrasena', {
        nombre: user.nombre || 'Usuario',
        link,
      });
      logger.info(`[AUTH] Password reset requested for ${user.email}`);
    }
    res.json({ success: true, message: 'Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña.' });
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password
router.post('/reset-password', passwordResetLimiter, [
  body('token').notEmpty(),
  body('id').isUUID(),
  // S-11: misma política de contraseña fuerte que el registro.
  body('password').custom((value) => {
    if (!isStrongPassword(value)) {
      throw new Error('La contraseña debe tener mínimo 6 caracteres, mayúscula, minúscula, número y un símbolo.');
    }
    return true;
  }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msgs = errors.array().map((e) => e.msg);
      return res.status(400).json({ success: false, message: msgs[0] || 'Datos inválidos' });
    }
    const { token, id, password } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(400).json({ success: false, message: 'Enlace inválido o expirado' });
    try {
      const secret = process.env.JWT_SECRET + user.password_hash;
      jwt.verify(token, secret);
    } catch {
      return res.status(400).json({ success: false, message: 'El enlace expiró o ya fue usado. Solicita uno nuevo.' });
    }
    const hash = await bcrypt.hash(password, 12);
    await user.update({ password_hash: hash, refresh_token: null });
    logger.info(`[AUTH] Password reset completed for ${user.email}`);
    res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (err) { next(err); }
});

module.exports = router;
