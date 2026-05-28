const { createClient } = require('redis');
const logger = require('../utils/logger');

let client = null;
let reconnectDelay = 1000;
const MAX_DELAY = 30000;
const REDIS_REQUIRED = process.env.REDIS_REQUIRED === 'true';

async function connectRedis() {
  client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1500),
      reconnectStrategy: (retries) => {
        if (!REDIS_REQUIRED) {
          return false;
        }
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
        logger.warn(`Redis reintentando conexion #${retries} en ${reconnectDelay}ms`);
        return reconnectDelay;
      },
    },
  });

  client.on('error', (err) => {
    logger.error('Redis error: ' + err.message);
  });
  client.on('reconnecting', () => {
    logger.warn('Redis reconectando...');
  });
  client.on('ready', () => {
    reconnectDelay = 1000;
    logger.info('Redis listo');
  });

  try {
    await client.connect();
  } catch (err) {
    if (REDIS_REQUIRED) throw err;
    logger.warn(`Redis no disponible; cache deshabilitado (${err.message})`);
    client = null;
  }
  return client;
}

const getRedis = () => client;

// Wrapper seguro: si Redis no esta disponible, no detiene la app.
const safeRedis = {
  async get(key) {
    try { return client?.isReady ? await client.get(key) : null; } catch { return null; }
  },
  async set(key, value, options) {
    try { if (client?.isReady) await client.set(key, value, options); } catch { /* silencioso */ }
  },
  async del(key) {
    try { if (client?.isReady) await client.del(key); } catch { /* silencioso */ }
  },
};

module.exports = { connectRedis, getRedis, safeRedis };
