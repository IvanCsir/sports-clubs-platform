const { getClubAsync } = require('../_lib/club-config');
const { fetchTeamLogo } = require('../_lib/amh-team-logos');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    const club = await getClubAsync(url.searchParams.get('club'));
    const teamName = url.searchParams.get('team') || '';
    const division = url.searchParams.get('division') || '1';
    if (!club?.tournament?.baseUrl || !club.tournament.tournamentId || !teamName.trim()) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Falta el equipo o la configuración AMH del club.' }));
      return;
    }

    const logo = await fetchTeamLogo(club.tournament, division, teamName);
    if (!logo) {
      res.statusCode = 404;
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(logo.body);
  } catch (error) {
    console.warn('[AMH Logo] No se pudo cargar el escudo:', error.message);
    res.statusCode = 502;
    res.end();
  }
};
