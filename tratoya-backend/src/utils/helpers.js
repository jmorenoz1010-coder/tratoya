async function generarCodigo() {
  try {
    const { Trato } = require('../config/database');
    const count = await Trato.count();
    const num = String(count + 1).padStart(5, '0');
    return `TY-${num}`;
  } catch {
    const num = String(Date.now()).slice(-5);
    return `TY-${num}`;
  }
}

module.exports = { generarCodigo };
