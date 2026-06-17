/**
 * Censura de datos de contacto en el chat para evitar que las partes se salgan
 * de la plataforma (intercambio de números, correos o enlaces). Reemplaza la
 * información detectada por un marcador, conservando el resto del mensaje.
 */

const MARCA = '•••';

// Teléfonos: +57, indicativos, móviles (10 díg.) o secuencias de 7+ dígitos
// separadas por espacios/guiones/puntos. Los montos con separador de miles
// (ej. 599.000 = 6 díg.) no se ven afectados.
const RE_TEL = /(?:\+?\d[\s.\-]?){7,}\d/g;
const RE_EMAIL = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
const RE_URL = /\b(?:https?:\/\/|www\.)[^\s]+/gi;

// Palabras que insinúan contacto fuera de la plataforma (se enmascaran junto a
// lo que les sigue solo si viene acompañado de dígitos/arroba, manejado arriba).
const RE_CONTACTO = /\b(whats?app|wasa?p|wsp|telegram|instagram|messenger|@[a-z0-9_.]{3,})\b/gi;

function censurarTexto(texto) {
  const original = String(texto || '');
  let out = original;
  out = out.replace(RE_EMAIL, MARCA);
  out = out.replace(RE_URL, MARCA);
  out = out.replace(RE_TEL, MARCA);
  out = out.replace(RE_CONTACTO, MARCA);
  const censurado = out !== original;
  return { texto: out, censurado };
}

module.exports = { censurarTexto };
