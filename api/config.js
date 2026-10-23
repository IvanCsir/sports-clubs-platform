const { getClub, getPublicClub, readConfiguredClubs, readConfiguredClubsAsync } = require('./_lib/club-config');

module.exports = async function handler(req, res) {
  try {
    const host = (req.headers && req.headers.host) || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    const configured = await readConfiguredClubsAsync();
    const clubs = configured.map(club => getPublicClub(club));
    const selected = configured.find(club => club.slug === url.searchParams.get('club')) || configured[0] || getClub();

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(JSON.stringify({
      club: getPublicClub(selected),
      clubs,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message }));
  }
};
