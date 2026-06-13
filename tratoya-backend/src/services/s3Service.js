const logger = require('../utils/logger');

/**
 * S3 / Cloudflare R2 service — Stub para desarrollo
 * TODO: Conectar con AWS SDK en producción
 */
async function s3Upload(key, buffer, mimetype) {
  logger.info(`[S3] Upload: ${key} (${mimetype})`);
  if (!process.env.AWS_BUCKET_NAME && !process.env.R2_BUCKET_NAME) {
    // En dev sin bucket: guardamos solo la clave; el acceso es vía /api/files/:token
    return key;
  }
  // Producción: subir a R2/S3 y retornar solo la clave (nunca URL pública directa).
  return key;
}

module.exports = { s3Upload };
