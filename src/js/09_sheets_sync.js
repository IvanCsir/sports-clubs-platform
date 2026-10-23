// SINCRONIZACIÓN EN TIEMPO REAL CON GOOGLE SHEETS (CITACIONES)
// ============================================================================

let CITACION_LAST_SYNC_KEY = 'psb_citacion_last_sync_ts';

function formatCitacionSyncTime(timestamp) {
  if (!timestamp) return 'Sin sincronizar aún';
  const ts = Number(timestamp);
  if (isNaN(ts) || ts <= 0) return 'Sin sincronizar aún';
  const date = new Date(ts);
  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `Hoy ${timeStr} hs`;
  } else if (isYesterday) {
    return `Ayer ${timeStr} hs`;
  } else {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month} ${timeStr} hs`;
  }
}

function updateCitacionSyncBadge(state = 'success', customText = null) {
  const dot = document.getElementById('citacionSyncDot');
  const textEl = document.getElementById('citacionSyncText');

  if (!dot || !textEl) return;

  dot.classList.remove('syncing', 'offline');

  if (state === 'syncing') {
    dot.classList.add('syncing');
    textEl.textContent = customText || 'Actualizando...';
    return;
  }

  let savedTs = null;
  try {
    savedTs = localStorage.getItem(CITACION_LAST_SYNC_KEY);
  } catch (e) {}

  if (state === 'success') {
    const timeFormatted = formatCitacionSyncTime(savedTs || Date.now());
    textEl.textContent = customText || `Actualizado ${timeFormatted}`;
  } else if (state === 'offline' || state === 'error') {
    dot.classList.add('offline');
    if (savedTs) {
      const timeFormatted = formatCitacionSyncTime(savedTs);
      textEl.textContent = customText || `Sin conexión • Guardado ${timeFormatted}`;
    } else {
      textEl.textContent = customText || 'Sin conexión';
    }
  }
}

function setupCitacionSyncUI() {
  updateCitacionSyncBadge('success');
}

async function syncWithGoogleSheets(manual = false) {
  const sheetId = (matchData && matchData.spreadsheetId) || SPREADSHEET_ID;
  updateCitacionSyncBadge('syncing');

  try {
    const fetchTab = async (tabName) => {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&range=A:L&sheet=${encodeURIComponent(tabName)}&_t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const match = text.match(/setResponse\(([\s\S]+)\);/);
      if (!match) throw new Error('Formato inválido de Google Sheets');
      const json = JSON.parse(match[1]);
      return json.table;
    };

    const parseTab = (table) => {
      const players = [];
      const meta = {};
      if (!table || !table.rows) return { players, meta };

      table.rows.forEach(r => {
        if (!r.c) return;

        // Col F (índice 5): Jugadoras Citadas
        if (r.c[5] && r.c[5].v) {
          const pName = r.c[5].v.toString().trim();
          if (pName && pName.toLowerCase() !== 'jugadoras citadas') {
            players.push(pName);
          }
        }

        // Col H (índice 7): Etiqueta, Col I (índice 8): Valor
        if (r.c[7] && r.c[7].v) {
          const label = r.c[7].v.toString().trim().toLowerCase();
          const cellI = r.c[8];
          const val = cellI ? (cellI.f || cellI.v || '').toString().trim() : '';
          if (val) {
            meta[label] = val;
          }
        }
      });
      return { players, meta };
    };

    const [tablePrimera, tableInter] = await Promise.all([
      fetchTab('primera'),
      fetchTab('intermedia')
    ]);

    const resPrimera = parseTab(tablePrimera);
    const resInter = parseTab(tableInter);

    let changed = false;

    // 1. Actualizar Lista de Jugadoras Citadas
    if (resPrimera.players && resPrimera.players.length > 0) {
      matchData.primera.players = resPrimera.players;
      changed = true;
    }

    if (resInter.players && resInter.players.length > 0) {
      matchData.intermedia.players = resInter.players;
      changed = true;
    }

    // 2. Extraer Metadatos (Columna H e I)
    const metaP = resPrimera.meta || {};
    const metaI = resInter.meta || {};

    // FECHA N° (ej: "10" o "Fecha 10")
    const roundRaw = (
      metaP['fecha n°'] ||
      metaI['fecha n°'] ||
      metaP['fecha n'] ||
      metaI['fecha n'] ||
      metaP['n° fecha'] ||
      metaI['n° fecha'] ||
      metaP['fecha'] ||
      metaI['fecha'] ||
      ''
    ).toString().trim();

    if (roundRaw) {
      const cleanNum = roundRaw.replace(/^fecha\s*/i, '').trim();
      const formattedRound = `FECHA ${cleanNum || roundRaw}`;
      if (matchData.fixtureRound !== formattedRound) {
        matchData.fixtureRound = formattedRound;
        changed = true;
      }
    }

    // RIVAL (ej: "Murialdo B")
    const rivalVal = (metaP['rival'] || metaI['rival'] || '').toString().trim();
    if (rivalVal && rivalVal !== matchData.rival) {
      matchData.rival = rivalVal;
      changed = true;
    }

    // URL ESCUDO RIVAL
    const rivalLogoUrl = (
      metaP['url escudo rival'] ||
      metaI['url escudo rival'] ||
      metaP['escudo rival'] ||
      metaI['escudo rival'] ||
      metaP['url escudo'] ||
      metaI['url escudo'] ||
      metaP['escudo'] ||
      metaI['escudo'] ||
      ''
    ).toString().trim();

    if (rivalLogoUrl) {
      if (matchData.rivalLogo !== rivalLogoUrl) {
        matchData.rivalLogo = rivalLogoUrl;
        changed = true;
      }
    } else {
      if (matchData.rivalLogo && matchData.rivalLogo.startsWith('http')) {
        matchData.rivalLogo = '';
        changed = true;
      }
    }

    // DÍA
    const dateVal = (metaP['dia'] || metaI['dia'] || metaP['día'] || metaI['día'] || '').toString().trim();
    if (dateVal && dateVal !== matchData.dateDisplay) {
      matchData.dateDisplay = dateVal;
      changed = true;
    }

    // CANCHA
    const locVal = (metaP['cancha'] || metaI['cancha'] || '').toString().trim();
    if (locVal && locVal !== matchData.location) {
      matchData.location = locVal;
      changed = true;
    }

    // HORARIOS PRIMERA
    const callP = metaP['horario citacion'] || metaP['horario citación'] || metaP['citacion'] || metaP['citación'];
    if (callP && callP !== matchData.primera.callTime) {
      matchData.primera.callTime = callP;
      changed = true;
    }

    const matchP = metaP['horario partido'] || metaP['partido'];
    if (matchP && matchP !== matchData.primera.matchTime) {
      matchData.primera.matchTime = matchP;
      changed = true;
    }

    // HORARIOS INTERMEDIA
    const callI = metaI['horario citacion'] || metaI['horario citación'] || metaI['citacion'] || metaI['citación'];
    if (callI && callI !== matchData.intermedia.callTime) {
      matchData.intermedia.callTime = callI;
      changed = true;
    }

    const matchI = metaI['horario partido'] || metaI['partido'];
    if (matchI && matchI !== matchData.intermedia.matchTime) {
      matchData.intermedia.matchTime = matchI;
      changed = true;
    }

    if (changed) {
      saveData();
      render();
    }

    try {
      localStorage.setItem(CITACION_LAST_SYNC_KEY, Date.now().toString());
    } catch (e) {}

    updateCitacionSyncBadge('success');

    if (manual) {
      showToast('✅ ¡Citación sincronizada con Google Sheets!');
    }
  } catch (err) {
    console.warn('Error sincronizando con Google Sheets:', err);
    updateCitacionSyncBadge('offline');
    if (manual) {
      showToast('⚠️ No se pudo conectar con Google Sheets (sin señal)');
    }
  }
}

// ============================================================================
