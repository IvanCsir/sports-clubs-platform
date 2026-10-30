const crypto = require('crypto');
const { getPublicClub, readConfiguredClubsAsync } = require('../_lib/club-config');
const postgres = require('../_lib/postgres');
const { createStaffInvite } = require('../_lib/staff-access');
const { ValidationError } = require('../_lib/errors');
const { sendJson: json, readJson, bearerToken } = require('../_lib/http');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const TOKEN_DURATION = 8 * 60 * 60 * 1000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function validateClub(input) {
  const required = ['slug', 'name', 'shortName', 'sport', 'teamName'];
  const missing = required.find(key => !String(input[key] || '').trim());
  if (missing) throw new ValidationError(`Falta el campo obligatorio: ${missing}`);
  if (!SLUG_PATTERN.test(input.slug)) {
    throw new ValidationError('El slug sólo puede contener minúsculas, números y guiones.');
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

function validateSecretLength(secret) {
  if (secret && Buffer.byteLength(secret, 'utf8') < 32) {
    throw new ValidationError('El secreto del club debe tener al menos 32 bytes.');
  }
}

function mergeClub(current, input) {
  const incoming = validateClub({ ...current, ...input });
  return {
    ...current,
    ...incoming,
    auth: { secret: input.auth && input.auth.secret ? input.auth.secret : current.auth.secret }
  };
}

async function findClub(slug) {
  let clubs;
  try {
    clubs = await readConfiguredClubsAsync();
  } catch (_) {
    throw new ValidationError('No se pudo acceder a la configuración de clubes.', 503);
  }
  const club = clubs.find(item => item.slug === slug);
  if (!club) throw new ValidationError('Club no encontrado.', 404);
  return club;
}

function requireDatabase() {
  if (!postgres.isConfigured()) {
    throw new ValidationError('Configurá DATABASE_URL para administrar clubes.', 503);
  }
}

async function deleteClub(body) {
  const slug = String(body.slug || '').trim();
  if (!SLUG_PATTERN.test(slug) || body.confirmSlug !== slug) {
    throw new ValidationError('Confirmá la eliminación enviando el slug exacto del club.');
  }
  await findClub(slug);
  requireDatabase();
  try {
    await postgres.deleteClub(slug);
  } catch (error) {
    console.error('[Admin] Error eliminando club:', error.message);
    throw new ValidationError('No se pudo eliminar el club. Verificá que la migración de base de datos esté aplicada.', 503);
  }
  return { deleted: true, slug, storage: 'postgres' };
}

async function createInvite(body) {
  const slug = String(body.slug || '').trim();
  await findClub(slug);
  try {
    const invite = await createStaffInvite(slug, body.email, 'administración de la plataforma', body.canManageAccess === true);
    return {
      email: invite.email,
      expiresInDays: invite.expiresInDays,
      canManageAccess: invite.canManageAccess,
      invitePath: `/?club=${encodeURIComponent(slug)}&staffInvite=${encodeURIComponent(invite.token)}`
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('[Admin] Error creando invitación:', error.message);
    throw new ValidationError('No se pudo crear la invitación. Verificá que la migración de accesos esté aplicada.', 503);
  }
}

async function createClub(body) {
  const club = validateClub(body.club || {});
  validateSecretLength(club.auth.secret);
  requireDatabase();
  try {
    return { club: getPublicClub(await postgres.insertClub(club)), storage: 'postgres' };
  } catch (error) {
    if (error.code === '23505') throw new ValidationError('Ya existe un club con ese identificador.', 409);
    console.error('[Postgres] Error guardando club:', error.message);
    throw new ValidationError('No se pudo guardar el club en la base de datos.', 503);
  }
}

async function updateClub(body) {
  const currentSlug = String(body.slug || '').trim();
  const requestedSlug = String(body.club?.slug || '').trim();
  if (!currentSlug || requestedSlug !== currentSlug) {
    throw new ValidationError('El identificador del club (slug) no se puede cambiar desde Editar perfil.');
  }
  if (body.club.auth) validateSecretLength(String(body.club.auth.secret || '').trim());
  const updated = mergeClub(await findClub(currentSlug), body.club);
  requireDatabase();
  try {
    return { club: getPublicClub(await postgres.updateClub(currentSlug, updated)), storage: 'postgres' };
  } catch (error) {
    console.error('[Postgres] Error actualizando club:', error.message);
    throw new ValidationError('No se pudo guardar el perfil en la base de datos.', 503);
  }
}

module.exports = async function handler(req, res) {
  if (!ADMIN_PASSWORD || !ADMIN_SECRET) return json(res, 503, { error: 'Panel de administración no configurado.' });
  try {
    const body = await readJson(req);

    if (req.method === 'POST' && body.action === 'login') {
      const submitted = Buffer.from(String(body.password || ''));
      const expected = Buffer.from(ADMIN_PASSWORD);
      if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
        return json(res, 401, { error: 'Contraseña de administrador incorrecta.' });
      }
      return json(res, 200, { token: signAdminToken(Date.now() + TOKEN_DURATION) });
    }

    if (!verifyAdminToken(bearerToken(req))) return json(res, 401, { error: 'Sesión de administrador inválida o expirada.' });

    if (req.method === 'GET') {
      let clubs;
      try {
        clubs = await readConfiguredClubsAsync();
      } catch (_) {
        return json(res, 503, { error: 'No se pudo cargar la configuración de clubes.' });
      }
      return json(res, 200, { valid: true, clubs: clubs.map(getPublicClub) });
    }
    if (req.method === 'DELETE') return json(res, 200, await deleteClub(body));
    if (req.method === 'POST' && body.action === 'create-staff-invite') return json(res, 201, await createInvite(body));
    if (req.method === 'POST') return json(res, 201, await createClub(body));
    if (req.method === 'PATCH') return json(res, 200, await updateClub(body));
    return json(res, 405, { error: 'Método no permitido.' });
  } catch (error) {
    if (error instanceof ValidationError) return json(res, error.status, { error: error.message });
    console.error('[Admin]', error);
    return json(res, 500, { error: 'No se pudo completar la operación de administración.' });
  }
};
