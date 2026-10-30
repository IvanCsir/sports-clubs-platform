const { getClubAsync } = require('./_lib/club-config');
const { requestSession } = require('./auth');
const sportsData = require('./_lib/sports-data');
const { createStaffInvite, listStaffUsers, revokeStaffUser, setStaffAccessManager } = require('./_lib/staff-access');
const { ValidationError } = require('./_lib/errors');
const { sendJson: json, readJson, requestUrl } = require('./_lib/http');
const { PLAYER_CATEGORIES, CALLUP_CATEGORIES } = require('./_lib/categories');

const PUBLIC_DATASETS = ['citations', 'physical', 'preparations', 'player-portal'];
const STAFF_DATASETS = ['staff', 'staff-access', 'backup'];
const MANAGER_ONLY = 'Solo la persona responsable puede administrar los accesos del club.';

function sanitizeFocusHtml(value) {
  const allowed = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'div']);
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|svg|math|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, rawTag, attributes) => {
      const tag = rawTag.toLowerCase();
      if (!allowed.has(tag)) return '';
      if (match.startsWith('</')) return tag === 'br' ? '' : `</${tag}>`;
      if (!['p', 'div'].includes(tag)) return `<${tag}>`;
      const style = attributes.match(/\bstyle\s*=\s*(["'])(.*?)\1/i)?.[2] || '';
      const alignment = style.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i)?.[1]?.toLowerCase();
      return alignment ? `<${tag} style="text-align: ${alignment}">` : `<${tag}>`;
    });
}

function isPositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

function requireText(value, maxLength, message) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) throw new ValidationError(message);
  return text;
}

function validatePreparation(preparation = {}) {
  const plays = preparation.plays || [];
  const videoUrls = preparation.videoUrls || [];
  const videosInput = preparation.videos || videoUrls;
  const focus = sanitizeFocusHtml(preparation.focus);
  const focusText = focus.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
  if (focus.length > 10000 || focusText.length > 1500 ||
      !Array.isArray(videoUrls) || videoUrls.length > 10 ||
      !Array.isArray(videosInput) || videosInput.length > 10 ||
      !Array.isArray(plays) || plays.length > 12 ||
      Buffer.byteLength(JSON.stringify(preparation), 'utf8') > 180000) {
    throw new ValidationError('La preparación supera los límites permitidos.');
  }
  const videos = [];
  for (const item of videosInput) {
    const title = typeof item === 'string' ? '' : String(item?.title || '').trim();
    const value = String(typeof item === 'string' ? item : item?.url || '').trim();
    if (!value) continue;
    if (title.length > 100) throw new ValidationError('El título de un video supera el máximo permitido.');
    let protocol = '';
    try { protocol = new URL(value).protocol; } catch (_) {}
    if (!['http:', 'https:'].includes(protocol) || value.length > 1000) {
      throw new ValidationError('Cada video debe tener un enlace web válido.');
    }
    videos.push({ title, url: value });
  }
  for (const play of plays) {
    if (!play || String(play.title || '').trim().length > 80 || !Array.isArray(play.frames) || play.frames.length > 30) {
      throw new ValidationError('Una jugada táctica no es válida.');
    }
    for (const frame of play.frames) {
      if (!Array.isArray(frame) || frame.length > 22) throw new ValidationError('Un paso de la jugada no es válido.');
      for (const marker of frame) {
        if (!marker || !['own', 'opponent', 'ball'].includes(marker.side) ||
            !Number.isFinite(Number(marker.x)) || Number(marker.x) < 0 || Number(marker.x) > 100 ||
            !Number.isFinite(Number(marker.y)) || Number(marker.y) < 0 || Number(marker.y) > 100 ||
            String(marker.label || '').length > 12) {
          throw new ValidationError('La pizarra táctica contiene una ficha inválida.');
        }
      }
    }
  }
  return { focus, videos, videoUrls: videos.map(video => video.url), plays };
}

async function readDataset(dataset, { slug, club, session, seasonName, tournamentKey, tournamentName }) {
  switch (dataset) {
    case 'player-portal':
      return { players: await sportsData.getPlayerPortalRoster(slug) };
    case 'preparations':
      return { preparations: await sportsData.getMatchPreparations(slug, seasonName, tournamentKey) };
    case 'physical': {
      // Las evaluaciones son públicas para que las jugadoras puedan consultarlas desde el enlace del club.
      const data = await sportsData.getClubData(slug, seasonName, tournamentKey);
      return { physicalPlayers: data.physicalPlayers, physicalTests: data.physicalTests };
    }
    case 'citations': {
      const data = await sportsData.getClubData(slug, seasonName, tournamentKey);
      return { citations: data.citations };
    }
    case 'backup':
      return {
        format: 'sports-clubs-platform-season-backup',
        version: 1,
        club: {
          slug: club.slug,
          name: club.name,
          shortName: club.shortName,
          sport: club.sport,
          teamName: club.teamName,
          season: { name: seasonName },
          tournament: club.tournament ? {
            name: club.tournament.name,
            tournamentId: club.tournament.tournamentId,
            division: club.tournament.division
          } : null
        },
        ...await sportsData.getSeasonBackup(slug, seasonName, tournamentKey)
      };
    case 'staff-access':
      if (!session.canManageAccess) throw new ValidationError(MANAGER_ONLY, 403);
      return { staff: await listStaffUsers(slug), currentEmail: session.email };
    case 'staff': {
      const data = await sportsData.getClubData(slug, seasonName, tournamentKey);
      return {
        physicalPlayers: data.physicalPlayers, physicalTests: data.physicalTests, events: data.events, players: data.players || [], citations: data.citations,
        monitoring: await sportsData.getPlayerMonitoring(slug, seasonName),
        tournamentStats: await sportsData.getTournamentStats(slug, seasonName, tournamentKey, tournamentName),
        canManageAccess: session.canManageAccess
      };
    }
    default:
      throw new ValidationError('Conjunto de datos inválido.');
  }
}

