const { wrapFileUrl } = require('./fileAccess');

const ESTADOS_SIN_CONTACTO = new Set(['borrador', 'activo', 'pago_pendiente']);

const sanitizeUser = (u, hideContact) => {
  if (!u) return null;
  const base = {
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    reputacion: u.reputacion,
    foto_perfil: u.foto_perfil,
    kyc_nivel: u.kyc_nivel,
    usuario_unico: u.usuario_unico,
  };
  if (!hideContact) return base;
  return base;
};

const sanitizePago = (pago, viewerId, dealId) => {
  if (!pago) return pago;
  const p = typeof pago.toJSON === 'function' ? pago.toJSON() : { ...pago };
  if (p.metadata && typeof p.metadata === 'object') {
    const meta = { ...p.metadata };
    if (meta.receipt_url) {
      meta.receipt_url = wrapFileUrl(meta.receipt_url, viewerId, dealId) || null;
      meta.has_receipt = Boolean(meta.receipt_url || p.metadata.receipt_url);
    }
    p.metadata = meta;
  }
  return p;
};

/** Respuesta segura de trato para participantes (sin PII anticipada ni notas internas). */
function toParticipantTrato(trato, viewerId) {
  if (!trato) return null;
  const t = typeof trato.toJSON === 'function' ? trato.toJSON() : { ...trato };
  const hideContact = ESTADOS_SIN_CONTACTO.has(t.estado);

  const {
    notas_internas, ip_creacion, ...safe
  } = t;

  safe.vendedor = sanitizeUser(t.vendedor, hideContact);
  safe.comprador = sanitizeUser(t.comprador, hideContact);

  if (Array.isArray(t.Pagos)) {
    safe.Pagos = t.Pagos.map((p) => sanitizePago(p, viewerId, t.id));
  } else if (Array.isArray(t.pagos)) {
    safe.Pagos = t.pagos.map((p) => sanitizePago(p, viewerId, t.id));
  }

  if (safe.metadata && typeof safe.metadata === 'object') {
    const meta = { ...safe.metadata };
    if (meta.receipt_url) meta.receipt_url = wrapFileUrl(meta.receipt_url, viewerId, t.id) || null;
    if (Array.isArray(meta.prueba_entrega_urls)) {
      meta.prueba_entrega_urls = meta.prueba_entrega_urls
        .map((u) => wrapFileUrl(u, viewerId, t.id))
        .filter(Boolean);
    }
    if (meta.release_receipt_url) {
      meta.release_receipt_url = wrapFileUrl(meta.release_receipt_url, viewerId, t.id) || null;
    }
    safe.metadata = meta;
  }

  return safe;
}

module.exports = { toParticipantTrato, sanitizeUser, sanitizePago, ESTADOS_SIN_CONTACTO };
