require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// ── Handlers globales de errores no capturados ─────────
process.on('uncaughtException', (err) => {
  logger.error('💥 uncaughtException — proceso continuará:', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('💥 unhandledRejection:', reason instanceof Error ? reason.message : reason);
});

// Rutas
const authRoutes     = require('./routes/auth');
const tratoRoutes    = require('./routes/tratos');
const allRoutes      = require('./routes/all-routes');
const waitlistRoutes = require('./routes/waitlist');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Seguridad ──────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const envOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const allowed = [
      process.env.FRONTEND_URL || 'https://tratoya.com',
      'https://tratoya.com',
      'https://www.tratoya.com',
      ...envOrigins,
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    const isLocalNetwork = process.env.NODE_ENV !== 'production'
      && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origin);
    if (allowed.includes(origin) || isLocalNetwork) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

// ── Rate limiting ──────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: process.env.NODE_ENV === 'production' ? 1200 : 20000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.includes('/users/stream') || req.path.includes('/health'),
  message: { success: false, message: 'Demasiadas solicitudes. Espera un momento y vuelve a intentar.' }
}));

const waitlistRegistroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados registros desde esta IP. Intenta de nuevo en una hora.' },
});

const waitlistLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas consultas. Intenta de nuevo en unos minutos.' },
});

// ── Body parsing ───────────────────────────────
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Acceso temporal a archivos (URLs firmadas vía token) ──
const { verifyFileAccess } = require('./utils/fileAccess');
app.get('/api/files/:token', async (req, res) => {
  const info = verifyFileAccess(req.params.token);
  if (!info) {
    return res.status(403).json({ success: false, message: 'Enlace de archivo expirado o inválido.' });
  }
  // Sirve el archivo privado de R2 con una URL firmada de corta duración.
  try {
    const { s3SignedUrl, isConfigured } = require('./services/s3Service');
    if (isConfigured()) {
      const signed = await s3SignedUrl(info.key, 300);
      if (signed) return res.redirect(302, signed);
    }
  } catch (e) {
    logger.warn(`[FILES] No se pudo firmar URL: ${e.message}`);
  }
  // Fallback (si R2 no está configurado): CDN público por key.
  const cdn = (process.env.CDN_BASE_URL || 'https://cdn.tratoya.co').replace(/\/$/, '');
  return res.redirect(302, `${cdn}/${info.key}`);
});

// ── Health check ───────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'TratoYa API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Rutas API ──────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/tratos',   tratoRoutes);
app.use('/api/waitlist/registro', waitlistRegistroLimiter);
app.use('/api/waitlist/posicion', waitlistLookupLimiter);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/users',    allRoutes.users);
app.use('/api/payments', allRoutes.payments);
app.use('/api/messages', allRoutes.messages);
app.use('/api/reviews',  allRoutes.reviews);
app.use('/api/disputes', allRoutes.disputes);
app.use('/api/kyc',      allRoutes.kyc);
app.use('/api/admin',    allRoutes.admin);
app.use('/api/webhooks', allRoutes.webhooks);

// ── 404 ────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Ruta ${req.method} ${req.originalUrl} no encontrada` });
});

// ── Error global ───────────────────────────────
app.use(errorHandler);

// ── Iniciar servidor ───────────────────────────
async function start() {
  try {
    await connectDB();
    logger.info('✅ PostgreSQL conectado y tablas sincronizadas');

    try {
      await connectRedis();
      logger.info('✅ Redis conectado');
    } catch (e) {
      logger.warn('⚠️  Redis no disponible — continuando sin caché');
    }

    app.listen(PORT, () => {
      logger.info(`🚀 TratoYa API corriendo en http://localhost:${PORT}`);
      logger.info(`🔍 Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Error iniciando servidor:', err);
    process.exit(1);
  }
}

if (process.env.VERCEL !== '1') {
  start();
} else {
  // En Vercel (serverless): pre-calentar DB y Redis para rate limiting compartido.
  const { sequelize } = require('./config/database');
  const { connectRedis } = require('./config/redis');
  sequelize.authenticate().catch((e) => {
    logger.warn('⚠️  DB warm-up en Vercel falló:', e.message);
  });
  connectRedis().then(() => {
    logger.info('✅ Redis conectado (serverless warm-up)');
  }).catch((e) => {
    logger.warn(`⚠️  Redis no disponible en Vercel — rate limit por instancia (${e.message})`);
  });
}
module.exports = app;
