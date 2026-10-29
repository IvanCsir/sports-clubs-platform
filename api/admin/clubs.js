const crypto = require('crypto');
const { getPublicClub, readConfiguredClubsAsync } = require('../_lib/club-config');
const supabase = require('../_lib/supabase');
const localClubs = require('../_lib/local-clubs');
const postgres = require('../_lib/postgres');
const { createStaffInvite } = require('../_lib/staff-access');

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
    tournament: input.tournament || {},
    season: {
      name: String(input.season?.name || new Date().getFullYear()).trim().slice(0, 60)
    },
    auth: { secret: String(input.auth && input.auth.secret || crypto.randomBytes(32).toString('base64url')).trim() }
  };
}

function mergeClub(current, input) {
  const incoming = validateClub({ ...current, ...input });
  return {
    ...current,
    ...incoming,
    auth: { secret: input.auth && input.auth.secret ? input.auth.secret : current.auth.secret }
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
  if (req.method === 'POST' && body.action === 'create-staff-invite') {
    try {
      const slug = String(body.slug || '').trim();
      const clubs = await readConfiguredClubsAsync();
      if (!clubs.some(club => club.slug === slug)) return json(res, 404, { error: 'Club no encontrado.' });
      const invite = await createStaffInvite(slug, body.email, 'administración de la plataforma');
      return json(res, 201, {
        email: invite.email,
        expiresInDays: invite.expiresInDays,
        invitePath: `/?club=${encodeURIComponent(slug)}&staffInvite=${encodeURIComponent(invite.token)}`
      });
    } catch (error) {
      if (/email válido|ya tiene acceso/.test(error.message)) return json(res, 400, { error: error.message });
      return json(res, 503, { error: 'No se pudo crear la invitación. Verificá que la migración de accesos esté aplicada.' });
    }
  }
  if (req.method === 'GET') {
    try {
      const clubs = await readConfiguredClubsAsync();
      return json(res, 200, { valid: true, clubs: clubs.map(getPublicClub) });
    } catch (_) {
      return json(res, 503, { error: 'No se pudo cargar la configuración de clubes.' });
    }
  }
  if (req.method === 'POST') {
    try {
      const club = validateClub(body.club || {});
      if (!club.auth.secret) return json(res, 400, { error: 'No se pudo generar la configuración segura del club.' });
      if (Buffer.byteLength(club.auth.secret, 'utf8') < 32) {
        return json(res, 400, { error: 'El secreto del club debe tener al menos 32 bytes.' });
      }
      if (postgres.isConfigured()) {
        try {
          const saved = await postgres.insertClub(club);
          return json(res, 201, { club: getPublicClub(saved), storage: 'postgres' });
        } catch (err) {
          console.error('[Postgres] Error guardando club:', err.message);
          return json(res, err.code === '23505' ? 409 : 503, {
            error: err.code === '23505' ? 'Ya existe un club con ese identificador.' : 'No se pudo guardar el club en la base de datos.'
          });
        }
      }
      if (supabase.isConfigured()) {
        const rows = await supabase.request('clubs', {
          method: 'POST',
          body: JSON.stringify({ slug: club.slug, config: club })
        });
        return json(res, 201, { club: getPublicClub(rows[0].config), storage: 'supabase' });
      }
      if (process.env.VERCEL) {
        return json(res, 503, { error: 'Configurá un almacenamiento persistente antes de agregar clubes.' });
      }
      const saved = localClubs.createClub(club);
      return json(res, 201, { club: getPublicClub(saved), storage: 'local' });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const incomingAuth = body.club && body.club.auth;
      if (incomingAuth) {
        const hasSecret = Boolean(String(incomingAuth.secret || '').trim());
        if (hasSecret && Buffer.byteLength(String(incomingAuth.secret).trim(), 'utf8') < 32) {
          return json(res, 400, { error: 'El secreto del club debe tener al menos 32 bytes.' });
        }
      }
      let configuredClubs;
      try {
        configuredClubs = await readConfiguredClubsAsync();
      } catch (_) {
        return json(res, 503, { error: 'No se pudo acceder a la configuración de clubes.' });
      }
      const current = configuredClubs.find(item => item.slug === body.slug);
      if (!current) return json(res, 404, { error: 'Club no encontrado.' });
      const updated = mergeClub(current, body.club || {});
      if (postgres.isConfigured()) {
        try {
          const saved = await postgres.updateClub(body.slug, updated);
          return json(res, 200, { club: getPublicClub(saved), storage: 'postgres' });
        } catch (err) {
          console.error('[Postgres] Error actualizando club:', err.message);
          return json(res, 503, { error: 'No se pudo guardar el perfil en la base de datos.' });
        }
      }
      if (supabase.isConfigured()) return json(res, 501, { error: 'Edición Supabase aún no implementada.' });
      if (process.env.VERCEL) {
        return json(res, 503, { error: 'Configurá un almacenamiento persistente antes de editar clubes.' });
      }
      const saved = localClubs.updateClub(body.slug, updated);
      return json(res, 200, { club: getPublicClub(saved), storage: 'local' });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  return json(res, 405, { error: 'Método no permitido.' });
};
