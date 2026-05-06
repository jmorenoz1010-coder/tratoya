const { Sequelize, DataTypes } = require('sequelize');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  }
);

async function connectDB() {
  await sequelize.authenticate();
  const shouldSync = process.env.DB_SYNC === 'true' || process.env.NODE_ENV !== 'production';
  if (shouldSync) {
    await sequelize.sync({ alter: true }); // Crea/actualiza tablas automáticamente
  }
}

// ══════════════════════════════════════
// MODELO: USER
// ══════════════════════════════════════
const User = sequelize.define('User', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nombre:        { type: DataTypes.STRING(100), allowNull: false },
  apellido:      { type: DataTypes.STRING(100), allowNull: false },
  email:         { type: DataTypes.STRING(255), allowNull: false, unique: true },
  telefono:      { type: DataTypes.STRING(20) },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  cedula:        { type: DataTypes.STRING(20), unique: true },
  fecha_nacimiento: { type: DataTypes.DATEONLY },
  ciudad:        { type: DataTypes.STRING(100) },
  foto_perfil:   { type: DataTypes.STRING(500) },
  kyc_nivel:     { type: DataTypes.ENUM('ninguno','basico','plata','oro','platino'), defaultValue: 'ninguno' },
  kyc_estado:    { type: DataTypes.ENUM('pendiente','en_revision','aprobado','rechazado'), defaultValue: 'pendiente' },
  cedula_frente_url:  { type: DataTypes.STRING(500) },
  cedula_reverso_url: { type: DataTypes.STRING(500) },
  selfie_url:    { type: DataTypes.STRING(500) },
  kyc_verificado_en:  { type: DataTypes.DATE },
  reputacion:    { type: DataTypes.DECIMAL(3,2), defaultValue: 0 },
  total_resenas: { type: DataTypes.INTEGER, defaultValue: 0 },
  total_tratos:  { type: DataTypes.INTEGER, defaultValue: 0 },
  tratos_exitosos: { type: DataTypes.INTEGER, defaultValue: 0 },
  plan:          { type: DataTypes.ENUM('gratuito','pro','business'), defaultValue: 'gratuito' },
  plan_expira:   { type: DataTypes.DATE },
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  is_blocked:    { type: DataTypes.BOOLEAN, defaultValue: false },
  is_admin:      { type: DataTypes.BOOLEAN, defaultValue: false },
  rol:           { type: DataTypes.ENUM('invitado','user','soporte','moderador','admin','superadmin'), defaultValue: 'user' },
  es_mediador:   { type: DataTypes.BOOLEAN, defaultValue: false },
  email_verificado:    { type: DataTypes.BOOLEAN, defaultValue: false },
  telefono_verificado: { type: DataTypes.BOOLEAN, defaultValue: false },
  two_factor:    { type: DataTypes.BOOLEAN, defaultValue: false },
  require_2fa:   { type: DataTypes.BOOLEAN, defaultValue: false },
  last_login:    { type: DataTypes.DATE },
  refresh_token: { type: DataTypes.TEXT },
}, { tableName: 'users', timestamps: true, paranoid: true });

