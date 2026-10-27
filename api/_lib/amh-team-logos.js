const http = require('http');
const https = require('https');

const logoCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ITEMS = 200;

function normalizeTeamName(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[().,'"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const branch = normalized.match(/\s+([ABC])$/)?.[1] || '';
  const baseName = branch ? normalized.replace(/\s+[ABC]$/, '') : normalized;
  const compact = baseName.replace(/[^A-Z0-9]/g, '');
  const aliases = new Map([
    ['UNSJ', ['UNSJ', 'UNIVERSIDAD NACIONAL DE SAN JUAN', 'UNIVERSIDAD SAN JUAN', 'U N S JUAN', 'U N S J']],
    ['UNCUYO', ['UNCUYO', 'UNIVERSIDAD NACIONAL DE CUYO', 'UNIVERSIDAD DE CUYO', 'U N CUYO']],
    ['BCO MZA', ['BCO MZA', 'BANCO MZA', 'BANCO MENDOZA', 'BANCO DE MENDOZA', 'CPBM']],
    ['MARISTA SAN RAFAEL', ['MARISTA SAN RAFAEL', 'MARISTA S RAFAEL', 'MARISTAS SAN RAFAEL', 'MARISTAS S RAFAEL']],
    ['SAN RAFAEL TENIS CLUB', ['SAN RAFAEL TENIS CLUB', 'S R TENIS CLUB']],
    ['TORDOS', ['TORDOS', 'LOS TORDOS']],
    ['ALEMAN', ['ALEMAN', 'CLUB ALEMAN']],
    ['MURIALDO', ['MURIALDO', 'LEONARDO MURIALDO']]
  ]);
  for (const [canonical, names] of aliases) {
    if (names.some(name => name.replace(/[^A-Z0-9]/g, '') === compact)) {
      return branch ? `${canonical} ${branch}` : canonical;
    }
  }
  return normalized;
}

function mergeCookies(currentCookies, setCookieHeaders = []) {
  const cookies = new Map();
  for (const cookie of currentCookies) {
    const pair = String(cookie).split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
  for (const cookie of setCookieHeaders || []) {
    const pair = String(cookie).split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`);
}

function requestBuffer(url, headers = {}, redirects = 0, cookies = []) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const requestHeaders = { ...headers };
    if (cookies.length) requestHeaders.Cookie = cookies.join('; ');
    const request = client.get(parsedUrl, { headers: requestHeaders }, response => {
      const responseCookies = mergeCookies(cookies, response.headers['set-cookie']);
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects < 3) {
        response.resume();
        const redirectUrl = new URL(response.headers.location, parsedUrl);
        if (redirectUrl.origin !== parsedUrl.origin) {
          reject(new Error('AMH redirigió la solicitud del escudo a otro origen.'));
          return;
        }
        resolve(requestBuffer(redirectUrl.toString(), headers, redirects + 1, responseCookies));
        return;
      }

      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) {
          request.destroy(new Error('El escudo de AMH supera el tamaño permitido.'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`AMH respondió ${response.statusCode} al solicitar el escudo.`));
          return;
        }
        resolve({ body, headers: response.headers, cookies: responseCookies });
      });
    });

    request.setTimeout(10000, () => request.destroy(new Error('Timeout consultando el escudo en AMH.')));
    request.on('error', reject);
  });
}

function resolveImageContentType(body, declaredType) {
  const type = String(declaredType || '').split(';')[0].toLowerCase();
  if (type.startsWith('image/')) return type;
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg';
  if (body.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/)) return 'image/gif';
  if (body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(body.subarray(0, 512).toString('utf8'))) return 'image/svg+xml';
  return '';
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

  const image = await requestBuffer(imageUrl, {
    'User-Agent': 'SportsClubsPlatform/1.0',
    Referer: standingsUrl
  }, 0, standings.cookies);
  const contentType = resolveImageContentType(image.body, image.headers['content-type']);
  if (!contentType) throw new Error('AMH no devolvió un archivo de imagen para el escudo.');

  const result = { body: image.body, contentType, expiresAt: Date.now() + CACHE_TTL_MS };
  if (logoCache.size >= MAX_CACHE_ITEMS) logoCache.delete(logoCache.keys().next().value);
  logoCache.set(key, result);
  return result;
}

module.exports = { fetchTeamLogo, normalizeTeamName };
