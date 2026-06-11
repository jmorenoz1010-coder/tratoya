const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const pg = require('pg');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  {
    dialect: 'postgres',
    dialectModule: pg,
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: process.env.VERCEL === '1' ? 2 : 10,
      min: 0,
      acquire: 10000,
      idle: 10000,
    },
    dialectOptions: process.env.DB_SSL === 'true' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  }
);

async function ensureBrebEnumValue() {
  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_cuentas_bancarias_tipo')
          AND enumlabel = 'breb'
        ) THEN
          ALTER TYPE enum_cuentas_bancarias_tipo ADD VALUE 'breb';
        END IF;
      END
      $$;
    `);
  } catch { /* si el ENUM no existe aún, sync lo creará correctamente */ }
}

async function ensureKycNivelValues() {
  try {
    for (const val of ['verificado', 'premium']) {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_kyc_nivel')
            AND enumlabel = '${val}'
          ) THEN
            ALTER TYPE enum_users_kyc_nivel ADD VALUE '${val}';
          END IF;
        END
        $$;
      `);
    }
  } catch { /* si el ENUM no existe aún, sync lo creará correctamente */ }
}

async function ensureUserRegistrationColumns() {
  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_tipo_identificacion') THEN
          CREATE TYPE enum_users_tipo_identificacion AS ENUM ('CC','CE','TI','PA','PEP','NIT','OTRO');
        END IF;
      END
      $$;
    `);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usuario_unico VARCHAR(40);`);
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tipo_identificacion') THEN
          ALTER TABLE users ADD COLUMN tipo_identificacion VARCHAR(10) DEFAULT 'CC';
        END IF;
      END
      $$;
    `);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_usuario_unico_unique ON users (usuario_unico) WHERE usuario_unico IS NOT NULL;`);
  } catch (e) {
    console.warn('[DB] ensureUserRegistrationColumns warning:', e.message);
  }
}

async function ensureWaitlistTables() {
  try {
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_estado') THEN
          CREATE TYPE waitlist_estado AS ENUM ('en_espera', 'fundador', 'activado');
        END IF;
      END
      $$;
    `);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        telefono VARCHAR(20),
        ciudad VARCHAR(100),
        posicion INTEGER UNIQUE,
        referral_code VARCHAR(20) UNIQUE,
        referred_by UUID REFERENCES waitlist(id) NULL,
        referidos_count INTEGER DEFAULT 0,
        posicion_ganada INTEGER DEFAULT 0,
        estado waitlist_estado DEFAULT 'en_espera',
        es_fundador BOOLEAN DEFAULT false,
        activated_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        ip_address VARCHAR(45)
      );
    `);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS waitlist_eventos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        waitlist_id UUID REFERENCES waitlist(id),
        tipo VARCHAR(50),
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS waitlist_email_idx ON waitlist (LOWER(email));`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS waitlist_referral_code_idx ON waitlist (referral_code);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON waitlist (created_at);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS waitlist_ip_created_idx ON waitlist (ip_address, created_at);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS waitlist_eventos_waitlist_idx ON waitlist_eventos (waitlist_id, created_at);`);
  } catch (e) {
    console.warn('[DB] ensureWaitlistTables warning:', e.message);
  }
}

