/**
 * Servicio de Automatización de Precarga de Equipos en Sistema AMH (Oracle APEX)
 * Club Regatas Andino - Hockey Femenino (Plantel Superior B)
 *
 * REGLAS CRÍTICAS:
 * 1. NUNCA hacer click en "Cierra Precarga Equipos" (#CIERRA_ID).
 * 2. Únicamente tildar las jugadoras citadas y hacer click en "Inscribe Tildados" (#INSCRIBE_ID).
 * 3. Las credenciales se leen exclusivamente desde variables de entorno (.env en local o Environment Variables en Vercel).
 */

const fs = require('fs');
const http = require('http');

const AMH_BASE_URL = process.env.AMH_BASE_URL || (process.env.AMH_URL ? new URL(process.env.AMH_URL).origin : 'http://15.235.75.172:8080');

// Detección de binario de navegador (Chrome o Edge en Windows / Linux / Mac)
function findBrowserExecutable() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }

  return null;
}

// Obtener instancia de navegador compatible con Windows local y Vercel Serverless
async function getBrowserInstance() {
  const puppeteerModule = await import('puppeteer-core');
  const puppeteer = puppeteerModule.default || puppeteerModule;

  const localExe = findBrowserExecutable();
  if (localExe) {
    return await puppeteer.launch({
      executablePath: localExe,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  // Si estamos en Vercel o en un entorno Linux Serverless
  try {
    const chromiumModule = await import('@sparticuz/chromium-min');
    const chromium = chromiumModule.default || chromiumModule;

    // Desactivar stack gráfico para optimizar velocidad y memoria en serverless
    if (chromium.setGraphicsMode) {
      chromium.setGraphicsMode = false;
    }

    let execPath;
    try {
      execPath = await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar');
    } catch (e1) {
      console.warn('[AMH] Error al obtener chromium bin remoto, intentando fallback sin URL:', e1.message);
      execPath = await chromium.executablePath();
    }

    return await puppeteer.launch({
      executablePath: execPath,
      args: chromium.args,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport
    });
  } catch (err) {
    throw new Error('No se encontró un navegador ejecutable en el sistema ni en la nube: ' + err.message);
  }
}

// Normalización de cadenas y cálculo de similitud para nombres
function normalizeStr(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

// Diccionario de equivalencias para apodos o nombres registrados distintos en la federación
const KNOWN_ALIASES = {
  'moyano lara': 'tonelli lara',
  'oviedo lua': 'oviedo romero bianca morena',
  'baldillou celia': 'baldillon celia belen',
  'chacon aldana': 'delgado chacon aldana rocio',
  'dinocencio priscila': 'd?nocencio priscila'
};

function matchPlayer(citedName, amhPlayers) {
  let normCited = normalizeStr(citedName);

  // Si existe un alias conocido, usar su nombre oficial en la federación
  if (KNOWN_ALIASES[normCited]) {
    normCited = normalizeStr(KNOWN_ALIASES[normCited]);
  }

  const citedTokens = normCited.split(' ').filter(t => t.length >= 2);
  if (citedTokens.length === 0) return null;

  const citedSurname = citedTokens[0];

  let bestMatch = null;
  let bestScore = -1;

  for (const amh of amhPlayers) {
    const normAmh = normalizeStr(amh.name);
    const amhTokens = normAmh.split(' ').filter(t => t.length >= 2);
    if (amhTokens.length === 0) continue;

    const amhSurname = amhTokens[0];

    let matchedTokens = 0;
    for (const cToken of citedTokens) {
      if (amhTokens.some(aToken => 
        aToken === cToken ||
        (cToken.length >= 4 && aToken.includes(cToken)) ||
        (aToken.length >= 4 && cToken.includes(aToken)) ||
        (cToken.length >= 4 && levenshtein(cToken, aToken) <= 1)
      )) {
        matchedTokens++;
      }
    }

    const tokenScore = matchedTokens / citedTokens.length;

    // Coincidencia por apellido principal
    const surnameMatch = (amhSurname === citedSurname || (citedSurname.length >= 4 && amhSurname.includes(citedSurname)) || (citedSurname.length >= 5 && levenshtein(amhSurname, citedSurname) <= 1));

    let levBonus = 0;
    if (tokenScore >= 0.5 || surnameMatch) {
      const dist = levenshtein(normCited, normAmh);
      levBonus = 1 - (dist / Math.max(normCited.length, normAmh.length));
    }

    let totalScore = (tokenScore * 0.7) + (levBonus * 0.3);

    // Si coincide el apellido principal, asegurar buen puntaje
    if (surnameMatch) {
      totalScore = Math.max(totalScore, 0.75 + (tokenScore * 0.25));
    }

    if (totalScore >= 0.65 && totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = { amh, score: totalScore, tokenScore };
    }
  }

  return bestMatch;
}

/**
 * Consulta los partidos de la división mediante HTTP directo (Ultra rápido, 200ms, no requiere navegador)
 * Filtra únicamente los partidos activos/pendientes, con formato idéntico al sistema AMH.
 */
function fetchMatchesHttp(division = '1', club = null) {
  return new Promise((resolve) => {
    const divId = (division === '2' || division === 'intermedia') ? '2' : '1';
    const isIntermedia = divId === '2';
    const tournament = (club && club.tournament) || {};
    const tournamentId = tournament.tournamentId || '97';
    const clubId = tournament.clubId || '3';
    const baseUrl = tournament.baseUrl || AMH_BASE_URL;
    const url = `${baseUrl}/ords/f?p=1107:6:0:FLOW_EXCEL_OUTPUT:::P6_TORNEOS_P,P6_CLUB_P,P6_JUG_COD_DIVISION_P:${encodeURIComponent(tournamentId)},${encodeURIComponent(clubId)},${divId}`;
    const client = url.startsWith('https:') ? require('https') : http;

    client.get(url, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        try {
          const tableMatch = html.match(/<table[^>]+id="report_table_R195581212816937222"[^>]*>([\s\S]*?)<\/table>/i);
          if (!tableMatch) return resolve([]);

          const rows = [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
          const matches = [];

          // Horarios específicos programados en AMH
          const MATCH_TIMES = {
            '9959': '16:45',
            '9967': '11:30',
            '9974': '16:45',
            '9984': '16:45',
            '10079': '15:15',
            '10087': '10:00',
            '10094': '15:15',
            '10104': '15:15'
          };

          rows.forEach(r => {
            const cells = {};
            const tdMatches = [...r[1].matchAll(/<td[^>]+headers="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi)];
            tdMatches.forEach(td => {
              const h = td[1].trim();
              const val = td[2].replace(/<[^>]+>/g, '').replace(/&#x2F;/g, '/').replace(/&amp;/g, '&').trim();
              cells[h] = val;
              if (h === 'ESTADO_PARTIDO') cells['ESTADO_HTML'] = td[2];
            });

            if (!cells['FECHA_NRO'] || !cells['PARTIDO_NRO']) return;

            // Filtrar SOLO los partidos pendientes (no jugados), tal como hace el sistema AMH
            const estadoHtml = cells['ESTADO_HTML'] || '';
            const hasTimesCircle = estadoHtml.includes('fa-times-circle') || estadoHtml.includes('#E50D0D') || estadoHtml.includes('times');
            const hasCheckCircle = estadoHtml.includes('fa-check-circle') || estadoHtml.includes('#0E7A16');
            const isPlayed = hasCheckCircle && !hasTimesCircle;

            // Si el partido ya fue jugado, NO está disponible para precarga en AMH
            if (isPlayed) return;

            const nroRaw = cells['PARTIDO_NRO'];
            const nroClean = nroRaw.split('/')[0].replace(/^0+/, '');
            const local = cells['EQUIPO_LOCAL'] || '';
            const visita = cells['EQUIPO_VISITANTE'] || '';
            const defaultHora = isIntermedia ? '15:15' : '16:45';
            const hora = MATCH_TIMES[nroClean] || cells['HORA_PARTIDO'] || defaultHora;
            const nroPad = nroClean.padStart(6, '0');

            matches.push({
              id: nroClean,
              text: `${nroPad} - ${hora} - ${local} vs ${visita}`
            });
          });

          resolve(matches);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => {
      resolve([]);
    });
  });
}

/**
 * Obtiene los partidos disponibles para una división en la AMH
 */
async function fetchAvailableMatches(division = '1', club = null) {
  // 1. Intento por HTTP directo (funciona en Vercel, móvil y local sin requerir navegador)
  try {
    const httpMatches = await fetchMatchesHttp(division, club);
    if (httpMatches && httpMatches.length > 0) {
      return httpMatches;
    }
  } catch (e) {
    console.warn('[AMH] Error en fetchMatchesHttp, intentando navegador:', e.message);
  }

  // 2. Fallback mediante navegador si estuviera disponible
  const username = process.env.AMH_USER;
  const password = process.env.AMH_PASSWORD;
  const baseUrl = process.env.AMH_URL || `${AMH_BASE_URL}/ords/r/amh/clubes/login_desktop`;

  if (!username || !password) {
    return [];
  }

  let browser;
  try {
    browser = await getBrowserInstance();
  } catch (e) {
    return [];
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Login
    await page.goto(baseUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#P100_USERNAME', { timeout: 15000 });
    await page.type('#P100_USERNAME', username);
    await page.type('#P100_PASSWORD', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('#B1801326792432970076')
    ]);

    const sessionMatch = page.url().match(/session=([0-9]+)/);
    const session = sessionMatch ? sessionMatch[1] : '';
    if (!session) throw new Error('No se pudo obtener la sesión tras el login en AMH');

    // 2. Navegar a Precarga de Equipos (Página 13)
    await page.goto(`${AMH_BASE_URL}/ords/r/amh/clubes/13?session=${session}`, { waitUntil: 'networkidle2' });

    // 3. Seleccionar Torneo
    const torneoVal = await page.evaluate(() => {
      const s = document.querySelector('#P13_TOR_ID');
      const opt = Array.from(s.options).find(o => o.text.toUpperCase().includes('DAMAS B'));
      return opt ? opt.value : '97';
    });
    await page.select('#P13_TOR_ID', torneoVal);
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // 4. Seleccionar División (1 = Primera, 2 = Segunda/Intermedia)
    const divCode = (division === '2' || division === 'intermedia') ? '2' : '1';
    await page.select('#P13_TORI_COD_DIVISION', divCode);
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // 5. Extraer opciones de Partidos
    const partidos = await page.evaluate(() => {
      const s = document.querySelector('#P13_TORP_PARTIDO_NRO');
      return Array.from(s.options)
        .filter(o => o.value)
        .map(o => ({ id: o.value, text: o.text.trim() }));
    });

    return partidos;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Ejecuta la precarga e inscripción de jugadoras tildadas
 * @param {Object} params
 * @param {string} params.division '1' (Primera) o '2' (Intermedia)
 * @param {string} [params.partidoId] ID del partido en AMH (opcional si se provee rival)
 * @param {string} [params.rival] Nombre del rival para autodetectar partido
 * @param {Array<string>} params.players Lista de jugadoras citadas
 * @param {Function} [params.onProgress] Callback para reportar avance en tiempo real
 */
async function executeAmhPrecarga(params = {}) {
  const {
    division = '1',
    partidoId = null,
    rival = null,
    players = [],
    onProgress = () => {}
  } = params;

  if (!players || players.length === 0) {
    throw new Error('No se enviaron jugadoras citadas para precargar.');
  }

  const username = process.env.AMH_USER;
  const password = process.env.AMH_PASSWORD;
  const baseUrl = process.env.AMH_URL || `${AMH_BASE_URL}/ords/r/amh/clubes/login_desktop`;

  if (!username || !password) {
    throw new Error('Credenciales AMH no configuradas. Verificá las variables de entorno AMH_USER y AMH_PASSWORD en Vercel.');
  }

  onProgress({ step: 1, message: 'Iniciando navegador automatizado...' });

  const browser = await getBrowserInstance();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // PASO 1: Login
    onProgress({ step: 2, message: 'Conectando con el servidor oficial de la AMH...' });
    await page.goto(baseUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#P100_USERNAME', { timeout: 15000 });
    await page.type('#P100_USERNAME', username);
    await page.type('#P100_PASSWORD', password);

    onProgress({ step: 3, message: 'Autenticando usuario del club...' });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('#B1801326792432970076')
    ]);

    const sessionMatch = page.url().match(/session=([0-9]+)/);
    const session = sessionMatch ? sessionMatch[1] : '';
    if (!session) {
      throw new Error('Error de autenticación en AMH. Verificá que el usuario y la contraseña sean correctos.');
    }

    // PASO 2: Navegación a Precarga de Equipos (Página 13)
    onProgress({ step: 4, message: 'Navegando a Administración de Plantel > Precarga de Equipos...' });
    await page.goto(`${AMH_BASE_URL}/ords/r/amh/clubes/13?session=${session}`, { waitUntil: 'networkidle2' });

    // PASO 3: Selección de Torneo (Clausura Damas B)
    onProgress({ step: 5, message: 'Seleccionando Torneo Clausura Damas B...' });
    const torneoVal = await page.evaluate(() => {
      const s = document.querySelector('#P13_TOR_ID');
      const opt = Array.from(s.options).find(o => o.text.toUpperCase().includes('DAMAS B'));
      return opt ? opt.value : '97';
    });
    await page.select('#P13_TOR_ID', torneoVal);
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // PASO 4: Selección de División (1 = Primera, 2 = Segunda/Intermedia)
    const divCode = (division === '2' || division === 'intermedia') ? '2' : '1';
    const divNombre = divCode === '2' ? 'Segunda (Intermedia)' : 'Primera';
    onProgress({ step: 6, message: `Seleccionando División: ${divNombre}...` });
    await page.select('#P13_TORI_COD_DIVISION', divCode);
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // PASO 5: Selección de Partido
    onProgress({ step: 7, message: 'Buscando el partido correspondiente...' });
    const matchOptions = await page.evaluate(() => {
      const s = document.querySelector('#P13_TORP_PARTIDO_NRO');
      return Array.from(s.options).filter(o => o.value).map(o => ({ id: o.value, text: o.text.trim() }));
    });

    if (matchOptions.length === 0) {
      throw new Error('No hay partidos programados en la lista de la AMH para esta división.');
    }

    let selectedPartido = null;
    if (partidoId) {
      selectedPartido = matchOptions.find(m => m.id === String(partidoId));
    }
    if (!selectedPartido && rival) {
      const normRival = normalizeStr(rival);
      selectedPartido = matchOptions.find(m => normalizeStr(m.text).includes(normRival));
    }
    if (!selectedPartido) {
      selectedPartido = matchOptions[0];
    }

    onProgress({ step: 8, message: `Seleccionado partido: ${selectedPartido.text}...` });
    await page.select('#P13_TORP_PARTIDO_NRO', selectedPartido.id);
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // PASO 6: Selección de Bloque (Bloque B)
    onProgress({ step: 9, message: 'Seleccionando Bloque B...' });
    const bloqueVal = await page.evaluate(() => {
      const s = document.querySelector('#P13_TORI_COD_CATEGORIA');
      const opt = Array.from(s.options).find(o => o.text.trim().toUpperCase() === 'B' || o.text.toUpperCase().includes('BLOQUE B'));
      return opt ? opt.value : '2';
    });
    await page.select('#P13_TORI_COD_CATEGORIA', bloqueVal);
    await page.waitForNetworkIdle({ idleTime: 800 }).catch(() => {});
    await new Promise(r => setTimeout(r, 600));

    // PASO 7: Acceder a la Precarga (Página 37)
    onProgress({ step: 10, message: 'Ingresando a la lista de jugadoras para el partido...' });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('#B145050039189584162')
    ]);

    // PASO 8: Leer tabla de Jugadores No Inscriptos
    onProgress({ step: 11, message: 'Analizando padrón de jugadoras de Regatas Andino...' });
    const amhPlayers = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#report_table_R1831655343735757573 tbody tr'));
      return rows.map(r => {
        const cb = r.querySelector('input[type="checkbox"][name="f01"]');
        const cells = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
        if (!cb || cells.length < 3) return null;
        return {
          dni: cb.value,
          name: cells[2] || '',
          division: cells[3] || '',
          bloque: cells[4] || '',
          checked: cb.checked
        };
      }).filter(Boolean);
    });

    onProgress({ step: 12, message: `Se encontraron ${amhPlayers.length} jugadoras disponibles en el sistema.` });

    // PASO 9: Matchear y Tildar Jugadoras
    const matchesFound = [];
    const unmatchedCited = [];
    const dnisToInscribe = [];

    for (const cited of players) {
      const match = matchPlayer(cited, amhPlayers);
      if (match && match.score >= 0.65) {
        matchesFound.push({
          cited,
          amhName: match.amh.name,
          dni: match.amh.dni,
          score: Math.round(match.score * 100)
        });
        dnisToInscribe.push(match.amh.dni);
      } else {
        unmatchedCited.push(cited);
      }
    }

    onProgress({ 
      step: 13, 
      message: `Tildando ${dnisToInscribe.length} de ${players.length} citadas coincidentes...` 
    });

    // Tildar cada casilla en el navegador
    await page.evaluate((dnis) => {
      dnis.forEach(dni => {
        const cb = document.querySelector(`input[name="f01"][value="${dni}"]`);
        if (cb && !cb.checked) {
          cb.click();
        }
      });
    }, dnisToInscribe);

    // PASO 10: INSCRIBIR TILDADOS (Únicamente #INSCRIBE_ID - NUNCA #CIERRA_ID)
    onProgress({ step: 14, message: 'Guardando inscripción: Presionando "Inscribe Tildados"...' });

    const buttonSecurityCheck = await page.evaluate(() => {
      const inscribeBtn = document.querySelector('#INSCRIBE_ID');
      return {
        exists: !!inscribeBtn,
        text: inscribeBtn ? inscribeBtn.innerText.trim() : null
      };
    });

    if (!buttonSecurityCheck.exists) {
      throw new Error('No se encontró el botón seguro #INSCRIBE_ID ("Inscribe Tildados") en la página.');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('#INSCRIBE_ID')
    ]);

    await page.waitForNetworkIdle({ idleTime: 1000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    onProgress({ 
      step: 15, 
      message: '✅ ¡Precarga realizada con éxito! Las jugadoras quedaron inscriptas en el sistema oficial.' 
    });

    return {
      success: true,
      division: divNombre,
      partido: selectedPartido.text,
      totalCited: players.length,
      inscribedCount: matchesFound.length,
      matches: matchesFound,
      unmatched: unmatchedCited,
      precargaCerrada: false, // Garantizado por contrato
      timestamp: new Date().toISOString()
    };

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  fetchAvailableMatches,
  fetchMatchesHttp,
  executeAmhPrecarga,
  matchPlayer
};
