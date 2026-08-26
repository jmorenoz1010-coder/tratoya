const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000;

function secret() {
  return process.env.JWT_SECRET || process.env.FILE_ACCESS_SECRET || '';
}

function createOauthState(provider) {
  const payload = Buffer.from(JSON.stringify({
    p: String(provider || ''),
    t: Date.now(),
    n: crypto.randomBytes(16).toString('hex'),
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function readOauthState(state) {
  if (!state || typeof state !== 'string' || !state.includes('.')) return null;
  const dot = state.indexOf('.');
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || Date.now() - Number(data.t) > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = { createOauthState, readOauthState };
