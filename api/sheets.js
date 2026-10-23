const https = require('https');
const { readConfiguredClubsAsync } = require('./_lib/club-config');

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function fetchSheet(spreadsheetId, sheet) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  if (sheet) {
    url.searchParams.set('range', 'A:L');
    url.searchParams.set('sheet', sheet);
  }
  url.searchParams.set('_t', Date.now().toString());

  return new Promise((resolve, reject) => {
    https.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Google Sheets respondió HTTP ${response.statusCode}.`));
          return;
        }
        const match = body.match(/setResponse\(([\s\S]+)\);/);
        if (!match) {
          reject(new Error('Google Sheets no devolvió una respuesta de consulta válida.'));
          return;
        }
        try {
          const payload = JSON.parse(match[1]);
          if (payload.status !== 'ok') {
            reject(new Error('Google Sheets rechazó la consulta.'));
            return;
          }
          resolve(payload.table);
        } catch (_) {
          reject(new Error('No se pudo interpretar la respuesta de Google Sheets.'));
        }
      });
    }).on('error', () => reject(new Error('No se pudo conectar con Google Sheets.')));
  });
}

module.exports = async function handler(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const sheet = requestUrl.searchParams.get('sheet');
  const slug = requestUrl.searchParams.get('club');
  try {
    const clubs = await readConfiguredClubsAsync();
    const club = clubs.find(item => item.slug === slug);
    const physical = requestUrl.pathname === '/api/sheets/physical';
    const isDtSync = requestUrl.pathname === '/api/sheets/dt-sync';
    if (!club) return json(res, 404, { error: 'Club no encontrado.' });
    if (isDtSync) {
      if (!club.dtSpreadsheetUrl) return json(res, 400, { error: 'Este club no tiene configurada la URL de Apps Script del DT.' });
      let bodyData = '';
      if (req.body && typeof req.body === 'object') bodyData = JSON.stringify(req.body);
      else if (req.body) bodyData = String(req.body);
      else {
        bodyData = await new Promise(resolve => {
          let b = '';
          req.on('data', chunk => b += chunk);
          req.on('end', () => resolve(b));
          req.on('error', () => resolve(''));
        });
      }
      return new Promise(resolve => {
        const scriptUrl = new URL(club.dtSpreadsheetUrl);
        const postReq = https.request(scriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            'Content-Length': Buffer.byteLength(bodyData)
          }
        }, postRes => {
          let resData = '';
          postRes.on('data', chunk => resData += chunk);
          postRes.on('end', () => {
            json(res, 200, { ok: true, status: postRes.statusCode });
            resolve();
          });
        });
        postReq.on('error', err => {
          json(res, 502, { error: 'Error conectando con Google Apps Script: ' + err.message });
          resolve();
        });
        postReq.write(bodyData);
        postReq.end();
      });
    }
    if (physical) {
      if (!club.physicalSpreadsheetId) return json(res, 404, { error: 'Este club no tiene planilla de evaluaciones físicas.' });
      return json(res, 200, { table: await fetchSheet(club.physicalSpreadsheetId, null) });
    }
    if (!['primera', 'intermedia'].includes(sheet)) {
      return json(res, 400, { error: 'La hoja debe ser primera o intermedia.' });
    }
    if (!club.spreadsheetId) return json(res, 404, { error: 'El club no tiene planilla de citaciones.' });
    return json(res, 200, { table: await fetchSheet(club.spreadsheetId, sheet) });
  } catch (error) {
    return json(res, 502, { error: error.message });
  }
};
