/**
 * Precarga oficial en AMH.
 * GET lista los partidos disponibles y POST inscribe a las jugadoras citadas.
 */

const { fetchAvailableMatches, executeAmhPrecarga } = require('../_lib/amh.js');
const { getClubAsync } = require('../_lib/club-config');
const { requestSession } = require('../auth');
const { sendJson: json, readJson, requestUrl } = require('../_lib/http');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = requestUrl(req);

  if (req.method === 'GET' || url.searchParams.has('matches')) {
    try {
      const slug = url.searchParams.get('club');
      const club = slug ? await getClubAsync(slug) : null;
      if (!club) return json(res, 404, { success: false, error: 'Club no encontrado.' });
      const matches = await fetchAvailableMatches(url.searchParams.get('division') || '1', club);
      return json(res, 200, { success: true, matches });
    } catch (err) {
      console.error('[API Precarga GET Error]:', err);
      return json(res, 200, { success: false, matches: [], error: 'No se pudieron consultar los partidos en AMH.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const payload = await readJson(req);
      const { division = '1', partidoId = null, rival = null, players = [] } = payload;
      const clubSlug = String(payload.clubSlug || url.searchParams.get('club') || '').trim();
      const club = clubSlug ? await getClubAsync(clubSlug) : null;

      if (!club) return json(res, 404, { success: false, error: 'Club no encontrado.' });
      if (!(await requestSession(req, club)).valid) {
        return json(res, 401, { success: false, error: 'Sesión inválida o perteneciente a otro club.' });
      }
      if (!players || players.length === 0) {
        return json(res, 400, { success: false, error: 'Lista de jugadoras citadas vacía.' });
      }

      const result = await executeAmhPrecarga({ club, division, partidoId, rival, players });
      return json(res, 200, { success: true, result });
    } catch (err) {
      console.error('[API Precarga POST Error]:', err);
      // Los errores de la automatización describen el paso de AMH que falló y no contienen credenciales.
      return json(res, 500, { success: false, error: err.message });
    }
  }

  return json(res, 405, { error: 'Método no permitido' });
};
