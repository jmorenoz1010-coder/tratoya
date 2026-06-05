const express = require('express');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const {
  sendWaitlistConfirmation,
  sendPositionUpgradeEmail,
  sendActivationEmail,
} = require('../services/emailWaitlist');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOUNDER_LIMIT = 1000;

const clean = (value) => String(value || '').trim();
const normalizeEmail = (value) => clean(value).toLowerCase();
const adminKey = () => process.env.WAITLIST_ADMIN_KEY || 'clave-secreta-para-admin';

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
    .slice(0, 45);
}

function publicUser(row) {
  return {
    ...row,
    posicion: Number(row.posicion || 0),
    referidos_count: Number(row.referidos_count || 0),
    posicion_ganada: Number(row.posicion_ganada || 0),
    es_fundador: Boolean(row.es_fundador),
  };
}

async function createEvent(waitlistId, tipo, descripcion, transaction) {
  await sequelize.query(
    `INSERT INTO waitlist_eventos (waitlist_id, tipo, descripcion)
     VALUES (:waitlistId, :tipo, :descripcion)`,
    { replacements: { waitlistId, tipo, descripcion }, transaction }
  );
}

async function generateReferralCode(transaction) {
  for (let i = 0; i < 20; i += 1) {
    const code = `TY-${crypto.randomBytes(4).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase().padEnd(6, 'X')}`;
    const existing = await sequelize.query(
      `SELECT id FROM waitlist WHERE referral_code = :code LIMIT 1`,
      { replacements: { code }, type: QueryTypes.SELECT, transaction }
    );
    if (!existing.length) return code;
  }
  return `TY-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

async function nextPosition(transaction) {
  await sequelize.query(`SELECT pg_advisory_xact_lock(20260530)`, { transaction });
  const [row] = await sequelize.query(
    `SELECT COALESCE(MAX(posicion), 0) + 1 AS next_position FROM waitlist`,
    { type: QueryTypes.SELECT, transaction }
  );
  return Number(row.next_position);
}

async function moveApplicantUp(applicant, places, transaction) {
  const current = Number(applicant.posicion);
  const target = Math.max(1, current - places);
  if (target >= current) return { ...applicant, puestosGanados: 0 };

  const offset = 1000000;
  await sequelize.query(
    `UPDATE waitlist
     SET posicion = posicion + :offset
     WHERE posicion >= :target AND posicion < :current`,
    { replacements: { offset, target, current }, transaction }
  );
  await sequelize.query(
    `UPDATE waitlist
     SET posicion = :target,
         referidos_count = referidos_count + 1,
         posicion_ganada = posicion_ganada + :won,
         es_fundador = CASE WHEN :target <= :founderLimit THEN true ELSE es_fundador END,
         estado = CASE WHEN :target <= :founderLimit AND estado = 'en_espera' THEN 'fundador'::waitlist_estado ELSE estado END
     WHERE id = :id`,
    {
      replacements: {
        target,
        won: current - target,
        founderLimit: FOUNDER_LIMIT,
        id: applicant.id,
      },
      transaction,
    }
  );
  await sequelize.query(
    `UPDATE waitlist
     SET posicion = posicion - :offset + 1
     WHERE posicion >= :offset + :target AND posicion < :offset + :current`,
    { replacements: { offset, target, current }, transaction }
  );

  const [updated] = await sequelize.query(
    `SELECT * FROM waitlist WHERE id = :id`,
    { replacements: { id: applicant.id }, type: QueryTypes.SELECT, transaction }
  );
  return { ...updated, puestosGanados: current - target };
}

function requireAdmin(req, res, next) {
  const key = req.get('X-Admin-Key');
  if (!key || key !== adminKey()) {
    return res.status(401).json({ success: false, message: 'Clave admin invalida.' });
  }
  return next();
}

router.post('/registro', async (req, res, next) => {
  const ip = clientIp(req);
  const nombre = clean(req.body.nombre).slice(0, 100);
  const email = normalizeEmail(req.body.email);
  const telefono = clean(req.body.telefono).slice(0, 20) || null;
  const ciudad = clean(req.body.ciudad).slice(0, 100) || null;
  const referralCode = clean(req.body.referral_code).toUpperCase() || null;

  if (!nombre || !email) {
    return res.status(400).json({ success: false, message: 'Nombre y email son obligatorios.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Ingresa un email valido.' });
  }

  try {
    const recentRows = await sequelize.query(
      `SELECT COUNT(*)::int AS count
       FROM waitlist
       WHERE ip_address = :ip AND created_at >= NOW() - INTERVAL '1 hour'`,
      { replacements: { ip }, type: QueryTypes.SELECT }
    );
    if (Number(recentRows[0]?.count || 0) >= 3) {
      return res.status(429).json({ success: false, message: 'Ya alcanzaste el limite de registros desde esta conexion. Intenta mas tarde.' });
    }

    let newUser;
    let referrerForEmail = null;
    await sequelize.transaction(async (transaction) => {
      const duplicate = await sequelize.query(
        `SELECT id FROM waitlist WHERE LOWER(email) = :email LIMIT 1`,
        { replacements: { email }, type: QueryTypes.SELECT, transaction }
      );
      if (duplicate.length) {
        const err = new Error('Este email ya esta en la lista de espera.');
        err.statusCode = 409;
        throw err;
      }

      let referrer = null;
      if (referralCode) {
        const rows = await sequelize.query(
          `SELECT * FROM waitlist WHERE referral_code = :referralCode LIMIT 1`,
          { replacements: { referralCode }, type: QueryTypes.SELECT, transaction }
        );
        referrer = rows[0] || null;
      }

      const posicion = await nextPosition(transaction);
      const ownCode = await generateReferralCode(transaction);
      const inserted = await sequelize.query(
        `INSERT INTO waitlist (nombre, email, telefono, ciudad, posicion, referral_code, referred_by, es_fundador, estado, ip_address)
         VALUES (:nombre, :email, :telefono, :ciudad, :posicion, :ownCode, :referredBy,
                 :isFounder,
                 CASE WHEN :isFounder THEN 'fundador'::waitlist_estado ELSE 'en_espera'::waitlist_estado END,
                 :ip)
         RETURNING *`,
        {
          replacements: {
            nombre,
            email,
            telefono,
            ciudad,
            posicion,
            ownCode,
            referredBy: referrer?.id || null,
            isFounder: posicion <= FOUNDER_LIMIT,
            ip,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      newUser = publicUser(inserted[0]);
      await createEvent(newUser.id, 'registro', `Registro en lista de espera desde ${ciudad || 'ciudad no indicada'}`, transaction);

      if (referrer) {
        const updatedReferrer = await moveApplicantUp(referrer, 5, transaction);
        await createEvent(
          referrer.id,
          'referido_completado',
          `${nombre} se registro con el codigo ${referralCode}. Subio ${updatedReferrer.puestosGanados} puestos.`,
          transaction
        );
        await createEvent(referrer.id, 'posicion_actualizada', `Nueva posicion: ${updatedReferrer.posicion}`, transaction);
        referrerForEmail = publicUser(updatedReferrer);
      }
    });

    sendWaitlistConfirmation(newUser).catch((err) => logger.warn(`[WAITLIST_EMAIL] confirmacion fallo: ${err.message}`));
    if (referrerForEmail) {
      sendPositionUpgradeEmail(referrerForEmail, 5).catch((err) => logger.warn(`[WAITLIST_EMAIL] subida fallo: ${err.message}`));
    }

    return res.status(201).json({
      success: true,
      posicion: newUser.posicion,
      referral_code: newUser.referral_code,
      es_fundador: newUser.es_fundador,
      mensaje: newUser.es_fundador
        ? 'Estas dentro del grupo Fundador TratoYA.'
        : 'Ya estas en la lista de espera de TratoYA.',
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    return next(err);
  }
});

router.get('/posicion/:email', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.params.email);
    const rows = await sequelize.query(
      `SELECT posicion, GREATEST(posicion - posicion_ganada, 1) AS posicion_real,
              referidos_count, es_fundador, estado, referral_code
       FROM waitlist
       WHERE LOWER(email) = :email
       LIMIT 1`,
      { replacements: { email }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'No encontramos ese email en la lista.' });
    return res.json({ success: true, ...rows[0] });
  } catch (err) { return next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [summary, cities] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(*)::int AS total_registrados,
                COUNT(*) FILTER (WHERE estado = 'activado')::int AS total_activados
         FROM waitlist`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COALESCE(NULLIF(ciudad, ''), 'Otra') AS ciudad, COUNT(*)::int AS count
         FROM waitlist
         GROUP BY COALESCE(NULLIF(ciudad, ''), 'Otra')
         ORDER BY count DESC, ciudad ASC
         LIMIT 6`,
        { type: QueryTypes.SELECT }
      ),
    ]);
    return res.json({ success: true, ...summary[0], ciudades_top: cities });
  } catch (err) { return next(err); }
});

router.get('/admin/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const [summary, top, cities, daily, latest] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(*)::int AS total_registrados,
                COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS registros_hoy,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS registros_semana,
                COUNT(*) FILTER (WHERE estado = 'activado')::int AS total_activados,
                COUNT(*) FILTER (WHERE es_fundador = true)::int AS total_fundadores
         FROM waitlist`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT nombre, email, referidos_count, posicion
         FROM waitlist
         ORDER BY referidos_count DESC, posicion ASC
         LIMIT 20`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COALESCE(NULLIF(ciudad, ''), 'Otra') AS ciudad, COUNT(*)::int AS count
         FROM waitlist
         GROUP BY COALESCE(NULLIF(ciudad, ''), 'Otra')
         ORDER BY count DESC, ciudad ASC`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT TO_CHAR(day::date, 'YYYY-MM-DD') AS fecha, COALESCE(counts.count, 0)::int AS count
         FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day
         LEFT JOIN (
           SELECT created_at::date AS fecha, COUNT(*)::int AS count
           FROM waitlist
           WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
           GROUP BY created_at::date
         ) counts ON counts.fecha = day::date
         ORDER BY fecha ASC`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT nombre, email, ciudad, posicion, created_at
         FROM waitlist
         ORDER BY created_at DESC
         LIMIT 20`,
        { type: QueryTypes.SELECT }
      ),
    ]);
    return res.json({
      success: true,
      ...summary[0],
      top_referidores: top,
      registros_por_ciudad: cities,
      registros_por_dia: daily,
      ultimos_registros: latest,
    });
  } catch (err) { return next(err); }
});

