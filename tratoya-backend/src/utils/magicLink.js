const jwt = require('jsonwebtoken');

const frontendUrl = () => (process.env.FRONTEND_URL || 'https://tratoya.com').replace(/\/$/, '');

// Token de acceso desde el correo: inicia sesión con un clic y lleva al usuario
// al paso correspondiente sin volver a escribir credenciales.
function createMagicToken(userId) {
  return jwt.sign(
    { id: userId, sub: 'magic' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.MAGIC_LINK_EXPIRES_IN || '7d' }
  );
}

function magicLink(userId, next = '/') {
  if (!userId) return `${frontendUrl()}${next || '/'}`;
  const token = createMagicToken(userId);
  return `${frontendUrl()}/auth/magic?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next || '/')}`;
}

function verifyMagicToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.sub !== 'magic' || !decoded.id) return null;
    return decoded.id;
  } catch {
    return null;
  }
}

module.exports = { createMagicToken, magicLink, verifyMagicToken };
