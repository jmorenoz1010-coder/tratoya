const crypto = require('crypto');

const secret = () => process.env.FILE_ACCESS_SECRET || process.env.JWT_SECRET || 'file-access-fallback';

/** Extrae la clave de almacenamiento desde una URL CDN o clave directa. */
function extractStorageKey(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;
  if (urlOrKey.startsWith('data:')) return null;
  if (!urlOrKey.includes('://')) return urlOrKey;
  try {
    const u = new URL(urlOrKey);
    return u.pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

function signFileAccess(storageKey, userId, dealId = '', ttlSec = 900) {
  if (!storageKey || !userId) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${storageKey}|${userId}|${dealId}|${exp}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifyFileAccess(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString();
  } catch {
    return null;
  }
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (sig !== expected) return null;
  const parts = payload.split('|');
  if (parts.length < 4) return null;
  const [key, userId, dealId, expStr] = parts;
  const exp = Number(expStr);
  if (!key || !userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return { key, userId, dealId: dealId || null, exp };
}

/** Reemplaza URLs de archivos sensibles por tokens de acceso temporal. */
function wrapFileUrl(urlOrKey, userId, dealId) {
  if (!urlOrKey) return null;
  if (String(urlOrKey).startsWith('data:')) return null;
  const key = extractStorageKey(urlOrKey);
  if (!key) return null;
  const token = signFileAccess(key, userId, dealId);
  if (!token) return null;
  const apiBase = (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');
  return apiBase ? `${apiBase}/api/files/${token}` : `/api/files/${token}`;
}

module.exports = { extractStorageKey, signFileAccess, verifyFileAccess, wrapFileUrl };