// Acciones que requieren una sesión del cuerpo técnico del club. Devuelven el payload
// de la respuesta, o { status, payload } cuando no corresponde un 200.
const STAFF_ACTIONS = {
  async 'create-staff-invite'(body, { slug, session }) {
    if (!session.canManageAccess) throw new ValidationError(MANAGER_ONLY, 403);
    const invite = await createStaffInvite(slug, body.email, session.email, body.canManageAccess === true);
    return {
      status: 201,
      payload: {
        email: invite.email,
        expiresInDays: invite.expiresInDays,
        canManageAccess: invite.canManageAccess,
        invitePath: `/?club=${encodeURIComponent(slug)}&staffInvite=${encodeURIComponent(invite.token)}`
      }
    };
  },
  async 'revoke-staff-user'(body, { slug, session }) {
    if (!session.canManageAccess) throw new ValidationError(MANAGER_ONLY, 403);
    if (!isPositiveId(body.userId)) throw new ValidationError('Seleccioná una cuenta válida.');
    if (!await revokeStaffUser(slug, Number(body.userId), session.email)) {
      throw new ValidationError('No se pudo revocar esa cuenta. No podés quitar tu propio acceso.');
    }
    return { revoked: true };
  },
  async 'set-staff-access-manager'(body, { slug, session }) {
    if (!session.canManageAccess) throw new ValidationError(MANAGER_ONLY, 403);
    if (!isPositiveId(body.userId) || typeof body.canManageAccess !== 'boolean') {
      throw new ValidationError('La cuenta o el permiso seleccionado no es válido.');
    }
    if (!await setStaffAccessManager(slug, Number(body.userId), body.canManageAccess, session.email)) {
      throw new ValidationError('No se encontró una cuenta activa para actualizar.', 404);
    }
    return { updated: true };
  },
  async 'delete-event'(body, { slug, url }) {
    if (Array.isArray(body.ids)) {
      if (!body.ids.length || body.ids.length > 1000 || body.ids.some(id => !String(id || '').trim() || String(id).length > 180)) {
        throw new ValidationError('La lista de eventos a eliminar no es válida.');
      }
      return { deleted: await sportsData.deleteEvents(slug, body.ids) };
    }
    const id = url.searchParams.get('id') || body.id;
    if (!id) throw new ValidationError('Falta el identificador del evento.');
    return { deleted: await sportsData.deleteEvent(slug, id) };
  },
  'save-player'(body, { slug }) {
    requireText(body.name, 120, 'Ingresá un nombre de hasta 120 caracteres.');
    if (!PLAYER_CATEGORIES.includes(body.category)) throw new ValidationError('Categoría inválida.');
    return sportsData.savePlayer(slug, body);
  },
  'save-physical-test'(body, { slug }) {
    return sportsData.savePhysicalTestDefinition(slug, body);
  },
  'deactivate-physical-test'(body, { slug }) {
    return sportsData.deactivatePhysicalTestDefinition(slug, requireText(body.testKey, Infinity, 'Seleccioná una prueba válida.'));
  },
  'reactivate-physical-test'(body, { slug }) {
    return sportsData.reactivatePhysicalTestDefinition(slug, requireText(body.testKey, Infinity, 'Seleccioná una prueba válida.'));
  },
  async 'delete-physical-test'(body, { slug }) {
    const result = await sportsData.deletePhysicalTestDefinition(slug, requireText(body.testKey, Infinity, 'Seleccioná una prueba válida.'));
    if (!result.deleted) {
      throw new ValidationError('La prueba ya tiene mediciones y no se puede eliminar. Desactivala para conservar su historial.', 409);
    }
    return result;
  },
  'update-player'(body, { slug }) {
    requireText(body.name, 120, 'Ingresá un nombre de hasta 120 caracteres.');
    if (!isPositiveId(body.id)) throw new ValidationError('La jugadora seleccionada no es válida.');
    if (!Array.isArray(body.categories) || !body.categories.length || body.categories.some(category => !PLAYER_CATEGORIES.includes(category))) {
      throw new ValidationError('Seleccioná al menos una categoría válida.');
    }
    return sportsData.updatePlayer(slug, body);
  },
  'save-callup'(body, { slug, seasonName, tournamentKey, tournamentName }) {
    if (!CALLUP_CATEGORIES.includes(body.category)) throw new ValidationError('Categoría inválida.');
    if (!Array.isArray(body.players) || body.players.length > 60) throw new ValidationError('La lista de jugadoras no es válida.');
    return sportsData.saveCallup(slug, body, seasonName, tournamentKey, tournamentName);
  },
  async 'delete-preparation'(body, { slug, seasonName, tournamentKey }) {
    if (!CALLUP_CATEGORIES.includes(body.category) || !String(body.matchKey || '').trim() || String(body.matchKey).length > 180) {
      throw new ValidationError('El plan seleccionado no es válido.');
    }
    return { deleted: await sportsData.deleteMatchPreparation(slug, body, seasonName, tournamentKey) };
  },
  'save-preparation'(body, { slug, seasonName, tournamentKey, tournamentName }) {
    if (!CALLUP_CATEGORIES.includes(body.category)) throw new ValidationError('Categoría inválida.');
    if (!String(body.matchKey || '').trim() || String(body.matchKey).length > 180 ||
        !String(body.round || '').trim() || String(body.round).length > 100 ||
        !String(body.opponent || '').trim() || String(body.opponent).length > 140) {
      throw new ValidationError('Completá el partido para guardar su preparación.');
    }
    const preparation = validatePreparation(body.preparation);
    return sportsData.saveMatchPreparation(slug, { ...body, preparation }, seasonName, tournamentKey, tournamentName);
  },
  'save-event'(body, { slug, seasonName, tournamentKey, tournamentName }) {
    if (!body.event || !body.event.id) throw new ValidationError('El evento debe incluir un identificador.');
    return sportsData.saveEvent(slug, body, seasonName, tournamentKey, tournamentName);
  },
  'replace-match-events'(body, { slug, seasonName, tournamentKey, tournamentName }) {
    if (!Array.isArray(body.events) || body.events.length > 1000) throw new ValidationError('La lista de eventos no es válida.');
    return sportsData.replaceMatchEvents(slug, body, seasonName, tournamentKey, tournamentName);
  },
  'save-physical-assessment'(body, { slug, seasonName }) {
    if ((!body.playerId && !String(body.name || '').trim()) || !Array.isArray(body.results) || !body.results.length || body.results.length > 500) {
      throw new ValidationError('Completá la jugadora y los resultados de la evaluación.');
    }
    return sportsData.savePhysicalAssessment(slug, body, seasonName);
  }
};