router.post('/admin/activar', requireAdmin, async (req, res, next) => {
  try {
    const cantidad = Number(req.body.cantidad || 0);
    const emails = Array.isArray(req.body.emails) ? req.body.emails.map(normalizeEmail).filter(Boolean) : [];
    if (!cantidad && !emails.length) {
      return res.status(400).json({ success: false, message: 'Indica cantidad o emails para activar.' });
    }

    let activated = [];
    await sequelize.transaction(async (transaction) => {
      const candidates = emails.length
        ? await sequelize.query(
          `SELECT * FROM waitlist WHERE LOWER(email) IN (:emails) AND estado <> 'activado' ORDER BY posicion ASC`,
          { replacements: { emails }, type: QueryTypes.SELECT, transaction }
        )
        : await sequelize.query(
          `SELECT * FROM waitlist WHERE estado = 'en_espera' ORDER BY posicion ASC LIMIT :cantidad`,
          { replacements: { cantidad }, type: QueryTypes.SELECT, transaction }
        );
      if (!candidates.length) return;
      const ids = candidates.map((item) => item.id);
      activated = await sequelize.query(
        `UPDATE waitlist
         SET estado = 'activado'::waitlist_estado, activated_at = NOW()
         WHERE id IN (:ids)
         RETURNING nombre, email, posicion, es_fundador`,
        { replacements: { ids }, type: QueryTypes.SELECT, transaction }
      );
      for (const item of candidates) {
        await createEvent(item.id, 'activado', 'Usuario activado desde panel de lista de espera.', transaction);
      }
    });

    activated.forEach((item) => {
      sendActivationEmail(item).catch((err) => logger.warn(`[WAITLIST_EMAIL] activacion fallo: ${err.message}`));
    });

    return res.json({ success: true, activados: activated, total: activated.length });
  } catch (err) { return next(err); }
});