async function connectDB() {
  await sequelize.authenticate();
  const isProductionRuntime = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const shouldAlterSync = process.env.DB_SYNC === 'true' || !isProductionRuntime;
  const shouldPlainSync = process.env.DB_SYNC === 'plain' || (!isProductionRuntime && process.env.DB_SYNC !== 'false');
  if (shouldAlterSync) {
    await sequelize.sync({ alter: true });
  } else if (shouldPlainSync) {
    await sequelize.sync();
  }
  const shouldBootstrapDb = !isProductionRuntime || process.env.DB_BOOTSTRAP === 'true';
  if (shouldBootstrapDb) {
    await ensureBrebEnumValue();
    await ensureKycNivelValues();
    await ensureUserRegistrationColumns();
    await ensureWaitlistTables();
  }

  if (shouldBootstrapDb && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const adminEmail = process.env.ADMIN_EMAIL.toLowerCase();
    const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    const [admin, created] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        nombre: process.env.ADMIN_NAME || 'Admin',
        apellido: process.env.ADMIN_LASTNAME || 'TratoYA',
        email: adminEmail,
        telefono: process.env.ADMIN_PHONE || null,
        password_hash: adminPasswordHash,
        cedula: process.env.ADMIN_CEDULA || null,
        ciudad: process.env.ADMIN_CITY || 'Bogota',
        kyc_nivel: 'basico',
        kyc_estado: 'aprobado',
        is_admin: true,
        rol: process.env.ADMIN_ROLE || 'superadmin',
        email_verificado: true,
        telefono_verificado: true,
        is_active: true,
        is_blocked: false,
      },
    });

    const shouldResetAdmin = process.env.ADMIN_RESET_ON_BOOT === 'true';
    if (!created) {
      const updates = {
        nombre: admin.nombre || process.env.ADMIN_NAME || 'Admin',
        apellido: admin.apellido || process.env.ADMIN_LASTNAME || 'TratoYA',
        is_admin: true,
        rol: process.env.ADMIN_ROLE || 'superadmin',
        kyc_nivel: admin.kyc_nivel === 'ninguno' ? 'basico' : admin.kyc_nivel,
        kyc_estado: admin.kyc_estado === 'pendiente' ? 'aprobado' : admin.kyc_estado,
        email_verificado: true,
        is_active: true,
        is_blocked: false,
      };
      if (shouldResetAdmin) updates.password_hash = adminPasswordHash;
      await admin.update(updates);
    }

    logger.info(`[DB] Admin ${created ? 'creado' : 'verificado'}: ${adminEmail}`);
  }

  // ── Ultra Admin opcional (solo si está completamente configurado por env) ──
  // S-01: sin contraseñas hardcodeadas ni reseteo automático en cada arranque.
  // Para sembrar/rotar este admin se debe activar explícitamente con ULTRA_ADMIN_SEED=true
  // y proveer ULTRA_ADMIN_EMAIL + ULTRA_ADMIN_PASSWORD. Nunca se resetea sin pedirlo.
  if (!shouldBootstrapDb) return;
  if (process.env.ULTRA_ADMIN_SEED !== 'true') return;
  const ULTRA_PWD = process.env.ULTRA_ADMIN_PASSWORD;
  const ULTRA_EMAIL = (process.env.ULTRA_ADMIN_EMAIL || '').toLowerCase();
  if (!ULTRA_PWD || !ULTRA_EMAIL) {
    logger.warn('[DB] ULTRA_ADMIN_SEED activo pero faltan ULTRA_ADMIN_EMAIL/PASSWORD — se omite.');
    return;
  }
  try {
    const ultraHash = await bcrypt.hash(ULTRA_PWD, 12);
    const [ultraUser, ultraCreated] = await User.findOrCreate({
      where: { email: ULTRA_EMAIL },
      defaults: {
        nombre: process.env.ULTRA_ADMIN_NAME || 'Admin',
        apellido: process.env.ULTRA_ADMIN_LASTNAME || 'TratoYa',
        email: ULTRA_EMAIL,
        usuario_unico: process.env.ULTRA_ADMIN_HANDLE || null,
        password_hash: ultraHash,
        rol: 'superadmin',
        is_admin: true,
        is_active: true,
        kyc_nivel: 'premium',
        kyc_estado: 'aprobado',
        email_verificado: true,
        telefono_verificado: true,
        is_blocked: false,
      },
    });
    // Rotación de contraseña solo si se pide explícitamente.
    if (!ultraCreated && process.env.ULTRA_ADMIN_RESET === 'true') {
      await ultraUser.update({ password_hash: ultraHash, rol: 'superadmin', is_admin: true, is_active: true, is_blocked: false });
    }
    logger.info(`[DB] Ultra admin ${ultraCreated ? 'creado' : 'verificado'}: ${ULTRA_EMAIL}`);
  } catch (e) {
    logger.warn('[DB] Ultra admin seed warning:', e.message);
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
  usuario_unico: { type: DataTypes.STRING(40), unique: true },
  telefono:      { type: DataTypes.STRING(20) },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  tipo_identificacion: { type: DataTypes.ENUM('CC','CE','TI','PA','PEP','NIT','OTRO'), defaultValue: 'CC' },
  cedula:        { type: DataTypes.STRING(20), unique: true },
  fecha_nacimiento: { type: DataTypes.DATEONLY },
  ciudad:        { type: DataTypes.STRING(100) },
  foto_perfil:   { type: DataTypes.STRING(500) },
  kyc_nivel:     { type: DataTypes.ENUM('ninguno','basico','verificado','premium','plata','oro','platino'), defaultValue: 'ninguno' },
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
// MODELO: PAYMENT INTENT
// ══════════════════════════════════════
const PaymentIntent = sequelize.define('PaymentIntent', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  deal_id:     { type: DataTypes.UUID, allowNull: false },
  provider:    { type: DataTypes.STRING(30), defaultValue: 'wompi', allowNull: false },
  reference:   { type: DataTypes.STRING(160), allowNull: false, unique: true },
  amount_cents:{ type: DataTypes.INTEGER, allowNull: false },
  amount_cop:  { type: DataTypes.DECIMAL(15,2), allowNull: false },
  currency:    { type: DataTypes.STRING(3), defaultValue: 'COP', allowNull: false },
  status:      { type: DataTypes.STRING(40), defaultValue: 'CREATED', allowNull: false },
  wompi_transaction_id: { type: DataTypes.STRING(120) },
  checkout_url: { type: DataTypes.TEXT },
  raw_response: { type: DataTypes.JSONB, defaultValue: {} },
  created_by_user_id: { type: DataTypes.UUID },
}, { tableName: 'payment_intents', timestamps: true, underscored: true });

