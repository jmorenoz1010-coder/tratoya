const crypto = require('crypto');
const { safeRedis } = require('../config/redis');
const logger = require('./logger');

const PREFIX = 'oauth:code:';
const TTL_SEC = 300; // 5 min — holgado para el redirect del proveedor
const mem = new Map();

// IMPORTANTE: en Vercel serverless el callback OAuth y el /exchange caen en
// instancias distintas, por lo que un Map en memoria NO se comparte. Usamos
// Postgres como fuente confiable entre instancias (Redis es solo vía rápida).
const getSequelize = () => require('../config/database').sequelize;

let tableReady = null;
function ensureTable() {
  if (tableReady) return tableReady;
  tableReady = getSequelize().query(`
    CREATE TABLE IF NOT EXISTS oauth_codes (
      code VARCHAR(80) PRIMARY KEY,
      payload JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `).catch((e) => { tableReady = null; throw e; });
  return tableReady;
}

function deleteDbCode(code) {
  try {
    getSequelize().query('DELETE FROM oauth_codes WHERE code = :code', { replacements: { code } }).catch(() => {});
  } catch { /* noop */ }
}

async function issueOAuthCode(payload) {
  const code = crypto.randomBytes(32).toString('hex');
  const json = JSON.stringify(payload);
  const expMs = Date.now() + TTL_SEC * 1000;

  // 1) Postgres (compartido entre instancias serverless)
  try {
    await ensureTable();
    const sequelize = getSequelize();
    await sequelize.query(
      'INSERT INTO oauth_codes (code, payload, expires_at) VALUES (:code, CAST(:payload AS JSONB), :exp)',
      { replacements: { code, payload: json, exp: new Date(expMs).toISOString() } }
    );
    sequelize.query('DELETE FROM oauth_codes WHERE expires_at < NOW()').catch(() => {});
  } catch (e) {
    logger.warn(`[OAUTH] No se pudo guardar el code en DB: ${e.message}`);
  }

  // 2) Redis (rápido) y 3) memoria (último recurso, mismo proceso)
  await safeRedis.set(`${PREFIX}${code}`, json, { EX: TTL_SEC });
  mem.set(code, { json, exp: expMs });
  return code;
}

async function consumeOAuthCode(code) {
  if (!code) return null;

  // 1) Redis
  try {
    const json = await safeRedis.get(`${PREFIX}${code}`);
    if (json) {
      await safeRedis.del(`${PREFIX}${code}`);
      mem.delete(code);
      deleteDbCode(code);
      return JSON.parse(json);
    }
  } catch { /* sigue a DB */ }

  // 2) Postgres
  try {
    await ensureTable();
    const { QueryTypes } = require('sequelize');
    const rows = await getSequelize().query(
      'SELECT payload, expires_at FROM oauth_codes WHERE code = :code',
      { replacements: { code }, type: QueryTypes.SELECT }
    );
    if (rows && rows[0]) {
      deleteDbCode(code); // un solo uso
      mem.delete(code);
      const exp = new Date(rows[0].expires_at).getTime();
      if (Number.isFinite(exp) && Date.now() > exp) return null;
      const { payload } = rows[0];
      return typeof payload === 'string' ? JSON.parse(payload) : payload;
    }
  } catch (e) {
    logger.warn(`[OAUTH] consume DB falló: ${e.message}`);
  }

  // 3) memoria (solo si todo lo anterior falló y es el mismo proceso)
  const rec = mem.get(code);
  mem.delete(code);
  if (!rec || Date.now() > rec.exp) return null;
  try { return JSON.parse(rec.json); } catch { return null; }
}

module.exports = { issueOAuthCode, consumeOAuthCode };