// ══════════════════════════════════════
// MODELO: TRATO
// ══════════════════════════════════════
const Trato = sequelize.define('Trato', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  codigo:     { type: DataTypes.STRING(20), unique: true },
  titulo:     { type: DataTypes.STRING(255), allowNull: false },
  descripcion: { type: DataTypes.TEXT },
  tipo:       { type: DataTypes.ENUM('producto','servicio','reserva','vehiculo','inmueble','otro'), allowNull: false },
  comprador_id: { type: DataTypes.UUID },
  vendedor_id:  { type: DataTypes.UUID },
  monto:       { type: DataTypes.DECIMAL(15,2), allowNull: false },
  comision_pct: { type: DataTypes.DECIMAL(5,4) },
  comision_monto: { type: DataTypes.DECIMAL(15,2) },
  monto_neto:  { type: DataTypes.DECIMAL(15,2) },
  quien_paga_comision: { type: DataTypes.ENUM('comprador','vendedor','compartida'), defaultValue: 'comprador' },
  moneda:     { type: DataTypes.STRING(3), defaultValue: 'COP' },
  estado: {
    type: DataTypes.ENUM(
      'borrador','activo','pago_pendiente','pago_retenido',
      'en_entrega','pendiente_confirmacion',
      'confirmado','completado',
      'disputado','cancelado','expirado'
    ),
    defaultValue: 'borrador',
  },
  fecha_creado:       { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  fecha_activado:     { type: DataTypes.DATE },
  fecha_pago:         { type: DataTypes.DATE },
  fecha_entrega:      { type: DataTypes.DATE },
  fecha_confirmacion: { type: DataTypes.DATE },
  fecha_liberacion:   { type: DataTypes.DATE },
  fecha_expiracion:   { type: DataTypes.DATE },
  dias_inspeccion:    { type: DataTypes.INTEGER, defaultValue: 7 },
  guia_envio:         { type: DataTypes.STRING(100) },
  transportadora:     { type: DataTypes.STRING(100) },
  tracking_url:       { type: DataTypes.STRING(500) },
  notas:              { type: DataTypes.TEXT },
  notas_internas:     { type: DataTypes.TEXT },
  link_compartir:     { type: DataTypes.STRING(100), unique: true },
  ip_creacion:        { type: DataTypes.STRING(50) },
  metadata:           { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'tratos', timestamps: true, paranoid: true });

// ══════════════════════════════════════
// MODELO: PAGO
// ══════════════════════════════════════
const Pago = sequelize.define('Pago', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trato_id:     { type: DataTypes.UUID },
  usuario_id:   { type: DataTypes.UUID },
  tipo:         { type: DataTypes.ENUM('retencion','liberacion','devolucion','comision'), allowNull: false },
  monto:        { type: DataTypes.DECIMAL(15,2), allowNull: false },
  moneda:       { type: DataTypes.STRING(3), defaultValue: 'COP' },
  pasarela:     { type: DataTypes.ENUM('wompi','payu','epayco','bold','transferencia'), allowNull: false },
  pasarela_ref: { type: DataTypes.STRING(200) },
  pasarela_estado: { type: DataTypes.STRING(50) },
  metodo_pago:  { type: DataTypes.ENUM('pse','tarjeta_credito','tarjeta_debito','nequi','daviplata','efectivo','bancolombia','transferencia') },
  estado:       { type: DataTypes.ENUM('pendiente','procesando','aprobado','rechazado','reembolsado'), defaultValue: 'pendiente' },
  fecha_aprobacion: { type: DataTypes.DATE },
  fecha_desembolso: { type: DataTypes.DATE },
  comision_pasarela: { type: DataTypes.DECIMAL(15,2) },
  neto_desembolso:   { type: DataTypes.DECIMAL(15,2) },
  webhook_payload:   { type: DataTypes.JSONB },
  metadata:          { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'pagos', timestamps: true });

// ══════════════════════════════════════
// MODELO: DISPUTA
// ══════════════════════════════════════
const Disputa = sequelize.define('Disputa', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trato_id:   { type: DataTypes.UUID },
  abierta_por: { type: DataTypes.UUID },
  mediador_id: { type: DataTypes.UUID },
  motivo:     { type: DataTypes.STRING(200), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  tipo:       { type: DataTypes.ENUM('producto_danado','no_recibido','diferente','servicio_incompleto','fraude','otro'), allowNull: false },
  estado:     { type: DataTypes.ENUM('abierta','en_revision','esperando_info','resuelta','cerrada'), defaultValue: 'abierta' },
  resolucion: { type: DataTypes.ENUM('favor_comprador','favor_vendedor','acuerdo_mutuo','sin_resolucion') },
  monto_resolucion: { type: DataTypes.DECIMAL(15,2) },
  notas_mediador: { type: DataTypes.TEXT },
  sla_horas:  { type: DataTypes.INTEGER, defaultValue: 72 },
  fecha_limite: { type: DataTypes.DATE },
  fecha_resolucion: { type: DataTypes.DATE },
  evidencias: { type: DataTypes.JSONB, defaultValue: [] },
}, { tableName: 'disputas', timestamps: true });

// ══════════════════════════════════════
// MODELO: MENSAJE
// ══════════════════════════════════════
const Mensaje = sequelize.define('Mensaje', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trato_id:    { type: DataTypes.UUID },
  remitente_id: { type: DataTypes.UUID },
  tipo:        { type: DataTypes.ENUM('texto','imagen','documento','sistema'), defaultValue: 'texto' },
  contenido:   { type: DataTypes.TEXT, allowNull: false },
  archivo_url: { type: DataTypes.STRING(500) },
  leido:       { type: DataTypes.BOOLEAN, defaultValue: false },
  leido_en:    { type: DataTypes.DATE },
}, { tableName: 'mensajes', timestamps: true });

