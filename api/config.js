const { getClubAsync, getPublicClub } = require('./_lib/club-config');
const { sendJson: json, requestUrl } = require('./_lib/http');

module.exports = async function handler(req, res) {
  try {
    const slug = requestUrl(req).searchParams.get('club');
    if (!slug) return json(res, 400, { error: 'Ingresá con el enlace de tu club.' });
    const selected = await getClubAsync(slug);
    if (!selected) return json(res, 404, { error: 'Club no encontrado.' });
    return json(res, 200, {
      club: getPublicClub(selected),
      googleClientId: process.env.GOOGLE_CLIENT_ID || '',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(res, 503, { error: 'La configuración del club no está disponible temporalmente.' });
  }
};
