const http = require('http');
const https = require('https');

const DEFAULT_BASE_URL = 'http://15.235.75.172:8080';

function fetchHtml(url) {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => response.statusCode === 200 ? resolve(body) : reject(new Error(`AMH respondió HTTP ${response.statusCode}.`)));
    });
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('AMH tardó demasiado en responder.'));
    });
    request.on('error', () => reject(new Error('No se pudo conectar con AMH.')));
  });
}

function parseOptions(html, id) {
  const select = html.match(new RegExp(`<select[^>]+(?:id|name)=["']${id}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i'));
  if (!select) return [];
  return [...select[1].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)]
    .map(match => ({
      value: match[1].trim(),
      label: match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    }))
    .filter(option => option.value && !/^seleccione/i.test(option.label));
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const baseUrl = (requestUrl.searchParams.get('baseUrl') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  try {
    const tournamentPage = await fetchHtml(`${baseUrl}/ords/r/amh/torneos/5`);
    const fixturePage = await fetchHtml(`${baseUrl}/ords/r/amh/torneos/6`);
    return json(res, 200, {
      baseUrl,
      tournaments: parseOptions(tournamentPage, 'P5_TORNEOS_F'),
      divisions: parseOptions(tournamentPage, 'P5_JUG_COD_DIVISION_F'),
      teams: parseOptions(fixturePage, 'P6_CLUB_P')
    });
  } catch (error) {
    return json(res, 502, { error: error.message });
  }
};
