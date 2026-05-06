/**
 * ══════════════════════════════════════════════════════
 * TRATOYA · Push Notifications en tiempo real
 * Implementación usando Server-Sent Events (SSE)
 *
 * Sin dependencias externas — funciona con Express puro.
 * El frontend se conecta a GET /api/users/stream
 * y recibe eventos en tiempo real.
 * ══════════════════════════════════════════════════════
 */

const logger = require('../utils/logger');

// Mapa de conexiones activas: userId -> Set<Response>
const conexiones = new Map();

/**
 * Registra una conexión SSE de un usuario
 */
const registrarConexion = (userId, res) => {
  if (!conexiones.has(userId)) {
    conexiones.set(userId, new Set());
  }
  conexiones.get(userId).add(res);
  logger.debug(`[PUSH] Usuario ${userId} conectado · ${conexiones.get(userId).size} conexiones`);

  // Limpiar al desconectar
  res.on('close', () => {
    const conns = conexiones.get(userId);
    if (conns) {
      conns.delete(res);
      if (conns.size === 0) conexiones.delete(userId);
    }
    logger.debug(`[PUSH] Usuario ${userId} desconectado`);
  });
};

/**
 * Envía un evento push a un usuario específico
 * @param {string} userId  - UUID del usuario
 * @param {string} tipo    - tipo de evento
 * @param {object} datos   - payload del evento
 */
const pushAlUsuario = (userId, tipo, datos = {}) => {
  const conns = conexiones.get(String(userId));
  if (!conns || conns.size === 0) {
    logger.debug(`[PUSH] Usuario ${userId} sin conexiones activas`);
    return false;
  }

  const evento = JSON.stringify({ tipo, datos, timestamp: new Date().toISOString() });
  let enviados = 0;

  conns.forEach(res => {
    try {
      res.write(`data: ${evento}\n\n`);
      enviados++;
    } catch (err) {
      logger.warn(`[PUSH] Error enviando a ${userId}: ${err.message}`);
      conns.delete(res);
    }
  });

  logger.debug(`[PUSH] Evento '${tipo}' enviado a ${userId} (${enviados}/${conns.size})`);
  return enviados > 0;
};

/**
 * Envía un evento push a múltiples usuarios
 */
const pushAUsuarios = (userIds, tipo, datos = {}) => {
  userIds.filter(Boolean).forEach(id => pushAlUsuario(id, tipo, datos));
};

/**
 * Estadísticas de conexiones activas
 */
const getEstadisticas = () => ({
  usuarios_conectados: conexiones.size,
  total_conexiones: Array.from(conexiones.values()).reduce((s, c) => s + c.size, 0),
});

module.exports = { registrarConexion, pushAlUsuario, pushAUsuarios, getEstadisticas };
