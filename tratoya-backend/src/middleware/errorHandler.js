const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  logger.error(`[${req.method}] ${req.originalUrl} → ${status}: ${err.message}`);
  if (status >= 500) {
    // Detalle real (Postgres/driver) en texto plano y sin colores, para que sea
    // legible en los logs de producción. err.message de Sequelize suele ser un
    // envoltorio; el detalle útil vive en err.parent/err.original.
    const detail = err.parent?.message || err.original?.message;
    const pgCode = err.parent?.code || err.original?.code;
    console.error(
      `APP_ERROR ${req.method} ${req.originalUrl} name=${err.name || '-'} code=${pgCode || '-'} ` +
      `msg=${err.message || '-'}${detail ? ` detail=${detail}` : ''}`
    );
    if (err.stack) console.error(err.stack);
  }

  // Errores de Sequelize
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un registro con esos datos (email, cédula o código duplicado)',
    });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos: ' + err.errors.map(e => e.message).join(', '),
    });
  }

  res.status(status).json({
    success: false,
    message: err.expose || status < 500 || process.env.NODE_ENV !== 'production'
      ? err.message
      : 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
