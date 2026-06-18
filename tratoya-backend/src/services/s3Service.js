const logger = require('../utils/logger');

/**
 * Almacenamiento de archivos (comprobantes, KYC, evidencias) en Cloudflare R2
 * vía API S3-compatible. El bucket es PRIVADO: la lectura se hace con URLs
 * firmadas de corta duración (s3SignedUrl), nunca con URLs públicas.
 *
 * Variables de entorno requeridas (Vercel):
 *   R2_ACCOUNT_ID         (o R2_ENDPOINT completo)
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 */

let _client = null;

function getEndpoint() {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT.replace(/\/$/, '');
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return null;
}

const bucket = () => process.env.R2_BUCKET_NAME || process.env.AWS_BUCKET_NAME || null;

function getClient() {
  if (_client) return _client;
  const endpoint = getEndpoint();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket()) return null;
  const { S3Client } = require('@aws-sdk/client-s3');
  _client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return _client;
}

const isConfigured = () => Boolean(getClient());

// Sube el archivo a R2 y devuelve la "key" (ruta interna). Si R2 no está
// configurado, registra una advertencia y devuelve la key igual (no rompe el
// flujo, pero el archivo no quedará disponible hasta configurar R2).
async function s3Upload(key, buffer, mimetype) {
  const c = getClient();
  if (!c) {
    logger.warn(`[R2] No configurado — archivo NO persistido: ${key}`);
    return key;
  }
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await c.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: buffer,
    ContentType: mimetype || 'application/octet-stream',
  }));
  logger.info(`[R2] ✓ Subido: ${key} (${mimetype})`);
  return key;
}

// URL firmada de lectura (GET) de corta duración para servir el archivo privado.
async function s3SignedUrl(key, ttlSeconds = 300) {
  const c = getClient();
  if (!c || !key) return null;
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return getSignedUrl(c, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: ttlSeconds });
}

module.exports = { s3Upload, s3SignedUrl, isConfigured };
