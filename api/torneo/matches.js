const http = require('http');
const https = require('https');
const { getClubAsync } = require('../_lib/club-config');

function normalizeTeamName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[().,'"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSelectedTeam(teamName, club) {
  const configured = [
    club.tournament && club.tournament.amhTeamName,
    club.tournament && club.tournament.teamName,
    club.shortName,
    club.name
  ].filter(Boolean).map(normalizeTeamName);
  const candidate = normalizeTeamName(teamName);
  return configured.some(name => candidate === name || candidate.startsWith(`${name} `) || name.startsWith(`${candidate} `));
}

const AMH_MATCH_TIMES = {
  '9959': '16:45', '9967': '11:30', '9974': '16:45', '9984': '16:45',
  '10079': '15:15', '10087': '10:00', '10094': '15:15', '10104': '15:15'
};

function getMatchTime(cells, division) {
  const matchNumber = String(cells['PARTIDO_NRO'] || '').split('/')[0].replace(/^0+/, '');
  return cells['HORA_PARTIDO'] || AMH_MATCH_TIMES[matchNumber] || (division === '2' ? '15:15' : '16:45');
}

function parseMatchDate(value) {
  const text = String(value || '').trim();
  const localDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (localDate) {
    const year = Number(localDate[3]) < 100 ? 2000 + Number(localDate[3]) : Number(localDate[3]);
    const month = Number(localDate[2]);
    const day = Number(localDate[1]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime();
  }

  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime();
  }
  return null;
}

function compareMatchesByDate(a, b) {
  const aDate = parseMatchDate(a.fecha);
  const bDate = parseMatchDate(b.fecha);
  if (aDate !== null && bDate !== null && aDate !== bDate) return aDate - bDate;
  if (aDate !== null && bDate === null) return -1;
  if (aDate === null && bDate !== null) return 1;

  const aRound = Number(String(a.round || '').match(/\d+/)?.[0] || Number.MAX_SAFE_INTEGER);
  const bRound = Number(String(b.round || '').match(/\d+/)?.[0] || Number.MAX_SAFE_INTEGER);
  return aRound - bRound;
}

function fetchAmhMatches(division, club) {
  return new Promise((resolve, reject) => {
    const divId = division === '2' ? '2' : '1';
    const tournament = club.tournament || {};
    const url = `${tournament.baseUrl}/ords/f?p=1107:6:0:FLOW_EXCEL_OUTPUT:::P6_TORNEOS_P,P6_CLUB_P,P6_JUG_COD_DIVISION_P:${encodeURIComponent(tournament.tournamentId)},${encodeURIComponent(tournament.clubId)},${divId}`;
    const client = url.startsWith('https:') ? https : http;

    const req = client.get(url, (res) => {
      let html = '';
      res.on('data', (chunk) => { html += chunk; });
      res.on('end', () => {
        try {
          const tableMatch = html.match(/<table[^>]+id="report_table_R195581212816937222"[^>]*>([\s\S]*?)<\/table>/i);
          if (!tableMatch) {
            resolve({ matches: [], playedMatches: [], pendingMatches: [], nextMatch: null });
            return;
          }

          const rows = [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
          const allMatches = [];
          const playedMatches = [];
          const pendingMatches = [];

          rows.forEach((r) => {
            const cells = {};
            const tdMatches = [...r[1].matchAll(/<td[^>]+headers="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi)];
            tdMatches.forEach((td) => {
              const header = td[1].trim();
              const rawVal = td[2].replace(/<[^>]+>/g, '').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&').trim();
              cells[header] = rawVal;
              if (header === 'ESTADO_PARTIDO') cells['ESTADO_HTML'] = td[2];
            });

            if (!cells['FECHA_NRO']) return;

            const estadoHtml = cells['ESTADO_HTML'] || '';
            const hasTimesCircle = estadoHtml.includes('fa-times-circle') || estadoHtml.includes('#E50D0D') || estadoHtml.includes('times');
            const hasCheckCircle = estadoHtml.includes('fa-check-circle') || estadoHtml.includes('#0E7A16');
            const isPlayed = hasCheckCircle && !hasTimesCircle;

            const local = (cells['EQUIPO_LOCAL'] || '').trim();
            const visita = (cells['EQUIPO_VISITANTE'] || '').trim();
            if (!isSelectedTeam(local, club) && !isSelectedTeam(visita, club)) return;
            const isHome = isSelectedTeam(local, club);
            const rival = (isHome ? visita : local).trim();
            const homeAway = isHome ? 'Local' : 'Visitante';

            let score = '-';
            let result = 'pending';
            if (isPlayed) {
              const gl = parseInt(cells['GOLES_LOCAL'], 10) || 0;
              const gv = parseInt(cells['GOLES_VISITA'], 10) || 0;
              if (isHome) {
                score = `${gl} - ${gv}`;
                result = gl > gv ? 'win' : (gl < gv ? 'loss' : 'draw');
              } else {
                score = `${gv} - ${gl}`;
                result = gv > gl ? 'win' : (gv < gl ? 'loss' : 'draw');
              }
            }

            const opponentLogoUrl = `/api/torneo/team-logo?club=${encodeURIComponent(club.slug)}&division=${divId}&team=${encodeURIComponent(rival)}`;
            const matchObj = {
              round: `Fecha ${cells['FECHA_NRO']}`,
              fecha: cells['FECHA'] || '',
              rival,
              opponentLogoUrl,
              homeAway,
              matchTime: getMatchTime(cells, divId),
              score,
              result,
              played: isPlayed,
              status: isPlayed ? 'Jugado' : 'Pendiente'
            };

            allMatches.push(matchObj);
            if (isPlayed) {
              playedMatches.push(matchObj);
            } else {
              pendingMatches.push(matchObj);
            }
          });

          // Las fechas pueden reprogramarse y romper el orden numérico del fixture.
          allMatches.sort(compareMatchesByDate);
          playedMatches.sort(compareMatchesByDate);
          pendingMatches.sort(compareMatchesByDate);
          const nextMatch = pendingMatches[0] || null;

          resolve({
            division,
            matches: allMatches,
            playedMatches,
            pendingMatches,
            nextMatch,
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
    if (!club || !club.tournament?.baseUrl || !club.tournament?.tournamentId || !club.tournament?.clubId) {
      throw new Error('El club no tiene configurado su torneo AMH.');
    }
    const data = await fetchAmhMatches(division, club);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message, matches: [], playedMatches: [], pendingMatches: [] }));
  }
};
