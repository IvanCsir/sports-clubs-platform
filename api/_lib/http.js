function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}

// Vercel entrega el body ya parseado; el servidor local lo entrega como stream.
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
  try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
}

function requestUrl(req) {
  return new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
}

function bearerToken(req) {
  return String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

module.exports = { sendJson, readJson, requestUrl, bearerToken };
