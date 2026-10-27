const http = require('http');
const https = require('https');

const logoCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ITEMS = 200;

function normalizeTeamName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[().,'"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requestBuffer(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const request = client.get(parsedUrl, { headers }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects < 3) {
        response.resume();
        const redirectUrl = new URL(response.headers.location, parsedUrl);
        if (redirectUrl.origin !== parsedUrl.origin) {
          reject(new Error('AMH redirigió la solicitud del escudo a otro origen.'));
          return;
        }
        resolve(requestBuffer(redirectUrl.toString(), headers, redirects + 1));
        return;
      }

      const chunks = [];
      let size = 0;
      response.on('data', chunk => chunks.push(chunk));
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) request.destroy(new Error('El escudo de AMH supera el tamaño permitido.'));
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`AMH respondió ${response.statusCode} al solicitar el escudo.`));
          return;
        }
        resolve({ body, headers: response.headers });
      });
    });

    request.setTimeout(10000, () => request.destroy(new Error('Timeout consultando el escudo en AMH.')));
    request.on('error', reject);
  });
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2f;/gi, '/')
    .replace(/&#x3d;/gi, '=')
    .replace(/&#47;/gi, '/')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cellText(html) {
  return decodeHtml(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractImageSource(html) {
  const image = String(html || '').match(/<img\b[^>]*>/i)?.[0] || '';
  const source = image.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return decodeHtml(source?.[1] || source?.[2] || source?.[3] || '');
}

function findLogoSource(html, teamName, pageUrl) {
  const target = normalizeTeamName(teamName);
  const rows = [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const row of rows) {
    const cells = new Map();
    for (const cell of row[1].matchAll(/<t[dh]\b[^>]*headers\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
      cells.set(cell[2].trim().toUpperCase(), cell[3]);
    }
    if (normalizeTeamName(cellText(cells.get('EQUIPO'))) !== target) continue;

    const imageSource = extractImageSource(cells.get('LOGO_DEL_CLUB'));
    if (!imageSource) return null;

    const imageUrl = new URL(imageSource, pageUrl);
    const pageOrigin = new URL(pageUrl).origin;
    if (imageUrl.origin !== pageOrigin) return null;
    return imageUrl.toString();
  }
  return null;
}

function cacheKey(tournament, division, teamName) {
  return [tournament.baseUrl, tournament.tournamentId, division, normalizeTeamName(teamName)].join('|');
}

async function fetchTeamLogo(tournament, division, teamName) {
  const key = cacheKey(tournament, division, teamName);
  const cached = logoCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const divId = division === '2' || division === 'intermedia' ? '2' : '1';
  const baseUrl = String(tournament.baseUrl || '').replace(/\/$/, '');
  const standingsUrl = `${baseUrl}/ords/r/amh/torneos/5?p5_torneos_f=${encodeURIComponent(tournament.tournamentId)}&p5_jug_cod_division_f=${divId}`;
  const standings = await requestBuffer(standingsUrl, { 'User-Agent': 'SportsClubsPlatform/1.0' });
  const imageUrl = findLogoSource(standings.body.toString('utf8'), teamName, standingsUrl);
  if (!imageUrl) return null;

  const cookies = (standings.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).filter(Boolean).join('; ');
  const image = await requestBuffer(imageUrl, {
    'User-Agent': 'SportsClubsPlatform/1.0',
    Referer: standingsUrl,
    ...(cookies ? { Cookie: cookies } : {})
  });
  const contentType = String(image.headers['content-type'] || '').split(';')[0].toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error('AMH no devolvió un archivo de imagen para el escudo.');

  const result = { body: image.body, contentType, expiresAt: Date.now() + CACHE_TTL_MS };
  if (logoCache.size >= MAX_CACHE_ITEMS) logoCache.delete(logoCache.keys().next().value);
  logoCache.set(key, result);
  return result;
}

module.exports = { fetchTeamLogo, normalizeTeamName };
