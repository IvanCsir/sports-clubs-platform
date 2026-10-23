/**
 * Endpoint para Precarga Oficial AMH
 * Soporta GET (listar partidos disponibles) y POST (inscribir tildados)
 * Compatible con Node.js local y Vercel Serverless Functions
 */

const { fetchAvailableMatches, executeAmhPrecarga } = require('../_lib/amh.js');
const { getClubAsync } = require('../_lib/club-config');

module.exports = async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // GET: Obtener partidos disponibles
  if (req.method === 'GET' || url.searchParams.has('matches')) {
    const division = url.searchParams.get('division') || '1';
    const slug = url.searchParams.get('club');
    const club = slug ? await getClubAsync(slug) : null;
    try {
      const matches = await fetchAvailableMatches(division, club);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, matches }));
    } catch (err) {
      console.error('[API Precarga GET Error]:', err);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, matches: [], error: err.message }));
    }
    return;
  }

  // POST: Ejecutar precarga en AMH
  if (req.method === 'POST') {
    try {
      // Extraer payload de forma compatible con Vercel (pre-parsed) y Node raw stream
      let payload;
      if (req.body && typeof req.body === 'object') {
        payload = req.body;
      } else if (req.body && typeof req.body === 'string') {
        try { payload = JSON.parse(req.body); } catch (_) { payload = {}; }
      } else {
        const raw = await new Promise((resolve) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
          req.on('error', () => resolve(''));
        });
        try { payload = JSON.parse(raw || '{}'); } catch (_) { payload = {}; }
      }

      const { division = '1', partidoId = null, rival = null, players = [] } = payload;

      if (!players || players.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Lista de jugadoras citadas vacía.' }));
        return;
      }

      const result = await executeAmhPrecarga({
        division,
        partidoId,
        rival,
        players
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, result }));
    } catch (err) {
      console.error('[API Precarga POST Error]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Método no permitido' }));
};