// ══════════════════════════════════════
// MODELO: RESENA
// ══════════════════════════════════════
const Resena = sequelize.define('Resena', {
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  trato_id:        { type: DataTypes.UUID },
  autor_id:        { type: DataTypes.UUID },
  destinatario_id: { type: DataTypes.UUID },
  calificacion:    { type: DataTypes.INTEGER, allowNull: false },
  comentario:      { type: DataTypes.TEXT },
}, { tableName: 'resenas', timestamps: true });

// ══════════════════════════════════════
// MODELO: CUENTA BANCARIA
// ══════════════════════════════════════
const CuentaBancaria = sequelize.define('CuentaBancaria', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  usuario_id: { type: DataTypes.UUID },
  banco:      { type: DataTypes.STRING(100), allowNull: false },
  tipo:       { type: DataTypes.ENUM('ahorros','corriente','nequi','daviplata'), allowNull: false },
  numero:     { type: DataTypes.STRING(30) },
  titular:    { type: DataTypes.STRING(200) },
  cedula_titular: { type: DataTypes.STRING(20) },
  verificada: { type: DataTypes.BOOLEAN, defaultValue: false },
  principal:  { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'cuentas_bancarias', timestamps: true });

// ══════════════════════════════════════
// MODELO: NOTIFICACION
// ══════════════════════════════════════
const Notificacion = sequelize.define('Notificacion', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  usuario_id: { type: DataTypes.UUID },
  tipo:       { type: DataTypes.STRING(50) },
  titulo:     { type: DataTypes.STRING(200) },
  cuerpo:     { type: DataTypes.TEXT },
  leida:      { type: DataTypes.BOOLEAN, defaultValue: false },
  accion_url: { type: DataTypes.STRING(200) },
  metadata:   { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'notificaciones', timestamps: true });

// ══════════════════════════════════════
// MODELO: TICKET DE SOPORTE
// ══════════════════════════════════════
const TicketSoporte = sequelize.define('TicketSoporte', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  usuario_id:  { type: DataTypes.UUID },
  usuario_email: { type: DataTypes.STRING(255) },
  categoria:   { type: DataTypes.ENUM('general','pago','trato','kyc','tecnico','otro'), defaultValue: 'general' },
  asunto:      { type: DataTypes.STRING(200), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  prioridad:   { type: DataTypes.ENUM('baja','media','alta'), defaultValue: 'media' },
  estado:      { type: DataTypes.ENUM('abierto','en_proceso','resuelto','cerrado'), defaultValue: 'abierto' },
  respuestas:  { type: DataTypes.JSONB, defaultValue: [] },
}, { tableName: 'tickets_soporte', timestamps: true });

// ══════════════════════════════════════
// ASOCIACIONES
// ══════════════════════════════════════
Trato.belongsTo(User, { as: 'comprador', foreignKey: 'comprador_id' });
Trato.belongsTo(User, { as: 'vendedor',  foreignKey: 'vendedor_id' });
User.hasMany(Trato, { as: 'tratos_comprador', foreignKey: 'comprador_id' });
User.hasMany(Trato, { as: 'tratos_vendedor',  foreignKey: 'vendedor_id' });
Trato.hasMany(Pago,    { foreignKey: 'trato_id' });
Pago.belongsTo(Trato,  { foreignKey: 'trato_id' });
Pago.belongsTo(User,   { foreignKey: 'usuario_id' });
Trato.hasMany(Mensaje, { foreignKey: 'trato_id' });
Mensaje.belongsTo(User, { as: 'remitente', foreignKey: 'remitente_id' });
Trato.hasOne(Disputa,  { foreignKey: 'trato_id' });
Disputa.belongsTo(Trato, { foreignKey: 'trato_id' });
Disputa.belongsTo(User, { as: 'aperturista', foreignKey: 'abierta_por' });
Trato.hasMany(Resena,  { foreignKey: 'trato_id' });
User.hasMany(CuentaBancaria, { foreignKey: 'usuario_id' });
User.hasMany(Notificacion,   { foreignKey: 'usuario_id' });
TicketSoporte.belongsTo(User, { as: 'usuario', foreignKey: 'usuario_id' });

module.exports = {
  sequelize, connectDB,
  User, Trato, Pago, Disputa, Mensaje, Resena, CuentaBancaria, Notificacion, TicketSoporte
};
