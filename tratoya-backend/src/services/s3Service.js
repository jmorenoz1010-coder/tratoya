const logger = require('../utils/logger');

/**
 * S3 / Cloudflare R2 service — Stub para desarrollo
 * TODO: Conectar con AWS SDK en producción
 */
async function s3Upload(key, buffer, mimetype) {
  logger.info(`[S3] Upload: ${key} (${mimetype})`);
  if (!process.env.AWS_BUCKET_NAME && !process.env.R2_BUCKET_NAME) {
    return `data:${mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
  }
  // Produccion recomendada: conectar Cloudflare R2/S3 y retornar URL firmada o publica.
  return `https://cdn.tratoya.co/${key}`;
}

module.exports = { s3Upload };
