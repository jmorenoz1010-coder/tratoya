// S-05: validación real de archivos subidos (comprobantes de pago, pruebas de
// entrega, KYC). No confía en la extensión del nombre: verifica los "magic bytes"
// reales del contenido y restringe a un allowlist de tipos seguros.

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB por archivo

// Firmas (magic bytes) de los tipos permitidos.
const SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'webp', mime: 'image/webp', test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { ext: 'pdf', mime: 'application/pdf', test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
];

/**
 * Valida un archivo de multer (memoryStorage).
 * @returns {{ ok: true, ext: string, mime: string } | { ok: false, message: string }}
 */
function validateUpload(file, { maxBytes = MAX_FILE_BYTES } = {}) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    return { ok: false, message: 'El archivo está vacío o no se pudo leer.' };
  }
  if (file.buffer.length > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, message: `El archivo supera el tamaño máximo de ${mb} MB.` };
  }
  const match = SIGNATURES.find((s) => {
    try { return s.test(file.buffer); } catch { return false; }
  });
  if (!match) {
    return { ok: false, message: 'Formato no permitido. Sube una imagen (JPG, PNG, WEBP) o un PDF.' };
  }
  return { ok: true, ext: match.ext, mime: match.mime };
}

module.exports = { validateUpload, MAX_FILE_BYTES };
