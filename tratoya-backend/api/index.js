const app = require('../src/index');
const { connectDB } = require('../src/config/database');
const logger = require('../src/utils/logger');

let ready;

module.exports = async (req, res) => {
  try {
    if (req.url === '/health' || req.url.startsWith('/health?')) {
      return app(req, res);
    }
    if (!ready) {
      ready = connectDB().then(() => logger.info('[VERCEL] DB ready'));
    }
    await ready;
    return app(req, res);
  } catch (err) {
    logger.error(`[VERCEL] Startup error: ${err.message}`);
    res.statusCode = 500;
    return res.end(JSON.stringify({ success: false, message: 'Error iniciando API' }));
  }
};
