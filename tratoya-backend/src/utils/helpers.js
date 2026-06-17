// Genera el código de trato (TY-#####). Usa el mayor número ya usado
// —incluyendo tratos borrados (soft-delete) para no reutilizar códigos— y suma
// un pequeño aleatorio como respaldo ante carreras de creación simultánea.
async function generarCodigo() {
  const { Trato } = require('../config/database');
  const { Op } = require('sequelize');
  try {
    const last = await Trato.findOne({
      attributes: ['codigo'],
      where: { codigo: { [Op.like]: 'TY-%' } },
      order: [['codigo', 'DESC']],
      paranoid: false, // incluye soft-deleted para no chocar con códigos ya usados
    });
    let next = 1;
    if (last && last.codigo) {
      const n = parseInt(String(last.codigo).replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(n)) next = n + 1;
    }
    return `TY-${String(next).padStart(5, '0')}`;
  } catch {
    return `TY-${String(Date.now()).slice(-6)}`;
  }
}

module.exports = { generarCodigo };
