const logger = require('../utils/logger');

/**
 * S3 / Cloudflare R2 service — Stub para desarrollo
 * TODO: Conectar con AWS SDK en producción
 */
async function s3Upload(key, buffer, mimetype) {
  logger.info(`[S3] Upload simulado: ${key} (${mimetype})`);
  // En producción:
  // const AWS = require('aws-sdk');
  // const s3 = new AWS.S3();
  // await s3.putObject({ Bucket: process.env.AWS_BUCKET_NAME, Key: key, Body: buffer, ContentType: mimetype }).promise();
  return `https://cdn.tratoya.co/${key}`;
}

module.exports = { s3Upload };