router.post('/admin/recalcular-posiciones', requireAdmin, async (req, res, next) => {
  try {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`SELECT pg_advisory_xact_lock(20260531)`, { transaction });
      await sequelize.query(
        `WITH ordered AS (
           SELECT id, ROW_NUMBER() OVER (ORDER BY GREATEST(posicion - posicion_ganada, 1), created_at ASC) AS new_pos
           FROM waitlist
         )
         UPDATE waitlist w
         SET posicion = ordered.new_pos + 1000000
         FROM ordered
         WHERE w.id = ordered.id`,
        { transaction }
      );
      await sequelize.query(`UPDATE waitlist SET posicion = posicion - 1000000`, { transaction });
      await sequelize.query(
        `UPDATE waitlist
         SET es_fundador = CASE WHEN posicion <= :founderLimit THEN true ELSE es_fundador END,
             estado = CASE WHEN posicion <= :founderLimit AND estado = 'en_espera' THEN 'fundador'::waitlist_estado ELSE estado END`,
        { replacements: { founderLimit: FOUNDER_LIMIT }, transaction }
      );
    });
    return res.json({ success: true, message: 'Posiciones recalculadas.' });
  } catch (err) { return next(err); }
});

router.get('/admin/export', requireAdmin, async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      `SELECT nombre, email, telefono, ciudad, posicion, referral_code, referidos_count,
              posicion_ganada, estado, es_fundador, activated_at, created_at
       FROM waitlist
       ORDER BY posicion ASC`,
      { type: QueryTypes.SELECT }
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tratoya-waitlist.csv"');
    const headers = Object.keys(rows[0] || {
      nombre: '', email: '', telefono: '', ciudad: '', posicion: '', referral_code: '',
      referidos_count: '', posicion_ganada: '', estado: '', es_fundador: '', activated_at: '', created_at: '',
    });
    const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    res.write(`${headers.join(',')}\n`);
    rows.forEach((row) => res.write(`${headers.map((h) => esc(row[h])).join(',')}\n`));
    return res.end();
  } catch (err) { return next(err); }
});

module.exports = router;
