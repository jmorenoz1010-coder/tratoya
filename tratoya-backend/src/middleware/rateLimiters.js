/* ═══════════════════════════════════════════════════════════════════
   RATE LIMITERS — anti-abuso por acción, usuario e IP
   ─────────────────────────────────────────────────────────────────
   En Vercel (serverless) el MemoryStore por defecto NO es confiable:
   cada instancia lambda tiene su propia memoria y se reinicia en cada
   cold start, por lo que un atacante repartido entre instancias puede
   superar el límite. Por eso usamos un store híbrido que usa Redis
   cuando está disponible (estado compartido entre instancias) y cae a
   memoria local solo como último recurso.

   IMPORTANTE: para que el rate limiting sea 100% efectivo en producción
   serverless debe existir REDIS_URL (p. ej. Upstash). Sin Redis, los
   límites siguen aplicando pero solo por instancia.
═══════════════════════════════════════════════════════════════════ */
const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

const isProd = process.env.NODE_ENV === 'production';

// Store híbrido: Redis si está listo, memoria local como fallback.
class HybridStore {
  constructor() {
    this.prefix = 'rl:';
    this.windowMs = 60000;
    this.mem = new Map();
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  _memIncrement(key) {
    const now = Date.now();
    let rec = this.mem.get(key);
    if (!rec || now > rec.resetTime) {
      rec = { count: 0, resetTime: now + this.windowMs };
      this.mem.set(key, rec);
    }
    rec.count += 1;
    return { totalHits: rec.count, resetTime: new Date(rec.resetTime) };
  }

  async increment(key) {
    const client = getRedis();
    if (client && client.isReady) {
      try {
        const k = this.prefix + key;
        const totalHits = await client.incr(k);
        const windowSec = Math.ceil(this.windowMs / 1000);
        if (totalHits === 1) await client.expire(k, windowSec);
        let ttl = await client.ttl(k);
        if (ttl < 0) {
          await client.expire(k, windowSec);
          ttl = windowSec;
        }
        return { totalHits, resetTime: new Date(Date.now() + ttl * 1000) };
      } catch (e) {
        // Redis falló en caliente → no bloqueamos la request, usamos memoria.
        logger.warn(`[RATELIMIT] Redis no disponible, usando memoria local: ${e.message}`);
      }
    }
    return this._memIncrement(key);
  }

  async decrement(key) {
    const client = getRedis();
    if (client && client.isReady) {
      try { await client.decr(this.prefix + key); } catch { /* noop */ }
    }
    const rec = this.mem.get(key);
    if (rec && rec.count > 0) rec.count -= 1;
  }

  async resetKey(key) {
    const client = getRedis();
    if (client && client.isReady) {
      try { await client.del(this.prefix + key); } catch { /* noop */ }
    }
    this.mem.delete(key);
  }
}

// Clave por acción + ámbito (usuario autenticado o IP). Diferentes acciones
// tienen cubetas independientes para no interferir entre sí.
const ipPart = (req) => {
  try { return rateLimit.ipKeyGenerator(req.ip); }
  catch { return req.ip; }
};

const keyGen = (name, by) => (req) => {
  if (by === 'user') return `${name}:u:${req.user?.id || ipPart(req)}`;
  if (by === 'ip') return `${name}:ip:${ipPart(req)}`;
  // user-or-ip: usuario si está autenticado, si no la IP.
  return req.user?.id ? `${name}:u:${req.user.id}` : `${name}:ip:${ipPart(req)}`;
};

const abuseHandler = (name) => (req, res, _next, options) => {
  logger.warn(
    `[ABUSE] limite "${name}" superado · ip=${req.ip} · user=${req.user?.id || '-'} ` +
    `· ${req.method} ${req.originalUrl} · ua="${req.get('user-agent') || '-'}"`
  );
  res.status(options.statusCode).json(options.message);
};

/**
 * Crea un limiter por acción.
 * @param {string} name  nombre único de la acción (define la cubeta)
 * @param {number} windowMs  ventana en ms
 * @param {number} max  máximo de solicitudes en la ventana (producción)
 * @param {number} maxDev  máximo en desarrollo (default: muy alto)
 * @param {'user'|'ip'|'user-or-ip'} by  ámbito del conteo
 * @param {string} message  mensaje al bloquear
 */
function createLimiter({ name, windowMs, max, maxDev = 100000, by = 'user-or-ip', message }) {
  return rateLimit({
    windowMs,
    max: isProd ? max : maxDev,
    standardHeaders: true,
    legacyHeaders: false,
    store: new HybridStore(),
    keyGenerator: keyGen(name, by),
    handler: abuseHandler(name),
    message: { success: false, message: message || 'Demasiadas solicitudes. Espera un momento y vuelve a intentar.' },
  });
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// ── Limiters por acción crítica ──────────────────────────────
const registerLimiter = createLimiter({
  name: 'register', windowMs: HOUR, max: 5, by: 'ip',
  message: 'Demasiados registros desde esta conexión. Intenta de nuevo en una hora.',
});

const crearTratoLimiter = createLimiter({
  name: 'crear_trato', windowMs: HOUR, max: 20, by: 'user-or-ip',
  message: 'Has creado demasiados tratos en poco tiempo. Espera un momento antes de crear otro.',
});

const reportePagoLimiter = createLimiter({
  name: 'reporte_pago', windowMs: HOUR, max: 20, by: 'user-or-ip',
  message: 'Demasiados reportes de pago seguidos. Espera unos minutos.',
});

const disputaLimiter = createLimiter({
  name: 'disputa', windowMs: HOUR, max: 8, by: 'user-or-ip',
  message: 'Demasiadas disputas en poco tiempo. Espera antes de abrir otra.',
});

const uploadLimiter = createLimiter({
  name: 'upload', windowMs: HOUR, max: 40, by: 'user-or-ip',
  message: 'Demasiadas subidas de archivos seguidas. Espera unos minutos.',
});

const chatLimiter = createLimiter({
  name: 'chat', windowMs: MIN, max: 40, by: 'user-or-ip',
  message: 'Estás enviando mensajes demasiado rápido. Espera un momento.',
});

const inviteLimiter = createLimiter({
  name: 'invite', windowMs: HOUR, max: 30, by: 'user-or-ip',
  message: 'Demasiadas invitaciones seguidas. Espera unos minutos.',
});

module.exports = {
  HybridStore,
  createLimiter,
  registerLimiter,
  crearTratoLimiter,
  reportePagoLimiter,
  disputaLimiter,
  uploadLimiter,
  chatLimiter,
  inviteLimiter,
};
