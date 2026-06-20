// =============================================
// KYC REQUIRED MIDDLEWARE
// Verifica que el usuario tenga al menos KYC básico
// =============================================
const kycRequired = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Autenticación requerida' });
  }
  if (req.user.kyc_nivel === 'ninguno') {
    return res.status(403).json({
      success: false,
      message: 'Debes verificar tu identidad para crear tratos. Ve a Perfil → KYC.',
      code: 'KYC_REQUIRED'
    });
  }
  if (!req.user.telefono || String(req.user.telefono).trim().length < 7) {
    return res.status(403).json({
      success: false,
      message: 'Agrega tu número de celular en Perfil antes de crear o aceptar tratos.',
      code: 'PHONE_REQUIRED'
    });
  }
  next();
};

module.exports = kycRequired;
