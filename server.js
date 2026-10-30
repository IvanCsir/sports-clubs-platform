// Servidor de desarrollo local. Reproduce el ruteo de Vercel: cada archivo de api/ es una
// función (api/torneo/matches.js → /api/torneo/matches), se aplican los rewrites de
// vercel.json y el resto se sirve desde frontend/dist con fallback a index.html.
require('./scripts/load-env')();

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const API_ROOT = path.resolve(__dirname, 'api');
const STATIC_ROOT = path.resolve(__dirname, 'frontend', 'dist');
const { rewrites = [] } = require('./vercel.json');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

function rewritePath(pathname) {
  return rewrites.find(rule => rule.source === pathname)?.destination || pathname;
}

// Igual que en Vercel, los segmentos que empiezan con "_" no son funciones públicas.
function findApiHandler(pathname) {
  const segments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (segments.some(segment => segment.startsWith('_') || segment.startsWith('.'))) return null;
  const base = path.join(API_ROOT, ...segments);
  return [`${base}.js`, path.join(base, 'index.js')].find(file => file.startsWith(API_ROOT) && fs.existsSync(file)) || null;
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function serveStatic(pathname, res) {
  let relativePath;
  try { relativePath = decodeURIComponent(pathname.replace(/^\/+/, '')); }
  catch (_) { return send(res, 400, '400 Solicitud inválida'); }
  const filePath = path.resolve(STATIC_ROOT, relativePath || 'index.html');
  if (filePath !== STATIC_ROOT && !filePath.toLowerCase().startsWith(`${STATIC_ROOT.toLowerCase()}${path.sep}`)) {
    return send(res, 403, '403 Acceso denegado');
  }
  fs.readFile(filePath, (err, content) => {
    if (!err) return send(res, 200, content, MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    if (err.code !== 'ENOENT' && err.code !== 'EISDIR') return send(res, 500, `Error interno del servidor: ${err.code}`);
    if (path.extname(pathname)) return send(res, 404, '404 No Encontrado');
    fs.readFile(path.join(STATIC_ROOT, 'index.html'), (indexError, indexContent) => {
      if (indexError) return send(res, 503, 'El portal no está compilado. Ejecutá npm start para prepararlo.');
      send(res, 200, indexContent, MIME_TYPES['.html']);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = rewritePath(url.pathname.replace(/\/+$/, '') || '/');
  if (!pathname.startsWith('/api/')) return serveStatic(pathname, res);

  const handlerFile = findApiHandler(pathname);
  if (!handlerFile) return send(res, 404, JSON.stringify({ error: 'Ruta no encontrada.' }), 'application/json; charset=utf-8');
  try {
    await require(handlerFile)(req, res);
  } catch (error) {
    console.error(`[${pathname}]`, error);
    if (!res.headersSent) send(res, 500, JSON.stringify({ error: 'Error interno del servidor.' }), 'application/json; charset=utf-8');
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🏑 Sports Clubs Platform ACTIVO`);
  console.log(`👉 Abrí en tu navegador: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
