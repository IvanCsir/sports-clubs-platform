const http = require('http');
const https = require('https');
const { getClubAsync } = require('../_lib/club-config');

function fetchAmhStandings(division, club) {
  return new Promise((resolve, reject) => {
    const divId = division === '2' ? '2' : '1';
    const tournament = club.tournament || {};
    const url = `${tournament.baseUrl}/ords/r/amh/torneos/5?p5_torneos_f=${encodeURIComponent(tournament.tournamentId)}&p5_jug_cod_division_f=${divId}`;
    const client = url.startsWith('https:') ? https : http;

    const req = client.get(url, (res) => {
      let html = '';
      res.on('data', (chunk) => { html += chunk; });
      res.on('end', () => {
        try {
          const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
          const tableData = [];
          const scorersData = [];
          let isScorers = false;

          rows.forEach((r) => {
            const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
              .map((c) => c[1].replace(/<[^>]+>/g, '').trim());
            if (cells.length === 0 || cells.every((c) => !c)) return;

            if (cells.includes('Jugador') || cells.includes('Goles')) {
              isScorers = true;
              return;
            }

            if (cells.includes('Posición') || cells.includes('Equipo')) {
              return;
            }

            if (!isScorers) {
              const filtered = cells.filter((c) => c !== '');
              if (filtered.length >= 10) {
                const team = filtered[2];
                tableData.push({
                  pos: parseInt(filtered[0], 10),
                  zona: filtered[1],
                  team,
                  logoUrl: `/api/torneo/team-logo?club=${encodeURIComponent(club.slug)}&division=${divId}&team=${encodeURIComponent(team)}`,
                  pj: parseInt(filtered[3], 10),
                  pg: parseInt(filtered[4], 10),
                  pe: parseInt(filtered[5], 10),
                  pp: parseInt(filtered[6], 10),
                  gf: parseInt(filtered[7], 10),
                  ge: parseInt(filtered[8], 10),
                  dif: parseInt(filtered[9], 10),
                  bonus: parseInt(filtered[10] || 0, 10),
                  pts: parseInt(filtered[filtered.length - 1], 10)
                });
              }
            } else {
              const filtered = cells.filter((c) => c !== '');
              if (filtered.length >= 3) {
                scorersData.push({
                  club: filtered[0],
                  player: filtered[1],
                  goals: parseInt(filtered[2], 10)
                });
              }
            }
          });

          resolve({
            tournament: (tournament && tournament.name) || (tournament.tournamentId === '96' ? 'CLAUSURA DAMAS A - (2026)' : 'Clausura Damas B 2026'),
            division: divId,
            divisionName: divId === '2' ? 'Intermedia (Segunda)' : '1ra División (Primera)',
            standings: tableData,
            scorers: scorersData,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Timeout conectando a AMH'));
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const division = urlObj.searchParams.get('division') || '1';
  try {
    const club = await getClubAsync(urlObj.searchParams.get('club'));
    if (!club || !club.tournament?.baseUrl || !club.tournament?.tournamentId) {
      throw new Error('El club no tiene configurado su torneo AMH.');
    }
    const data = await fetchAmhStandings(division, club);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message, standings: [], scorers: [] }));
  }
};
