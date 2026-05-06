const jwt = require('jsonwebtoken');
const { User } = require('../config/database');

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash', 'refresh_token'] }
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ success: false, message: 'Cuenta suspendida. Contacta soporte.' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expirado. Inicia sesión de nuevo.' });
    }
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};
