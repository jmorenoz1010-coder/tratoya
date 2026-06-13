const crypto = require('crypto');
const { safeRedis } = require('../config/redis');

const PREFIX = 'oauth:code:';
const TTL_SEC = 120;
const mem = new Map();

async function issueOAuthCode(payload) {
  const code = crypto.randomBytes(32).toString('hex');
  const json = JSON.stringify(payload);
  await safeRedis.set(`${PREFIX}${code}`, json, { EX: TTL_SEC });
  mem.set(code, { json, exp: Date.now() + TTL_SEC * 1000 });
  return code;
}

async function consumeOAuthCode(code) {
  if (!code) return null;
  const k = `${PREFIX}${code}`;
  let json = await safeRedis.get(k);
  if (json) {
    await safeRedis.del(k);
    mem.delete(code);
    try { return JSON.parse(json); } catch { return null; }
  }
  const rec = mem.get(code);
  mem.delete(code);
  if (!rec || Date.now() > rec.exp) return null;
  try { return JSON.parse(rec.json); } catch { return null; }
}

module.exports = { issueOAuthCode, consumeOAuthCode };
