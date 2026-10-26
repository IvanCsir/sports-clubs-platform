const { getClubAsync, getPublicClub } = require('./_lib/club-config');

module.exports = async function handler(req, res) {
  try {
    const host = (req.headers && req.headers.host) || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    const slug = url.searchParams.get('club');
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Ingresá con el enlace de tu club.' }));
      return;
    }
    const selected = await getClubAsync(slug);
    if (!selected) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Club no encontrado.' }));
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(JSON.stringify({
      club: getPublicClub(selected),
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'La configuración del club no está disponible temporalmente.' }));
  }
};
