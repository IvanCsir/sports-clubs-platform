/**
 * Autenticación del cuerpo técnico.
 *
 * Intercambia una credencial de Google de una cuenta invitada por un token de sesión
 * firmado con el secreto del club, con expiración automática de 12 horas.
 */

const crypto = require('crypto');
const { readConfiguredClubsAsync } = require('./_lib/club-config');
const { exchangeGoogleCredential } = require('./_lib/staff-access');
const { ValidationError } = require('./_lib/errors');
const { sendJson: json, readJson, requestUrl, bearerToken } = require('./_lib/http');
const postgres = require('./_lib/postgres');

const SESSION_DURATION_HOURS = 12;

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSessionToken(club, email = '') {
  const expiresAt = Date.now() + (SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const payload = `ct:${club.slug}:${expiresAt}${normalizedEmail ? `:${normalizedEmail}` : ''}`;
  const signature = crypto.createHmac('sha256', club.auth.secret).update(payload).digest('hex');
  const token = Buffer.from(JSON.stringify({ role: 'cuerpo_tecnico', club: club.slug, email: normalizedEmail, expiresAt, signature })).toString('base64');
  return { token, expiresAt, durationHours: SESSION_DURATION_HOURS };
}

function verifySessionToken(token, club) {
  try {
    if (!token) return { valid: false, error: 'Token no provisto' };
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expiresAt || !parsed.signature) return { valid: false, error: 'Formato inválido' };

    if (Date.now() > parsed.expiresAt) {
      return { valid: false, error: 'Sesión expirada' };
    }

    if (parsed.club !== club.slug) return { valid: false, error: 'Token de otro club' };
    const expectedPayload = `ct:${club.slug}:${parsed.expiresAt}${parsed.email ? `:${String(parsed.email).trim().toLowerCase()}` : ''}`;
    const expectedSig = crypto.createHmac('sha256', club.auth.secret).update(expectedPayload).digest('hex');
    if (!safeCompare(parsed.signature, expectedSig)) {
      return { valid: false, error: 'Firma inválida' };
    }

    return { valid: true, expiresAt: parsed.expiresAt, email: parsed.email || '' };
  } catch (err) {
    return { valid: false, error: 'Token corrupto' };
  }
}

async function verifyActiveSessionToken(token, club) {
  const verification = verifySessionToken(token, club);
  if (!verification.valid || !verification.email) return verification;
  if (!postgres.isConfigured()) return { valid: false, error: 'Acceso individual no disponible.' };
  const result = await postgres.getPool().query(
    `SELECT can_manage_access AS "canManageAccess" FROM sc_staff_users
     WHERE club_slug = $1 AND email = $2 AND revoked_at IS NULL`,
    [club.slug, verification.email]
  );
  return result.rowCount
    ? { ...verification, canManageAccess: result.rows[0].canManageAccess }
    : { valid: false, error: 'Este acceso fue revocado.' };
}

// Sesión del cuerpo técnico enviada en el header Authorization de la solicitud.
async function requestSession(req, club) {
  const token = bearerToken(req);
  return token ? verifyActiveSessionToken(token, club) : { valid: false, error: 'Token no provisto' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = requestUrl(req);
  let clubs;
  try {
    clubs = await readConfiguredClubsAsync();
  } catch (_) {
    return json(res, 503, { error: 'El servicio de clubes no está disponible temporalmente.' });
  }
  const slug = urlObj.searchParams.get('club');
  if (!slug) return json(res, 400, { error: 'Ingresá con el enlace de tu club.' });
  const club = clubs.find(item => item.slug === slug);
  if (!club) return json(res, 404, { error: 'Club no encontrado.' });

  // GET: validar el estado de un token existente.
  if (req.method === 'GET') {
    const token = urlObj.searchParams.get('token') || bearerToken(req);
    return json(res, 200, await verifyActiveSessionToken(token, club));
  }

  // POST: intercambio de credencial Google por sesión del club.
  if (req.method === 'POST') {
    try {
      const body = await readJson(req);
      if (!String(club.auth?.secret || '')) {
        return json(res, 503, { success: false, error: 'Autenticación no configurada para este club.' });
      }
      if (!body.googleCredential) {
        return json(res, 401, { success: false, error: 'Ingresá con Google usando una invitación vigente del club.' });
      }
      const identity = await exchangeGoogleCredential(club.slug, body.googleCredential, body.invite || '');
      const session = createSessionToken(club, identity.email);
      return json(res, 200, { success: true, token: session.token, expiresAt: session.expiresAt, durationHours: session.durationHours });
    } catch (error) {
      if (error instanceof ValidationError) return json(res, error.status, { success: false, error: error.message });
      console.error('[API Auth]', error);
      return json(res, 503, { success: false, error: 'No se pudo iniciar sesión. Intentá de nuevo en unos minutos.' });
    }
  }

  return json(res, 405, { error: 'Método no permitido' });
};

module.exports.verifySessionToken = verifySessionToken;
module.exports.verifyActiveSessionToken = verifyActiveSessionToken;
module.exports.requestSession = requestSession;
module.exports.createSessionToken = createSessionToken;