// ══════════════════════════════════════
// MODELO: PAYMENT EVENT
// ══════════════════════════════════════
const PaymentEvent = sequelize.define('PaymentEvent', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  provider:    { type: DataTypes.STRING(30), defaultValue: 'wompi', allowNull: false },
  event_type:  { type: DataTypes.STRING(80) },
  event_checksum: { type: DataTypes.STRING(128) },
  wompi_transaction_id: { type: DataTypes.STRING(120) },
  reference:   { type: DataTypes.STRING(160) },
  status:      { type: DataTypes.STRING(40) },
  raw_payload: { type: DataTypes.JSONB, defaultValue: {} },
  received_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  processed_at:{ type: DataTypes.DATE },
  is_valid_signature: { type: DataTypes.BOOLEAN, defaultValue: false },
  processing_error: { type: DataTypes.TEXT },
}, { tableName: 'payment_events', timestamps: false, underscored: true });

// ══════════════════════════════════════
// MODELO: LEDGER ENTRY
// ══════════════════════════════════════
const LedgerEntry = sequelize.define('LedgerEntry', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  deal_id:     { type: DataTypes.UUID, allowNull: false },
  payment_intent_id: { type: DataTypes.UUID },
  type:        { type: DataTypes.STRING(60), allowNull: false },
  amount_cents:{ type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT },
}, { tableName: 'ledger_entries', timestamps: true, createdAt: 'created_at', updatedAt: false });

// ══════════════════════════════════════
// MODELO: AUDIT LOG
// ══════════════════════════════════════
const AuditLog = sequelize.define('AuditLog', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id:     { type: DataTypes.UUID },
  action:      { type: DataTypes.STRING(120), allowNull: false },
  entity_type: { type: DataTypes.STRING(80), allowNull: false },
  entity_id:   { type: DataTypes.UUID },
  metadata:    { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'audit_logs', timestamps: true, createdAt: 'created_at', updatedAt: false });

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
  tipo:       { type: DataTypes.ENUM('ahorros','corriente','nequi','daviplata','breb'), allowNull: false },
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
Trato.hasMany(PaymentIntent, { foreignKey: 'deal_id' });
PaymentIntent.belongsTo(Trato, { foreignKey: 'deal_id' });
PaymentIntent.belongsTo(User, { as: 'creator', foreignKey: 'created_by_user_id' });
PaymentIntent.hasMany(LedgerEntry, { foreignKey: 'payment_intent_id' });
LedgerEntry.belongsTo(PaymentIntent, { foreignKey: 'payment_intent_id' });
LedgerEntry.belongsTo(Trato, { foreignKey: 'deal_id' });
Trato.hasMany(Mensaje, { foreignKey: 'trato_id' });
Mensaje.belongsTo(User, { as: 'remitente', foreignKey: 'remitente_id' });
Trato.hasOne(Disputa,  { foreignKey: 'trato_id' });
Disputa.belongsTo(Trato, { foreignKey: 'trato_id' });
Disputa.belongsTo(User, { as: 'aperturista', foreignKey: 'abierta_por' });
Trato.hasMany(Resena,  { foreignKey: 'trato_id' });
Resena.belongsTo(User, { as: 'autor', foreignKey: 'autor_id' });
Resena.belongsTo(User, { as: 'destinatario', foreignKey: 'destinatario_id' });
User.hasMany(CuentaBancaria, { foreignKey: 'usuario_id' });
User.hasMany(Notificacion,   { foreignKey: 'usuario_id' });
TicketSoporte.belongsTo(User, { as: 'usuario', foreignKey: 'usuario_id' });

module.exports = {
  sequelize, connectDB,
  User, Trato, Pago, PaymentIntent, PaymentEvent, LedgerEntry, AuditLog,
  Disputa, Mensaje, Resena, CuentaBancaria, Notificacion, TicketSoporte
};