module.exports = async function handler(req, res) {
  const url = requestUrl(req);
  const slug = url.searchParams.get('club');
  try {
    const club = slug ? await getClubAsync(slug) : null;
    if (!club) return json(res, 404, { error: 'Club no encontrado.' });
    const context = {
      slug,
      club,
      url,
      seasonName: club.season?.name || String(new Date().getFullYear()),
      tournamentKey: club.tournament?.tournamentId || 'general'
    };
    context.tournamentName = club.tournament?.name || context.tournamentKey;

    if (req.method === 'GET') {
      const dataset = url.searchParams.get('dataset') || 'citations';
      if (![...PUBLIC_DATASETS, ...STAFF_DATASETS].includes(dataset)) throw new ValidationError('Conjunto de datos inválido.');
      if (STAFF_DATASETS.includes(dataset)) {
        context.session = await requestSession(req, club);
        if (!context.session.valid) return json(res, 401, { error: 'Sesión inválida o perteneciente a otro club.' });
      }
      return json(res, 200, await readDataset(dataset, context));
    }
    if (!['POST', 'DELETE'].includes(req.method)) return json(res, 405, { error: 'Método no permitido.' });

    const body = await readJson(req);
    // Las jugadoras registran su wellness y carga desde el enlace público del club.
    if (req.method === 'POST' && body.action === 'save-player-monitoring') {
      return json(res, 200, await sportsData.savePlayerMonitoring(slug, body, context.seasonName));
    }
    context.session = await requestSession(req, club);
    if (!context.session.valid) return json(res, 401, { error: 'Sesión inválida o perteneciente a otro club.' });

    const action = req.method === 'DELETE' ? STAFF_ACTIONS['delete-event'] : STAFF_ACTIONS[body.action];
    if (!action) throw new ValidationError('Acción de persistencia desconocida.');
    const result = await action(body, context);
    return result?.status ? json(res, result.status, result.payload) : json(res, 200, result);
  } catch (error) {
    if (error instanceof ValidationError) return json(res, error.status, { error: error.message });
    console.error('[API Club Data]', error);
    return json(res, 503, { error: 'No se pudo acceder a la base de datos del club.' });
  }
};
