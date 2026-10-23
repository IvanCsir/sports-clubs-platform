const crypto = require('crypto');
const { getPublicClub } = require('../_lib/club-config');
const supabase = require('../_lib/supabase');
const localClubs = require('../_lib/local-clubs');
const postgres = require('../_lib/postgres');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const TOKEN_DURATION = 8 * 60 * 60 * 1000;

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function signAdminToken(expiresAt) {
  const payload = `admin:${expiresAt}`;
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ role: 'admin', expiresAt, signature })).toString('base64url');
}

function verifyAdminToken(token) {
  try {
    const parsed = JSON.parse(Buffer.from(token || '', 'base64url').toString('utf8'));
    if (!parsed || parsed.role !== 'admin' || Date.now() > parsed.expiresAt) return false;
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(`admin:${parsed.expiresAt}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(parsed.signature), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); }
    });
  });
}

function validateClub(input) {
  const required = ['slug', 'name', 'shortName', 'sport', 'teamName'];
  const missing = required.find(key => !String(input[key] || '').trim());
  if (missing) throw new Error(`Falta el campo obligatorio: ${missing}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    throw new Error('El slug sólo puede contener minúsculas, números y guiones.');
  }

  return {
    slug: input.slug.trim(),
    name: input.name.trim(),
    shortName: input.shortName.trim(),
    sport: input.sport.trim(),
    teamName: input.teamName.trim(),
    logoUrl: String(input.logoUrl || '').trim(),
    theme: input.theme || {},
    spreadsheetId: String(input.spreadsheetId || '').trim(),
    physicalSpreadsheetId: String(input.physicalSpreadsheetId || '').trim(),
    dtSpreadsheetId: String(input.dtSpreadsheetId || '').trim(),
    dtSpreadsheetUrl: String(input.dtSpreadsheetUrl || '').trim(),
    tournament: input.tournament || {},
    auth: {
      password: String(input.auth && input.auth.password || '').trim(),
      secret: String(input.auth && input.auth.secret || '').trim()
    }
  };
}

function mergeClub(current, input) {
  const incoming = validateClub({ ...current, ...input });
  return {
    ...current,
    ...incoming,
    auth: {
      ...current.auth,
      ...(input.auth && input.auth.password ? { password: input.auth.password } : {}),
      ...(input.auth && input.auth.secret ? { secret: input.auth.secret } : {})
    }
  };
}

module.exports = async function handler(req, res) {
  const body = await readBody(req);
  if (!ADMIN_PASSWORD || !ADMIN_SECRET) return json(res, 503, { error: 'Panel de administración no configurado.' });

  if (req.method === 'POST' && body.action === 'login') {
    const submitted = Buffer.from(String(body.password || ''));
    const expected = Buffer.from(ADMIN_PASSWORD);
    if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
      return json(res, 401, { error: 'Contraseña de administrador incorrecta.' });
    }
    return json(res, 200, { token: signAdminToken(Date.now() + TOKEN_DURATION) });
  }

  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifyAdminToken(auth)) return json(res, 401, { error: 'Sesión de administrador inválida o expirada.' });
  if (req.method === 'POST') {
    try {
      const club = validateClub(body.club || {});
      if (postgres.isConfigured()) {
        try {
          const saved = await postgres.insertClub(club);
          return json(res, 201, { club: getPublicClub(saved), storage: 'postgres' });
  
        } catch (err) {
          console.warn('[Postgres] Error guardando club en BD, usando local:', err.message);
        }

      }
      if (supabase.isConfigured()) {
        const rows = await supabase.request('clubs', {
          method: 'POST',
          body: JSON.stringify({ slug: club.slug, config: club })
        });
        return json(res, 201, { club: getPublicClub(rows[0].config), storage: 'supabase' });
      }
      const saved = localClubs.createClub(club);
      return json(res, 201, { club: getPublicClub(saved), storage: 'local' });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const current = (await require('../_lib/club-config').readConfiguredClubsAsync())
        .find(item => item.slug === body.slug);
      if (!current) return json(res, 404, { error: 'Club no encontrado.' });
      const updated = mergeClub(current, body.club || {});
      if (postgres.isConfigured()) {
        try {
          const saved = await postgres.updateClub(body.slug, updated);
          return json(res, 200, { club: getPublicClub(saved), storage: 'postgres' });
  
        } catch (err) {
          console.warn('[Postgres] Error actualizando club en BD, usando local:', err.message);
        }

      }
      if (supabase.isConfigured()) return json(res, 501, { error: 'Edición Supabase aún no implementada.' });
      const saved = localClubs.updateClub(body.slug, updated);
      return json(res, 200, { club: getPublicClub(saved), storage: 'local' });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  return json(res, 405, { error: 'Método no permitido.' });
};
