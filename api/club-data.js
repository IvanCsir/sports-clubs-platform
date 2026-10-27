const { getClubAsync } = require('./_lib/club-config');
const { verifySessionToken } = require('./auth');
const sportsData = require('./_lib/sports-data');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

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

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const slug = url.searchParams.get('club');
  try {
    const club = slug ? await getClubAsync(slug) : null;
    if (!club) return json(res, 404, { error: 'Club no encontrado.' });
    const seasonName = club.season?.name || String(new Date().getFullYear());
    const tournamentKey = club.tournament?.tournamentId || 'general';
    const tournamentName = club.tournament?.name || tournamentKey;

    if (req.method === 'GET') {
      const dataset = url.searchParams.get('dataset') || 'citations';
      if (!['citations', 'physical', 'staff', 'preparations', 'player-portal', 'backup'].includes(dataset)) return json(res, 400, { error: 'Conjunto de datos inválido.' });
      if (dataset === 'player-portal') {
        return json(res, 200, { players: await sportsData.getPlayerPortalRoster(slug) });
      }
      if (dataset === 'preparations') {
        return json(res, 200, { preparations: await sportsData.getMatchPreparations(slug, seasonName, tournamentKey) });
      }
      if (dataset === 'physical') {
        // Las evaluaciones son públicas para que las jugadoras puedan consultarlas desde el enlace del club.
        const data = await sportsData.getClubData(slug, seasonName, tournamentKey);
        return json(res, 200, { physicalPlayers: data.physicalPlayers, physicalTests: data.physicalTests });
      }
      if (dataset === 'backup') {
        const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
        if (!token || !verifySessionToken(token, club).valid) {
          return json(res, 401, { error: 'Sesión inválida o perteneciente a otro club.' });
        }
        const backup = await sportsData.getSeasonBackup(slug, seasonName, tournamentKey);
        return json(res, 200, {
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
          ...backup
        });
      }
      if (dataset === 'staff') {
        const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
        if (!token || !verifySessionToken(token, club).valid) {
          return json(res, 401, { error: 'Sesión inválida o perteneciente a otro club.' });
        }
        const data = await sportsData.getClubData(slug, seasonName, tournamentKey);
        return json(res, 200, {
          physicalPlayers: data.physicalPlayers, physicalTests: data.physicalTests, events: data.events, players: data.players || [], citations: data.citations,
          monitoring: await sportsData.getPlayerMonitoring(slug, seasonName),
          tournamentStats: await sportsData.getTournamentStats(slug, seasonName, tournamentKey, tournamentName)
        });
      }
      const data = await sportsData.getClubData(slug, seasonName, tournamentKey);
      return json(res, 200, { citations: data.citations });
    }
    if (!['POST', 'DELETE'].includes(req.method)) return json(res, 405, { error: 'Método no permitido.' });

    const body = await readBody(req);
    if (req.method === 'POST' && body.action === 'save-player-monitoring') {
      try {
        return json(res, 200, await sportsData.savePlayerMonitoring(slug, body, seasonName));
      } catch (error) {
        if (/Seleccioná|Completá|Indicá|La fecha|Tipo de registro|no pertenece/.test(error.message)) {
          return json(res, 400, { error: error.message });
        }
        throw error;
      }
    }
    const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token || !verifySessionToken(token, club).valid) {
      return json(res, 401, { error: 'Sesión inválida o perteneciente a otro club.' });
    }
    if (req.method === 'DELETE' || body.action === 'delete-event') {
      if (Array.isArray(body.ids)) {
        if (!body.ids.length || body.ids.length > 1000 || body.ids.some(id => !String(id || '').trim() || String(id).length > 180)) {
          return json(res, 400, { error: 'La lista de eventos a eliminar no es válida.' });
        }
        return json(res, 200, { deleted: await sportsData.deleteEvents(slug, body.ids) });
      }
      const id = url.searchParams.get('id') || body.id;
      if (!id) return json(res, 400, { error: 'Falta el identificador del evento.' });
      return json(res, 200, { deleted: await sportsData.deleteEvent(slug, id) });
    }
    if (body.action === 'save-player') {
      if (!String(body.name || '').trim() || String(body.name).trim().length > 120) {
        return json(res, 400, { error: 'Ingresá un nombre de hasta 120 caracteres.' });
      }
      if (!['primera', 'intermedia', '5ta'].includes(body.category)) return json(res, 400, { error: 'Categoría inválida.' });
      return json(res, 200, await sportsData.savePlayer(slug, body));
    }
    if (body.action === 'save-physical-test') {
      try {
        return json(res, 200, await sportsData.savePhysicalTestDefinition(slug, body));
      } catch (error) {
        if (/Indicá|no puede|deben|debe estar|Ya existe/.test(error.message)) return json(res, 400, { error: error.message });
        throw error;
      }
    }
    if (body.action === 'deactivate-physical-test') {
      if (!String(body.testKey || '').trim()) return json(res, 400, { error: 'Seleccioná una prueba válida.' });
      return json(res, 200, await sportsData.deactivatePhysicalTestDefinition(slug, body.testKey));
    }
    if (body.action === 'reactivate-physical-test') {
      if (!String(body.testKey || '').trim()) return json(res, 400, { error: 'Seleccioná una prueba válida.' });
      return json(res, 200, await sportsData.reactivatePhysicalTestDefinition(slug, body.testKey));
    }
    if (body.action === 'update-player') {
      if (!String(body.name || '').trim() || String(body.name).trim().length > 120) {
        return json(res, 400, { error: 'Ingresá un nombre de hasta 120 caracteres.' });
      }
      if (!Number.isSafeInteger(Number(body.id)) || Number(body.id) <= 0) return json(res, 400, { error: 'La jugadora seleccionada no es válida.' });
      if (!Array.isArray(body.categories) || !body.categories.length || body.categories.some(category => !['primera', 'intermedia', '5ta'].includes(category))) {
        return json(res, 400, { error: 'Seleccioná al menos una categoría válida.' });
      }
      try {
        return json(res, 200, await sportsData.updatePlayer(slug, body));
      } catch (error) {
        if (error.message === 'Ya existe otra jugadora con ese nombre en este club.') return json(res, 409, { error: error.message });
        throw error;
      }
    }
    if (body.action === 'save-callup') {
      if (!['primera', 'intermedia'].includes(body.category)) return json(res, 400, { error: 'Categoría inválida.' });
      if (!Array.isArray(body.players) || body.players.length > 60) return json(res, 400, { error: 'La lista de jugadoras no es válida.' });
      return json(res, 200, await sportsData.saveCallup(slug, body, seasonName, tournamentKey, tournamentName));
    }
    if (body.action === 'delete-preparation') {
      if (!['primera', 'intermedia'].includes(body.category) || !String(body.matchKey || '').trim() || String(body.matchKey).length > 180) {
        return json(res, 400, { error: 'El plan seleccionado no es válido.' });
      }
      return json(res, 200, {
        deleted: await sportsData.deleteMatchPreparation(slug, body, seasonName, tournamentKey)
      });
    }
    if (body.action === 'save-preparation') {
      if (!['primera', 'intermedia'].includes(body.category)) return json(res, 400, { error: 'Categoría inválida.' });
      if (!String(body.matchKey || '').trim() || String(body.matchKey).length > 180 ||
          !String(body.round || '').trim() || String(body.round).length > 100 ||
          !String(body.opponent || '').trim() || String(body.opponent).length > 140) {
        return json(res, 400, { error: 'Completá el partido para guardar su preparación.' });
      }
      const preparation = body.preparation || {};
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
        return json(res, 400, { error: 'La preparación supera los límites permitidos.' });
      }
      const videos = [];
      for (const item of videosInput) {
        const title = typeof item === 'string' ? '' : String(item?.title || '').trim();
        const value = String(typeof item === 'string' ? item : item?.url || '').trim();
        if (!value) continue;
        if (title.length > 100) return json(res, 400, { error: 'El título de un video supera el máximo permitido.' });
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol) || value.length > 1000) throw new Error();
        } catch (_) {
          return json(res, 400, { error: 'Cada video debe tener un enlace web válido.' });
        }
        videos.push({ title, url: value });
      }
      for (const play of plays) {
        if (!play || String(play.title || '').trim().length > 80 || !Array.isArray(play.frames) || play.frames.length > 30) {
          return json(res, 400, { error: 'Una jugada táctica no es válida.' });
        }
        for (const frame of play.frames) {
          if (!Array.isArray(frame) || frame.length > 22) return json(res, 400, { error: 'Un paso de la jugada no es válido.' });
          for (const marker of frame) {
            if (!marker || !['own', 'opponent', 'ball'].includes(marker.side) ||
                !Number.isFinite(Number(marker.x)) || Number(marker.x) < 0 || Number(marker.x) > 100 ||
                !Number.isFinite(Number(marker.y)) || Number(marker.y) < 0 || Number(marker.y) > 100 ||
                String(marker.label || '').length > 12) {
              return json(res, 400, { error: 'La pizarra táctica contiene una ficha inválida.' });
            }
          }
        }
      }
      const saved = await sportsData.saveMatchPreparation(slug, {
        ...body,
        preparation: {
          focus,
          videos,
          videoUrls: videos.map(video => video.url),
          plays
        }
      }, seasonName, tournamentKey, tournamentName);
      return json(res, 200, saved);
    }
    if (body.action === 'save-event') {
      if (!body.event || !body.event.id) return json(res, 400, { error: 'El evento debe incluir un identificador.' });
      return json(res, 200, await sportsData.saveEvent(slug, body, seasonName, tournamentKey, tournamentName));
    }
    if (body.action === 'replace-match-events') {
      if (!Array.isArray(body.events) || body.events.length > 1000) return json(res, 400, { error: 'La lista de eventos no es válida.' });
      return json(res, 200, await sportsData.replaceMatchEvents(slug, body, seasonName, tournamentKey, tournamentName));
    }
    if (body.action === 'save-physical-assessment') {
      if (!String(body.name || '').trim() || !Array.isArray(body.results) || !body.results.length || body.results.length > 500) {
        return json(res, 400, { error: 'Completá la jugadora y los resultados de la evaluación.' });
      }
      try {
        return json(res, 200, await sportsData.savePhysicalAssessment(slug, body, seasonName));
      } catch (error) {
        if (/Una medición|Faltan datos/.test(error.message)) return json(res, 400, { error: error.message });
        throw error;
      }
    }
    return json(res, 400, { error: 'Acción de persistencia desconocida.' });
  } catch (error) {
    console.error('[API Club Data]', error);
    return json(res, 503, { error: 'No se pudo acceder a la base de datos del club.' });
  }
};
