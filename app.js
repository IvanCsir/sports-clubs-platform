/**
 * Web Citaciones y Evaluaciones Físicas - Club Regatas Andino
 * Compilado automáticamente desde /src/js/
 * Última actualización: 2026-10-22T21:11:55.592Z
 */

// ============================================================================
// MÓDULO: 00_tenant.js
// ============================================================================

const DEFAULT_TENANT_CONFIG = {
  slug: 'regatas-andino',
  name: 'CLUB REGATAS ANDINO',
  shortName: 'REGATAS ANDINO',
  sport: 'Hockey',
  teamName: 'PLANTEL SUPERIOR B',
  logoUrl: 'escudo-regatas-andino.png',
  theme: { primary: '#1e88e5', accent: '#00a2ff', danger: '#d32f2f' },
  spreadsheetId: '',
  physicalSpreadsheetId: '',
  dtSpreadsheetId: '',
  dtSpreadsheetUrl: '',
  tournament: {}
};

let tenantConfig = { ...DEFAULT_TENANT_CONFIG };
const requestedTenantSlug = new URLSearchParams(window.location.search).get('club');
const tenantSlug = requestedTenantSlug || DEFAULT_TENANT_CONFIG.slug;

function tenantStorageKey(key) {
  return `${tenantSlug}:${key}`;
}

function getTenantConfig() {
  return tenantConfig;
}

function applyTenantConfig(config) {
  tenantConfig = {
    ...DEFAULT_TENANT_CONFIG,
    ...config,
    theme: { ...DEFAULT_TENANT_CONFIG.theme, ...(config.theme || {}) }
  };

  document.documentElement.style.setProperty('--color-regatas-blue', tenantConfig.theme.primary);
  document.documentElement.style.setProperty('--color-regatas-cyan', tenantConfig.theme.accent);
  document.documentElement.style.setProperty('--color-regatas-red', tenantConfig.theme.danger);
  document.title = `${tenantConfig.shortName} ${tenantConfig.sport} | ${tenantConfig.teamName}`;

  document.querySelectorAll('[data-tenant-name]').forEach(el => {
    el.textContent = tenantConfig.shortName;
  });
  document.querySelectorAll('[data-tenant-team]').forEach(el => {
    el.textContent = tenantConfig.teamName;
  });
  document.querySelectorAll('[data-tenant-logo]').forEach(el => {
    el.src = tenantConfig.logoUrl;
    el.alt = tenantConfig.shortName;
  });
}

async function loadTenantConfig() {
  try {
    const response = await fetch(`/api/config?club=${encodeURIComponent(tenantSlug)}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!requestedTenantSlug) {
      renderClubPicker(payload.clubs || []);
      return false;
    }
    applyTenantConfig(payload.club || DEFAULT_TENANT_CONFIG);
    return true;
  } catch (error) {
    console.warn('[Tenant] No se pudo cargar la configuración remota; se usan valores locales.', error);
    if (!requestedTenantSlug) {
      renderClubPicker([DEFAULT_TENANT_CONFIG]);
      return false;
    }
    applyTenantConfig(DEFAULT_TENANT_CONFIG);
    return true;
  }
}

function renderClubPicker(clubs) {
  const picker = document.getElementById('clubPicker');
  const list = document.getElementById('clubPickerList');
  if (!picker || !list) return;

  list.innerHTML = '';
  clubs.forEach(club => {
    const card = document.createElement('div');
    card.className = 'club-picker-card';
    const link = document.createElement('a');
    link.href = `/?club=${encodeURIComponent(club.slug)}`;
    link.innerHTML = `
      <img src="${club.logoUrl || DEFAULT_TENANT_CONFIG.logoUrl}" alt="">
      <span>
        <strong>${escapeHtml(club.shortName || club.name)}</strong>
        <small>${escapeHtml(club.sport || 'Club deportivo')} · ${escapeHtml(club.teamName || '')}</small>
      </span>
      <b aria-hidden="true">→</b>
    `;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'club-picker-edit';
    edit.textContent = 'Editar perfil';
    edit.onclick = () => openClubProfile(club);
    card.append(link, edit);
    list.appendChild(card);
  });

  picker.hidden = false;
  document.body.classList.add('club-picker-active');
  setupClubAdmin();
}

function setupClubAdmin() {
  const modal = document.getElementById('clubAdminModal');
  const open = document.getElementById('btnAddClub');
  const close = document.getElementById('btnCloseClubAdmin');
  const login = document.getElementById('btnClubAdminLogin');
  const form = document.getElementById('clubAdminForm');
  const fields = document.getElementById('clubAdminFields');
  const message = document.getElementById('clubAdminMessage');
  if (!modal || !open || !login || !form) return;

  open.onclick = () => openClubProfile(null);
  close.onclick = () => { modal.hidden = true; };
  login.onclick = async () => {
    try {
      const editingSlug = form.dataset.editingSlug || '';
      const response = await fetch('/api/admin/clubs', {
        method: editingSlug ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: document.getElementById('clubAdminPassword').value })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo iniciar sesión.');
      sessionStorage.setItem('club_admin_token', payload.token);
      document.getElementById('clubAdminLogin').hidden = true;
      fields.hidden = false;
      const pendingSlug = form.dataset.pendingProfile;
      if (pendingSlug) {
        const catalog = await (await fetch('/api/config', { cache: 'no-store' })).json();
        const pendingClub = (catalog.clubs || []).find(club => club.slug === pendingSlug);
        if (pendingClub) openClubProfile(pendingClub);
      } else {
        fields.hidden = false;
        document.getElementById('staffPasswordField').hidden = false;
        document.getElementById('staffSecretField').hidden = false;
      }
    } catch (error) {
      message.textContent = error.message;
    }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const editingSlug = form.dataset.editingSlug || '';
      const response = await fetch('/api/admin/clubs', {
        method: editingSlug ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('club_admin_token')}`
        },
        body: JSON.stringify(editingSlug
          ? { slug: editingSlug, club: { ...data, auth: { password: data.staffPassword, secret: data.staffSecret } } }
          : { club: { ...data, auth: { password: data.staffPassword, secret: data.staffSecret } } })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar el club.');
      message.textContent = editingSlug ? 'Perfil actualizado. Recargando...' : 'Club creado. Actualizando...';
      setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      message.textContent = error.message;
    }
  };
}

function openClubProfile(club) {
  const modal = document.getElementById('clubAdminModal');
  const form = document.getElementById('clubAdminForm');
  const loginFields = document.getElementById('clubAdminLogin');
  const fields = document.getElementById('clubAdminFields');
  const title = document.getElementById('clubAdminTitle');
  const submit = document.getElementById('clubAdminSubmit');
  if (!modal || !form) return;

  modal.hidden = false;
  const editing = Boolean(club);
  document.getElementById('staffPasswordField').hidden = editing;
  document.getElementById('staffSecretField').hidden = editing;
  form.elements.staffPassword.disabled = editing;
  form.elements.staffSecret.disabled = editing;
  if (!sessionStorage.getItem('club_admin_token')) {
    form.dataset.pendingProfile = club ? club.slug : '';
    loginFields.hidden = false;
    fields.hidden = true;
    return;
  }
  loginFields.hidden = true;
  fields.hidden = false;
  form.dataset.editingSlug = club ? club.slug : '';
  title.textContent = club ? 'Perfil del club' : 'Agregar club';
  submit.textContent = club ? 'Guardar cambios' : 'Guardar club';
  form.reset();
  form.elements.slug.readOnly = Boolean(club);
  form.classList.toggle('is-editing', editing);
  document.getElementById('staffPasswordField').hidden = editing;
  document.getElementById('staffSecretField').hidden = editing;
  if (club) {
    ['slug', 'name', 'shortName', 'sport', 'teamName', 'logoUrl', 'spreadsheetId',
      'physicalSpreadsheetId', 'dtSpreadsheetId', 'dtSpreadsheetUrl'].forEach(name => {
      if (form.elements[name]) form.elements[name].value = club[name] || '';
    });
  }
}

window.__tenantReady = loadTenantConfig();

// ============================================================================
// MÓDULO: 01_config.js
// ============================================================================

/**
 * Web Citaciones y Evaluaciones Físicas - Club Regatas Andino
 * Manejo de Citaciones (Primera e Intermedia) y Rendimiento Físico
 * Sincronización en Vivo con Google Sheets (Citaciones y Físico)
 */

// ============================================================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================================================

let matchData = null;
let currentCategory = 'primera'; // 'primera' | 'intermedia'

// Torneo AMH (Clausura Damas B 2026)
let TOURNAMENT_STORAGE_KEY = 'regatas_andino_torneo_v4';
let tournamentData = null;
let currentTournamentDivision = 'primera'; // 'primera' | 'intermedia'
let currentMatchesTab = 'played'; // 'played' | 'pending'

// Evaluaciones Físicas
let PHYSICAL_SPREADSHEET_ID = "1dAoeA0_F4RGLDEJj0taIJiPA3WlMWl5e";
let PHYSICAL_STORAGE_KEY = "regatas_andino_fisico_v1";
let physicalPlayers = [];
let physicalCategoryAverages = null;
let selectedPlayerId = null;
let currentPhysFilter = "all"; // 'all' | '1ra' | 'Inter' | '5ta'
let currentPhysBenchmarkScope = "category"; // 'category' | 'all'
let currentPhysViewMode = "players"; // 'players' | 'averages' | 'top10'
let currentTop10Test = "all"; // 'all' | 'broadJump' | 'cmj' | 'agility' | 'sprint' | 'yoyo' | 'bench' | 'deadlift' | 'squat' | 'platform'
let currentTop10Round = "latest"; // 'latest' | 'best' | 'avg' | '1' | '2' | '3'

let STORAGE_KEY = 'regatas_andino_citaciones_v6';

// Sesión y Seguridad de Cuerpo Técnico (Expiración de 12hs validada por /api/auth)
let CT_AUTH_STORAGE_KEY = 'regatas_ct_session_v4';
let DT_SPREADSHEET_ID = '1EfZtExHcLrio49A3wmyZcUOCZYZ7jNnatFt-wsebPQg';
let DT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1EfZtExHcLrio49A3wmyZcUOCZYZ7jNnatFt-wsebPQg/edit';

// ============================================================================
// MÓDULO: 02_crypto.js
// ============================================================================

// ============================================================================
// FUNCIONES CRIPTOGRÁFICAS & SESIÓN UNIFICADA CUERPO TÉCNICO
// ============================================================================

async function sha256Hex(text) {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return fallbackSha256(text);
}

function fallbackSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = [];
  var k = [];
  var primeCounter = 0;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      var temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      var temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (var i2 = 3; i2 >= 0; i2--) {
      var b = (hash[i] >>> (i2 * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// ============================================================================
// MÓDULO: 03_auth.js
// ============================================================================

function getCtSession() {
  try {
    const raw = localStorage.getItem(CT_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.expiresAt && Date.now() <= Number(session.expiresAt)) {
      return session;
    }
    // Si venció, limpiar
    localStorage.removeItem(CT_AUTH_STORAGE_KEY);
  } catch (e) {}
  return null;
}

async function verifyCtPassword(input) {
  const clean = (input || '').trim();
  if (!clean) return false;

  // 1. Validar contra el Backend Serverless (/api/auth)
  try {
    const res = await fetch(`/api/auth?club=${encodeURIComponent(tenantSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: clean })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.token && data.expiresAt) {
        setCtAuthenticated(true, data);
        return true;
      }
    } else if (res.status === 401) {
      return false; // Contraseña incorrecta confirmada por el servidor
    }
  } catch (netErr) {
    console.warn('[Auth] Sin conexión al backend /api/auth:', netErr);
  }

  // 2. Modo Offline Seguro:
  // Si no hay conexión con el servidor pero este dispositivo ya tenía una sesión
  // válida emitida previamente por el backend, permitimos el acceso sin requerir red.
  const existingSession = getCtSession();
  if (existingSession && existingSession.authenticated && Date.now() <= Number(existingSession.expiresAt)) {
    return true;
  }

  return false;
}

function isCtAuthenticated() {
  return getCtSession() !== null;
}

function isDtAuthenticated() {
  return isCtAuthenticated();
}

function setCtAuthenticated(authenticated = true, sessionData = null) {
  try {
    if (authenticated) {
      const existing = getCtSession();
      const expiresAt = (sessionData && sessionData.expiresAt)
        ? Number(sessionData.expiresAt)
        : (existing ? existing.expiresAt : (Date.now() + 12 * 60 * 60 * 1000));
      const token = (sessionData && sessionData.token)
        ? sessionData.token
        : (existing ? existing.token : 'active_token');

      const session = {
        authenticated: true,
        token,
        expiresAt
      };
      localStorage.setItem(CT_AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CT_AUTH_STORAGE_KEY);
      localStorage.removeItem('regatas_ct_auth_v3');
      localStorage.removeItem('regatas_ct_auth_v2');
      sessionStorage.removeItem('regatas_dt_auth_ok');
      sessionStorage.removeItem('regatas_ct_auth_v2');
    }
  } catch (e) {}
  updateCtUiState();
}

function updateCtUiState() {
  const isAuth = isCtAuthenticated();
  const session = getCtSession();

  // Actualizar indicadores del Menú Drawer
  document.querySelectorAll('.drawer-badge-lock').forEach(badge => {
    badge.textContent = isAuth ? '🔓' : '🔒';
    if (isAuth && session && session.expiresAt) {
      const expTime = new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      badge.title = `Sesión de Cuerpo Técnico activa hasta las ${expTime} hs`;
    } else {
      badge.title = isAuth ? 'Sesión de Cuerpo Técnico activa' : 'Requiere contraseña de Cuerpo Técnico';
    }
    badge.style.color = isAuth ? '#34d399' : '';
  });

  // Modal de Google Sheets
  const sheetsGate = document.getElementById('sheetsAuthGate');
  const sheetsBody = document.getElementById('sheetsAuthBody');
  if (sheetsGate && sheetsBody) {
    if (isAuth) {
      sheetsGate.style.display = 'none';
      sheetsBody.style.display = 'flex';
    } else {
      sheetsGate.style.display = 'block';
      sheetsBody.style.display = 'none';
    }
  }

  // Botonera DT
  if (currentActiveView === 'dt') {
    handleDtViewOpen();
  }

  // Estadísticas por Cuartos
  const statsGate = document.getElementById('statsAuthGateCard');
  const statsContent = document.getElementById('statsMainContent');
  const statsLockBtn = document.getElementById('btnStatsLockSession');
  if (statsGate && statsContent) {
    if (isAuth) {
      statsGate.style.display = 'none';
      statsContent.style.display = 'flex';
    } else {
      statsGate.style.display = 'block';
      statsContent.style.display = 'none';
    }
  }
  if (statsLockBtn) {
    statsLockBtn.style.display = isAuth ? 'inline-flex' : 'none';
  }
  if (currentActiveView === 'estadisticas') {
    handleStatsViewOpen();
  }
}

function lockCtSession() {
  setCtAuthenticated(false);
  if (typeof pauseDtClock === 'function') pauseDtClock();
  if (typeof stopDtCloudPolling === 'function') stopDtCloudPolling();
  document.body.classList.remove('dt-sun-mode');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', '#030d2d');

  const dtSunBtn = document.getElementById('btnDtSunToggle');
  if (dtSunBtn) dtSunBtn.classList.remove('active');

  updateCtUiState();
  showToast('🔒 Sesión de Cuerpo Técnico cerrada');
}

// ============================================================================
// MÓDULO: 04_navigation.js
// ============================================================================

// ============================================================================
// NAVEGACIÓN DISCRETA ENTRE CITACIÓN, TORNEO Y EVALUACIONES FÍSICAS
// ============================================================================

let currentActiveView = 'citacion'; // 'citacion' | 'torneo' | 'fisico' | 'dt'

function openNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  if (drawer) {
    drawer.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (overlay) overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('navDrawerOverlay');
  if (drawer) {
    drawer.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function setupViewSwitching() {
  // 1. Menú Hamburguesa & Drawer Lateral
  const btnOpenDrawer = document.getElementById('btnOpenNavDrawer');
  const btnCloseDrawer = document.getElementById('btnCloseNavDrawer');
  const drawerOverlay = document.getElementById('navDrawerOverlay');

  if (btnOpenDrawer) btnOpenDrawer.addEventListener('click', openNavDrawer);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeNavDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeNavDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNavDrawer();
      closeSheetsAuthModal();
    }
  });

  // Acceso destacado a Botonera DT desde el Menú Hamburguesa
  const drawerBtnDT = document.getElementById('drawerBtnDT');
  if (drawerBtnDT) {
    drawerBtnDT.addEventListener('click', () => {
      closeNavDrawer();
      showView('dt');
    });
  }

  // Navegación general desde el Drawer
  const drawerBtnCitacion = document.getElementById('drawerBtnCitacion');
  if (drawerBtnCitacion) {
    drawerBtnCitacion.addEventListener('click', () => {
      closeNavDrawer();
      showView('citacion');
    });
  }

  const drawerBtnTorneo = document.getElementById('drawerBtnTorneo');
  if (drawerBtnTorneo) {
    drawerBtnTorneo.addEventListener('click', () => {
      closeNavDrawer();
      showView('torneo');
    });
  }

  const drawerBtnFisico = document.getElementById('drawerBtnFisico');
  if (drawerBtnFisico) {
    drawerBtnFisico.addEventListener('click', () => {
      closeNavDrawer();
      showView('fisico');
    });
  }

  const drawerBtnInstall = document.getElementById('drawerBtnInstallPwa');
  if (drawerBtnInstall) {
    drawerBtnInstall.addEventListener('click', () => {
      closeNavDrawer();
      triggerPwaInstall();
    });
  }

  // Acceso a Planilla Google Sheets con protección por contraseña
  const drawerBtnSheets = document.getElementById('drawerBtnSheets');
  if (drawerBtnSheets) {
    drawerBtnSheets.addEventListener('click', () => {
      closeNavDrawer();
      openSheetsAuthModal();
    });
  }

  // Acceso a Estadísticas por Cuartos desde Drawer
  const drawerBtnStats = document.getElementById('drawerBtnStats');
  if (drawerBtnStats) {
    drawerBtnStats.addEventListener('click', () => {
      closeNavDrawer();
      showView('estadisticas');
    });
  }

  // Acceso a Estadísticas desde la Botonera DT
  const btnDtOpenQuarterStats = document.getElementById('btnDtOpenQuarterStats');
  if (btnDtOpenQuarterStats) {
    btnDtOpenQuarterStats.addEventListener('click', () => {
      showView('estadisticas');
    });
  }

  // Botones de Retorno desde Estadísticas
  const btnReturnFromStats = document.getElementById('btnReturnToCitacionFromStats');
  if (btnReturnFromStats) {
    btnReturnFromStats.addEventListener('click', () => showView('citacion'));
  }
  const btnGoToDtFromStats = document.getElementById('btnGoToDtFromStats');
  if (btnGoToDtFromStats) {
    btnGoToDtFromStats.addEventListener('click', () => showView('dt'));
  }

  // Filtro de Partidos en Estadísticas
  const selectStatsFilter = document.getElementById('selectStatsMatchFilter');
  if (selectStatsFilter) {
    selectStatsFilter.addEventListener('change', (e) => {
      renderAnalyticsDashboard(e.target.value);
    });
  }

  // Sincronización de todos los partidos desde Google Sheets
  const btnSyncAllCloud = document.getElementById('btnSyncAllMatchesCloud');
  if (btnSyncAllCloud) {
    btnSyncAllCloud.addEventListener('click', syncAllMatchesFromCloud);
  }

  // Compartir Análisis por WhatsApp
  const btnShareStatsWa = document.getElementById('btnShareStatsWhatsApp');
  if (btnShareStatsWa) {
    btnShareStatsWa.addEventListener('click', shareStatsWhatsApp);
  }

  // Descargar/Compartir Reporte Gráfico Táctico
  const btnShareStatsImg = document.getElementById('btnShareStatsImage');
  if (btnShareStatsImg) {
    btnShareStatsImg.addEventListener('click', exportStatsVisualCard);
  }

  // Auth Gate de Estadísticas por Cuartos
  const btnStatsGateSubmit = document.getElementById('btnStatsGateSubmit');
  const inputStatsGatePassword = document.getElementById('inputStatsGatePassword');
  const btnStatsLock = document.getElementById('btnStatsLockSession');

  if (btnStatsGateSubmit) btnStatsGateSubmit.addEventListener('click', verifyStatsPassword);
  if (inputStatsGatePassword) {
    inputStatsGatePassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyStatsPassword();
    });
  }
  if (btnStatsLock) btnStatsLock.addEventListener('click', lockCtSession);

  // 2. Botones del Dock Inferior
  const dockBtns = document.querySelectorAll('.nav-dock-btn');
  dockBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      if (targetView) showView(targetView);
    });
  });


  // 4. Botones de Retorno a Citación
  const btnReturnFromTorneo = document.getElementById('btnReturnToCitacionFromTorneo');
  if (btnReturnFromTorneo) {
    btnReturnFromTorneo.addEventListener('click', () => showView('citacion'));
  }

  const btnReturnFromFisico = document.getElementById('btnReturnToCitacion');
  if (btnReturnFromFisico) {
    btnReturnFromFisico.addEventListener('click', () => showView('citacion'));
  }

  const btnReturnFromDT = document.getElementById('btnReturnToCitacionFromDT');
  if (btnReturnFromDT) {
    btnReturnFromDT.addEventListener('click', () => showView('citacion'));
  }
}

function showView(viewName) {
  const viewCitacion = document.getElementById('viewCitacion');
  const viewTorneo = document.getElementById('viewTorneo');
  const viewFisico = document.getElementById('viewFisico');
  const viewDT = document.getElementById('viewDT');
  const viewEstadisticas = document.getElementById('viewEstadisticas');
  const bottomNavDock = document.getElementById('bottomNavDock');

  currentActiveView = viewName;

  document.body.classList.toggle('in-dt-view', viewName === 'dt');
  document.body.classList.toggle('in-stats-view', viewName === 'estadisticas');

  if (viewCitacion) viewCitacion.style.display = viewName === 'citacion' ? 'flex' : 'none';
  if (viewTorneo) viewTorneo.style.display = viewName === 'torneo' ? 'flex' : 'none';
  if (viewFisico) viewFisico.style.display = viewName === 'fisico' ? 'flex' : 'none';
  if (viewDT) viewDT.style.display = viewName === 'dt' ? 'flex' : 'none';
  if (viewEstadisticas) viewEstadisticas.style.display = viewName === 'estadisticas' ? 'flex' : 'none';

  // En la botonera DT y en Estadísticas ocultamos el dock inferior para que no tape los controles
  if (bottomNavDock) {
    bottomNavDock.style.display = (viewName === 'dt' || viewName === 'estadisticas') ? 'none' : 'flex';
  }

  // Actualizar estado activo en la barra de navegación inferior
  document.querySelectorAll('.nav-dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
  });

  // Actualizar estado activo en el menú lateral (drawer)
  document.querySelectorAll('.drawer-nav-item[data-view]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewName);
  });

  if (viewName === 'torneo') {
    stopDtCloudPolling();
    renderTournamentView();
  } else if (viewName === 'fisico') {
    stopDtCloudPolling();
    if (physicalPlayers.length > 0) {
      if (currentPhysViewMode === 'averages') {
        renderCategoryAverages(currentPhysFilter);
      } else if (currentPhysViewMode === 'top10') {
        renderTop10Panel();
      } else if (!selectedPlayerId) {
        renderPhysicalSuggestions();
      }
    }
  } else if (viewName === 'dt') {
    handleDtViewOpen();
  } else if (viewName === 'estadisticas') {
    stopDtCloudPolling();
    // Fuera de la vista DT, quitamos el modo sol para que solo afecte la botonera
    document.body.classList.remove('dt-sun-mode');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', '#030d2d');
    handleStatsViewOpen();
  } else {
    stopDtCloudPolling();
    // Fuera de la vista DT, quitamos el modo sol para que solo afecte la botonera
    document.body.classList.remove('dt-sun-mode');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', '#030d2d');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================

// ============================================================================
// MÓDULO: 05_torneo.js
// ============================================================================

// CARGA Y RENDERIZADO DEL TORNEO (AMH CLAUSURA DAMAS B 2026)
// ============================================================================

function loadTournamentData() {
  // Limpieza de versiones viejas con posibles partidos asignados erróneamente
  try {
    localStorage.removeItem('regatas_andino_torneo_v1');
    localStorage.removeItem('regatas_andino_torneo_v2');
    localStorage.removeItem('regatas_andino_torneo_v3');
  } catch (e) {}

  const saved = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
  if (saved) {
    try {
      tournamentData = JSON.parse(saved);
      if (!tournamentData.primera || !tournamentData.intermedia) {
        tournamentData = JSON.parse(JSON.stringify(DEFAULT_TOURNAMENT_DATA));
      }
    } catch (e) {
      tournamentData = JSON.parse(JSON.stringify(DEFAULT_TOURNAMENT_DATA));
    }
  } else {
    tournamentData = JSON.parse(JSON.stringify(DEFAULT_TOURNAMENT_DATA));
  }

  // Sanitización: asegurar que la lista de jugados solo contenga partidos efectivamente disputados con resultado
  ['primera', 'intermedia'].forEach(div => {
    if (tournamentData[div] && Array.isArray(tournamentData[div].matches)) {
      tournamentData[div].matches = tournamentData[div].matches.filter(m => {
        const isPlayed = m.status === 'Jugado' || m.played === true;
        const hasScore = m.score && m.score !== '-' && !m.score.includes('undefined');
        return isPlayed && hasScore;
      });
    }
    if ((!tournamentData[div].matches || tournamentData[div].matches.length === 0) && DEFAULT_TOURNAMENT_DATA[div] && DEFAULT_TOURNAMENT_DATA[div].matches) {
      tournamentData[div].matches = DEFAULT_TOURNAMENT_DATA[div].matches;
    }
    if (!tournamentData[div].nextMatch && DEFAULT_TOURNAMENT_DATA[div] && DEFAULT_TOURNAMENT_DATA[div].nextMatch) {
      tournamentData[div].nextMatch = DEFAULT_TOURNAMENT_DATA[div].nextMatch;
    }
    if ((!tournamentData[div].pendingMatches || tournamentData[div].pendingMatches.length === 0) && DEFAULT_TOURNAMENT_DATA[div] && DEFAULT_TOURNAMENT_DATA[div].pendingMatches) {
      tournamentData[div].pendingMatches = DEFAULT_TOURNAMENT_DATA[div].pendingMatches;
    }
  });
}

function setupTournamentCategorySwitch() {
  const pillPrimera = document.getElementById('pillPrimera');
  const pillIntermedia = document.getElementById('pillIntermedia');

  if (pillPrimera) {
    pillPrimera.addEventListener('click', () => {
      setTournamentDivision('primera');
    });
  }

  if (pillIntermedia) {
    pillIntermedia.addEventListener('click', () => {
      setTournamentDivision('intermedia');
    });
  }

  // Subtabs de Partidos: Jugados vs Por Jugar
  const tabPlayed = document.getElementById('tabMatchesPlayed');
  const tabPending = document.getElementById('tabMatchesPending');

  if (tabPlayed) {
    tabPlayed.addEventListener('click', () => {
      currentMatchesTab = 'played';
      tabPlayed.classList.add('active');
      if (tabPending) tabPending.classList.remove('active');
      const divData = tournamentData[currentTournamentDivision] || tournamentData.primera;
      renderTournamentMatches(divData);
    });
  }

  if (tabPending) {
    tabPending.addEventListener('click', () => {
      currentMatchesTab = 'pending';
      tabPending.classList.add('active');
      if (tabPlayed) tabPlayed.classList.remove('active');
      const divData = tournamentData[currentTournamentDivision] || tournamentData.primera;
      renderTournamentMatches(divData);
    });
  }

  const btnSyncAmh = document.getElementById('btnSyncAmh');
  if (btnSyncAmh) {
    btnSyncAmh.addEventListener('click', () => {
      syncTournamentData(true);
    });
  }
}

function setTournamentDivision(division) {
  currentTournamentDivision = division;

  const pillPrimera = document.getElementById('pillPrimera');
  const pillIntermedia = document.getElementById('pillIntermedia');

  if (pillPrimera) pillPrimera.classList.toggle('active', division === 'primera');
  if (pillIntermedia) pillIntermedia.classList.toggle('active', division === 'intermedia');

  renderTournamentView();
}

function renderTournamentView() {
  if (!tournamentData) loadTournamentData();
  const divData = tournamentData[currentTournamentDivision] || tournamentData.primera;

  renderRegatasSummary(divData);
  renderTournamentMatches(divData);
  renderStandingsTable(divData);
}

function renderRegatasSummary(divData) {
  const container = document.getElementById('regatasSummaryCard');
  if (!container) return;

  const standings = divData.standings || [];
  const clubName = getTenantConfig().shortName.toUpperCase();
  const regatas = standings.find(t => t.team.toUpperCase().includes(clubName)) || {
    pos: '-', pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, ge: 0, dif: 0
  };

  const difFormatted = regatas.dif > 0 ? `+${regatas.dif}` : `${regatas.dif}`;
  const difColor = regatas.dif > 0 ? '#34d399' : (regatas.dif < 0 ? '#f87171' : '#ffffff');

  container.innerHTML = `
    <div class="regatas-summary-header">
      <div class="regatas-team-badge-group">
        <img src="escudo-regatas-andino.png" alt="Regatas Andino" class="regatas-mini-escudo">
        <div class="regatas-team-titles">
          <h4>${escapeHtml(getTenantConfig().shortName)}</h4>
          <span>${escapeHtml(divData.divisionTitle)} • ZONA A</span>
        </div>
      </div>
      <div class="regatas-pos-callout">
        <div class="regatas-pos-number">#${regatas.pos}</div>
        <div class="regatas-pos-label">Posición</div>
      </div>
    </div>

    <div class="regatas-stats-grid">
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val pts-highlight">${regatas.pts}</div>
        <div class="regatas-stat-lbl">Puntos</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val">${regatas.pj}</div>
        <div class="regatas-stat-lbl">PJ</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val" style="color: #34d399;">${regatas.pg}</div>
        <div class="regatas-stat-lbl">PG</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val" style="color: #fbbf24;">${regatas.pe}</div>
        <div class="regatas-stat-lbl">PE</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val" style="color: #f87171;">${regatas.pp}</div>
        <div class="regatas-stat-lbl">PP</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val">${regatas.gf}</div>
        <div class="regatas-stat-lbl">GF</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val">${regatas.ge}</div>
        <div class="regatas-stat-lbl">GE</div>
      </div>
      <div class="regatas-stat-cell">
        <div class="regatas-stat-val" style="color: ${difColor};">${difFormatted}</div>
        <div class="regatas-stat-lbl">DIF</div>
      </div>
    </div>
  `;
}

function renderTournamentMatches(divData) {
  const subtitle = document.getElementById('matchesCategorySubtitle');

  // Filtrar estrictamente solo jugados que cuenten con resultado
  const rawPlayed = (divData.matches || []).filter(m => {
    const isPlayed = m.status === 'Jugado' || m.played === true;
    const hasScore = m.score && m.score !== '-' && !m.score.includes('undefined');
    return isPlayed && hasScore;
  });

  // Partidos pendientes de jugar
  const pending = divData.pendingMatches || (DEFAULT_TOURNAMENT_DATA[currentTournamentDivision] && DEFAULT_TOURNAMENT_DATA[currentTournamentDivision].pendingMatches) || [];

  // Actualizar contadores en los botones del subswitch
  const countPlayed = document.getElementById('countPlayedBadge');
  if (countPlayed) countPlayed.textContent = `${rawPlayed.length}`;

  const countPending = document.getElementById('countPendingBadge');
  if (countPending) countPending.textContent = `${pending.length}`;

  // Sincronizar estado visual de los tabs
  const tabPlayed = document.getElementById('tabMatchesPlayed');
  const tabPending = document.getElementById('tabMatchesPending');
  if (tabPlayed) tabPlayed.classList.toggle('active', currentMatchesTab === 'played');
  if (tabPending) tabPending.classList.toggle('active', currentMatchesTab === 'pending');

  const listContainer = document.getElementById('tournamentMatchesList');
  if (!listContainer) return;

  const isPrimera = currentTournamentDivision === 'primera';

  // -------------------------------------------------------------
  // VISTA: PARTIDOS POR JUGAR (FIXTURE RESTANTE)
  // -------------------------------------------------------------
  if (currentMatchesTab === 'pending') {
    if (subtitle) {
      subtitle.textContent = `Fixture por disputarse en ${divData.divisionTitle}`;
    }

    if (pending.length === 0) {
      listContainer.innerHTML = '<div style="text-align: center; color: #9bb1d6; padding: 24px;">No hay partidos pendientes programados.</div>';
      return;
    }

    listContainer.innerHTML = pending.map((m, idx) => {
      const isImminent = idx === 0;
      const isHome = (m.homeAway || 'Local').toLowerCase().includes('local');
      const conditionIcon = isHome ? '🏠' : '🚌';

      return `
        <div class="pending-match-item-card ${isImminent ? 'is-imminent' : ''}">
          <div class="match-item-info">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="match-item-round" style="color: #fbbf24;">${escapeHtml(m.round)}</span>
              ${isImminent ? '<span class="pending-badge-imminent">PRÓXIMO EN JUEGO</span>' : ''}
            </div>
            <span class="match-item-rival">vs ${escapeHtml(m.rival)}</span>
            <span class="match-item-condition">${conditionIcon} ${escapeHtml(m.homeAway || 'Local')}</span>
          </div>
          <div class="match-item-result-group">
            <span class="pending-date-pill">📅 ${escapeHtml(m.fecha || 'A confirmar')}</span>
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // -------------------------------------------------------------
  // VISTA: PARTIDOS JUGADOS (DISPUTADOS)
  // -------------------------------------------------------------
  if (subtitle) {
    subtitle.textContent = `Fechas disputadas en ${divData.divisionTitle}`;
  }

  // Mostramos del más reciente disputado (Fecha 11) al primero (Fecha 1)
  const matches = [...rawPlayed].reverse();

  // Próximo partido por disputarse (ej: Fecha 12 vs Murialdo B) para mostrar preview interactivo arriba
  const nextMatch = divData.nextMatch || (pending.length > 0 ? pending[0] : null);

  const nextMatchHtml = nextMatch ? `
    <div class="next-match-banner" style="cursor: pointer;" onclick="document.getElementById('tabMatchesPending').click();" title="Clic para ver el fixture restante completo">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span class="next-match-tag">⏳ PRÓXIMO PARTIDO • ${escapeHtml(nextMatch.round)}</span>
        <span style="font-size: 0.65rem; color: #fbbf24; font-weight: 700;">Ver fixture restante ➔</span>
      </div>
      <div class="next-match-content">
        <div class="next-match-rival-box">
          <span class="next-match-rival">vs ${escapeHtml(nextMatch.rival)}</span>
          <span class="next-match-condition">${escapeHtml(nextMatch.homeAway || 'Local')}${nextMatch.fecha ? ` • ${escapeHtml(nextMatch.fecha)}` : ''}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <span class="next-match-pill-pending">Por disputarse (X)</span>
        </div>
      </div>
    </div>
  ` : '';

  if (matches.length === 0) {
    listContainer.innerHTML = nextMatchHtml + '<div style="text-align: center; color: #9bb1d6; padding: 20px;">Sin partidos disputados registrados.</div>';
    return;
  }

  const matchesHtml = matches.map((m, idx) => {
    const resClass = m.result || 'loss';
    const resLabel = resClass === 'win' ? 'Victoria' : (resClass === 'draw' ? 'Empate' : 'Derrota');
    const isLatest = idx === 0;

    return `
      <div class="match-item-card ${isLatest ? 'is-latest-match' : ''}">
        <div class="match-item-info">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="match-item-round">${escapeHtml(m.round)}</span>
            ${isLatest ? '<span class="latest-match-badge">ÚLTIMO JUGADO</span>' : ''}
          </div>
          <span class="match-item-rival">${escapeHtml(m.rival)}</span>
          <span class="match-item-condition">${escapeHtml(m.homeAway || 'Local')}${m.fecha ? ` • ${escapeHtml(m.fecha)}` : ''}</span>
        </div>
        <div class="match-item-result-group">
          <span class="match-item-score">${escapeHtml(m.score || '-')}</span>
          <span class="match-pill-result ${resClass}">${resLabel}</span>
        </div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = nextMatchHtml + matchesHtml;
}

function renderStandingsTable(divData) {
  const subtitle = document.getElementById('tableCategorySubtitle');
  if (subtitle) {
    subtitle.textContent = `Zona A • ${divData.divisionTitle} • AMH Oficial`;
  }

  const tbody = document.getElementById('standingsTableBody');
  if (!tbody) return;

  const standings = divData.standings || [];
  if (standings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="padding: 24px; color: #9bb1d6;">Cargando tabla de posiciones...</td></tr>';
    return;
  }

  tbody.innerHTML = standings.map(row => {
    const isRegatas = row.team.toUpperCase().includes('REGATAS');
    const rowClass = isRegatas ? 'class="row-regatas"' : '';
    const difDisplay = row.dif > 0 ? `+${row.dif}` : row.dif;
    const difColor = row.dif > 0 ? '#34d399' : (row.dif < 0 ? '#f87171' : 'inherit');

    return `
      <tr ${rowClass}>
        <td class="td-pos">${row.pos}</td>
        <td class="td-team" title="${escapeHtml(row.team)}">
          ${escapeHtml(row.team)}
          ${isRegatas ? '<span class="regatas-star-tag">⭐ CLUB</span>' : ''}
        </td>
        <td>${row.pj}</td>
        <td>${row.pg}</td>
        <td>${row.pe}</td>
        <td>${row.pp}</td>
        <td>${row.gf}</td>
        <td>${row.ge}</td>
        <td style="font-weight: 700; color: ${difColor}">${difDisplay}</td>
        <td class="td-pts">${row.pts}</td>
      </tr>
    `;
  }).join('');
}

function renderTournamentScorers(divData) {
  const listContainer = document.getElementById('tournamentScorersList');
  if (!listContainer) return;

  const scorers = divData.scorers || [];
  if (scorers.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; color: #9bb1d6; padding: 16px;">Sin goleadoras registradas.</div>';
    return;
  }

  listContainer.innerHTML = scorers.slice(0, 10).map((s, idx) => `
    <div class="scorer-item">
      <span class="scorer-rank">#${idx + 1}</span>
      <div class="scorer-info">
        <div class="scorer-name">${escapeHtml(s.player)}</div>
        <div class="scorer-club">${escapeHtml(s.club)}</div>
      </div>
      <span class="scorer-goals-badge">${s.goals} goles</span>
    </div>
  `).join('');
}

function updateAmhLinks(divData) {
  const btnStandings = document.getElementById('btnOpenAmhStandings');
  if (btnStandings && divData.officialUrl) {
    btnStandings.href = divData.officialUrl;
  }

  const btnMatches = document.getElementById('btnOpenAmhMatches');
  if (btnMatches && divData.officialMatchesUrl) {
    btnMatches.href = divData.officialMatchesUrl;
  }
}

// Sincronización oficial del Torneo mediante Backend Proxy (/api/torneo)
async function syncTournamentData(manual = false) {
  const btnSync = document.getElementById('btnSyncAmh');
  const badge = document.getElementById('amhSyncTimeBadge');
  if (btnSync) btnSync.classList.add('is-loading');

  try {
    let syncedAny = false;

    const fetchDiv = async (divId) => {
      try {
        const cacheBust = manual ? `&_t=${Date.now()}` : '';
        const res = await fetch(`/api/torneo?club=${encodeURIComponent(tenantSlug)}&division=${divId}${cacheBust}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.standings && data.standings.length > 0) return data;
        }
      } catch (e) {}
      return null;
    };

    const fetchMatches = async (divId) => {
      try {
        const cacheBust = manual ? `&_t=${Date.now()}` : '';
        const res = await fetch(`/api/torneo/matches?club=${encodeURIComponent(tenantSlug)}&division=${divId}${cacheBust}`);
        if (res.ok) return await res.json();
      } catch (e) {}
      return null;
    };

    // Fetch standings
    const [res1, res2] = await Promise.all([fetchDiv('1'), fetchDiv('2')]);

    if (res1 && res1.standings && res1.standings.length > 0) {
      tournamentData.primera.standings = res1.standings;
      if (res1.scorers && res1.scorers.length > 0) {
        tournamentData.primera.scorers = res1.scorers;
      }
      syncedAny = true;
    }

    if (res2 && res2.standings && res2.standings.length > 0) {
      tournamentData.intermedia.standings = res2.standings;
      if (res2.scorers && res2.scorers.length > 0) {
        tournamentData.intermedia.scorers = res2.scorers;
      }
      syncedAny = true;
    }

    // Fetch match results
    const [m1, m2] = await Promise.all([fetchMatches('1'), fetchMatches('2')]);

    if (m1) {
      const played = (m1.playedMatches || (m1.matches || []).filter(m => m.played)).filter(m => {
        return (m.status === 'Jugado' || m.played === true) && m.score && m.score !== '-' && !m.score.includes('undefined');
      });
      if (played.length > 0) tournamentData.primera.matches = played;
      if (m1.nextMatch) tournamentData.primera.nextMatch = m1.nextMatch;
      if (m1.pendingMatches && m1.pendingMatches.length > 0) tournamentData.primera.pendingMatches = m1.pendingMatches;
    }

    if (m2) {
      const played = (m2.playedMatches || (m2.matches || []).filter(m => m.played)).filter(m => {
        return (m.status === 'Jugado' || m.played === true) && m.score && m.score !== '-' && !m.score.includes('undefined');
      });
      if (played.length > 0) tournamentData.intermedia.matches = played;
      if (m2.nextMatch) tournamentData.intermedia.nextMatch = m2.nextMatch;
      if (m2.pendingMatches && m2.pendingMatches.length > 0) tournamentData.intermedia.pendingMatches = m2.pendingMatches;
    }

    if (syncedAny) {
      try {
        localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(tournamentData));
      } catch (e) {}
      if (badge) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        badge.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #34d399;"></span> Sincronizado AMH ${timeStr}`;
      }
    }

    if (currentActiveView === 'torneo') {
      renderTournamentView();
    }

    if (manual) {
      if (syncedAny) {
        showToast('✅ Tabla de posiciones actualizada desde AMH');
      } else {
        showToast('ℹ️ Datos al día con el sitio oficial de AMH');
      }
    }
  } catch (err) {
    if (manual) {
      showToast('ℹ️ Usando datos cacheados de AMH');
    }
  } finally {
    if (btnSync) btnSync.classList.remove('is-loading');
  }
}

// ============================================================================

// ============================================================================
// MÓDULO: 06_citaciones.js
// ============================================================================

// CARGA Y PERSISTENCIA DE CITACIONES
// ============================================================================

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      matchData = JSON.parse(saved);
      if (!matchData.primera || !matchData.intermedia) {
        matchData = JSON.parse(JSON.stringify(DEFAULT_MATCH_DATA));
      }
    } catch (e) {
      matchData = JSON.parse(JSON.stringify(DEFAULT_MATCH_DATA));
    }
  } else {
    matchData = JSON.parse(JSON.stringify(DEFAULT_MATCH_DATA));
  }

  if (!matchData.motto || matchData.motto === 'Nuestra identidad no cambia, cambian nuestros desafíos.') {
    matchData.motto = 'Juntas somos más';
    saveData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matchData));
  } catch (e) {
    console.warn('[Storage] No se pudo guardar en localStorage:', e);
  }
}

// ============================================================================
// RENDERIZADO DE CITACIONES
// ============================================================================

function render() {
  // 1. Datos Generales del Partido
  const fixtureEl = document.getElementById('dispFixture');
  if (fixtureEl) {
    const round = (matchData.fixtureRound || 'FECHA 10').toUpperCase();
    const tournament = (matchData.tournament || 'TORNEO CLAUSURA').toUpperCase();
    fixtureEl.textContent = `${round} • ${tournament}`;
  }

  const rivalEl = document.getElementById('dispRivalName');
  if (rivalEl) {
    rivalEl.textContent = (matchData.rival || 'RIVAL').toUpperCase();
  }

  const dateEl = document.getElementById('dispDate');
  if (dateEl) {
    dateEl.textContent = matchData.dateDisplay || '';
  }

  const locEl = document.getElementById('dispLocation');
  if (locEl) {
    locEl.textContent = matchData.location || '';
  }

  const photoMottoEl = document.querySelector('.team-photo-motto');
  if (photoMottoEl) {
    photoMottoEl.textContent = `"${matchData.motto || 'Juntas somos más'}"`;
  }

  document.title = `Regatas Andino Hockey | ${matchData.rival || 'Plantel Superior B'}`;

  // 2. Escudo del Rival
  renderRivalLogo();

  // 3. Horarios y Lista según Categoría Activa
  renderActiveCategory();
}

// ============================================================================
// COLORES OFICIALES Y DETECCIÓN DINÁMICA DE ESCUDO DEL RIVAL
// ============================================================================

const KNOWN_CLUB_COLORS = {
  'MURIALDO': '#fbbf24',        // Amarillo Canario / Dorado
  'MARISTA': '#ef4444',         // Rojo Tricolor
  'LOS TORDOS': '#3b82f6',      // Azul Azulgrana
  'OBRAS': '#dc2626',           // Rojo
  'RIVADAVIA': '#ea580c',       // Naranja
  'ALEMAN': '#b91c1c',          // Rojo
  'BCO MZA': '#10b981',         // Verde
  'BANCO MENDOZA': '#10b981',   // Verde
  'TEQÜE': '#2563eb',           // Azul
  'TEQUE': '#2563eb',           // Azul
  'LICEO': '#0284c7',           // Celeste
  'SAN JORGE': '#ef4444',       // Rojo
  'SAN RAFAEL': '#0284c7',      // Celeste / Azul
  'PUMAI': '#f97316',           // Naranja
  'CABNA': '#0d9488',           // Verde azulado
  'PEUMAYEN': '#84cc16',        // Verde
  'VISTALBA': '#16a34a',        // Verde
  'TACURU': '#15803d',          // Verde
  'UNIÓN': '#6366f1',           // Azul
  'MENDOZA RC': '#ffffff'       // Blanco
};

function getClubFallbackColor(rivalName) {
  const upper = (rivalName || '').toUpperCase();
  for (const [key, color] of Object.entries(KNOWN_CLUB_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return '#fbbf24'; // Color cálido por defecto
}

function applyRivalCircleColor(colorHexOrRgb) {
  const container = document.getElementById('rivalBadgeContainer');
  if (!container) return;

  container.style.borderColor = colorHexOrRgb;

  let glowColor = colorHexOrRgb;
  if (colorHexOrRgb.startsWith('#')) {
    const hex = colorHexOrRgb.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 251;
    const g = parseInt(hex.substring(2, 4), 16) || 191;
    const b = parseInt(hex.substring(4, 6), 16) || 36;
    glowColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
  } else if (colorHexOrRgb.startsWith('rgb(')) {
    glowColor = colorHexOrRgb.replace('rgb(', 'rgba(').replace(')', ', 0.35)');
  }

  container.style.boxShadow = `0 0 25px ${glowColor}`;
}

function extractDominantImageColor(imgEl, callback) {
  const runExtraction = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 32;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size).data;
      const buckets = {};
      let maxScore = 0;
      let dominant = null;

      for (let i = 0; i < imgData.length; i += 4) {
        const a = imgData[i + 3];
        if (a < 120) continue; // Descartar píxeles transparentes

        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];

        // Descartar fondos blancos / negros puros y grises apagados
        if (r > 240 && g > 240 && b > 240) continue;
        if (r < 25 && g < 25 && b < 25) continue;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        if (sat < 0.18) continue; // Descartar escala de grises

        // Agrupar en cubos de color de 24 niveles
        const qr = Math.round(r / 24) * 24;
        const qg = Math.round(g / 24) * 24;
        const qb = Math.round(b / 24) * 24;
        const key = `${qr},${qg},${qb}`;

        // Ponderar por saturación para preferir los colores vivos del escudo
        const score = 1 + sat * 2.5;
        buckets[key] = (buckets[key] || 0) + score;

        if (buckets[key] > maxScore) {
          maxScore = buckets[key];
          dominant = { r: qr, g: qg, b: qb };
        }
      }

      if (dominant) {
        callback(`rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`);
        return;
      }
    } catch (e) {
      // Si la imagen proviene de un dominio externo sin CORS permitido
    }
    callback(null);
  };

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    runExtraction();
  } else {
    imgEl.addEventListener('load', runExtraction, { once: true });
  }
}

function renderRivalLogo() {
  const container = document.getElementById('rivalBadgeContainer');
  if (!container) return;

  const rivalName = matchData.rival || 'R';
  const initial = rivalName.trim().charAt(0).toUpperCase() || 'R';
  const fallbackColor = getClubFallbackColor(rivalName);

  // Aplicar inmediatamente el color del club para evitar saltos visuales
  applyRivalCircleColor(fallbackColor);

  if (matchData.rivalLogo && matchData.rivalLogo.trim() !== '') {
    const img = document.createElement('img');
    img.src = matchData.rivalLogo;
    img.alt = rivalName;

    img.onerror = () => {
      container.innerHTML = `<span class="team-badge-initial" style="color: ${fallbackColor};">${initial}</span>`;
      applyRivalCircleColor(fallbackColor);
    };

    // Intentar extraer el color predominante usando una imagen auxiliar en segundo plano
    try {
      const probeImg = new Image();
      probeImg.crossOrigin = 'anonymous';
      probeImg.src = matchData.rivalLogo;
      extractDominantImageColor(probeImg, (dominantColor) => {
        if (dominantColor) {
          applyRivalCircleColor(dominantColor);
        }
      });
    } catch (e) {
      // Ignorar fallo de extracción, la imagen principal se muestra de todos modos
    }

    container.innerHTML = '';
    container.appendChild(img);
  } else {
    container.innerHTML = `<span class="team-badge-initial" style="color: ${fallbackColor};">${initial}</span>`;
  }
}

function renderActiveCategory() {
  const catData = matchData[currentCategory] || matchData.primera;

  const catNameEl = document.getElementById('scheduleCatName');
  if (catNameEl) {
    catNameEl.textContent = currentCategory === 'primera' ? '1RA' : 'INTER';
  }

  const callEl = document.getElementById('dispCallTime');
  if (callEl) {
    callEl.textContent = catData.callTime || '--:--';
  }

  const matchEl = document.getElementById('dispMatchTime');
  if (matchEl) {
    matchEl.textContent = catData.matchTime || '--:--';
  }

  const tag = document.getElementById('rosterCategoryTag');
  if (tag) {
    tag.textContent = currentCategory === 'primera' ? '1RA DIVISIÓN' : 'INTERMEDIA';
  }

  const countBadge = document.getElementById('playerCount');
  const listContainer = document.getElementById('playersList');
  const players = catData.players || [];

  if (countBadge) {
    countBadge.textContent = `${players.length} JUGADORAS`;
  }

  if (!listContainer) return;

  if (!players.length) {
    listContainer.innerHTML = '<div style="text-align: center; color: #9bb1d6; padding: 28px 16px; font-size: 0.92rem; line-height: 1.5;">' +
      '<div style="font-size: 2rem; margin-bottom: 8px;">📡</div>' +
      '<strong style="color: #ffffff;">Esperando sincronización de citadas</strong><br>' +
      '<span style="font-size: 0.8rem; color: #64748b;">Conectate a internet para ver la citación oficial en vivo desde la planilla.</span>' +
      '</div>';
    return;
  }

  listContainer.innerHTML = players.map((name, idx) => `
    <div class="player-item">
      <span class="player-idx">${idx + 1}.</span>
      <span class="player-name">${escapeHtml(name)}</span>
    </div>
  `).join('');
}

function setupCategorySwitch() {
  const btn1ra = document.getElementById('btnCatPrimera');
  const btnInter = document.getElementById('btnCatIntermedia');

  if (btn1ra && btnInter) {
    btn1ra.addEventListener('click', () => {
      btn1ra.classList.add('active');
      btnInter.classList.remove('active');
      currentCategory = 'primera';
      renderActiveCategory();
    });

    btnInter.addEventListener('click', () => {
      btnInter.classList.add('active');
      btn1ra.classList.remove('active');
      currentCategory = 'intermedia';
      renderActiveCategory();
    });
  }
}

// ============================================================================

// ============================================================================
// MÓDULO: 07_ct_modal.js
// ============================================================================

// EVENTOS Y MODAL DE PLANILLAS OFICIALES (CUERPO TÉCNICO)
// ============================================================================

function setupEvents() {
  // Modal de Acceso a Planillas Oficiales (Cuerpo Técnico)
  const modalSheets = document.getElementById('modalSheetsAuth');
  const btnCloseSheets = document.getElementById('btnCloseSheetsAuth');
  const btnCloseSheetsBottom = document.getElementById('btnCloseSheetsModalBottom');
  const btnSubmitSheets = document.getElementById('btnSubmitSheetsAuth');
  const btnLockSheets = document.getElementById('btnLockSheetsAuth');
  const inputSheetsPass = document.getElementById('inputSheetsPassword');

  if (btnCloseSheets) btnCloseSheets.addEventListener('click', closeSheetsAuthModal);
  if (btnCloseSheetsBottom) btnCloseSheetsBottom.addEventListener('click', closeSheetsAuthModal);
  if (btnSubmitSheets) btnSubmitSheets.addEventListener('click', verifySheetsPassword);
  if (btnLockSheets) btnLockSheets.addEventListener('click', lockSheetsSession);

  if (inputSheetsPass) {
    inputSheetsPass.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifySheetsPassword();
    });
  }

  if (modalSheets) {
    modalSheets.addEventListener('click', (e) => {
      if (e.target === modalSheets) closeSheetsAuthModal();
    });
  }
}

// ============================================================================
// ACCESO PROTEGIDO A PLANILLAS GOOGLE SHEETS
// ============================================================================

function openSheetsAuthModal() {
  const modal = document.getElementById('modalSheetsAuth');
  const gate = document.getElementById('sheetsAuthGate');
  const body = document.getElementById('sheetsAuthBody');
  const input = document.getElementById('inputSheetsPassword');
  const error = document.getElementById('sheetsAuthErrorMsg');
  const bottomNavDock = document.getElementById('bottomNavDock');

  if (!modal) return;

  if (isDtAuthenticated()) {
    if (gate) gate.style.display = 'none';
    if (body) body.style.display = 'flex';
    if (error) error.style.display = 'none';
  } else {
    if (gate) gate.style.display = 'block';
    if (body) body.style.display = 'none';
    if (error) error.style.display = 'none';
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 150);
    }
  }

  modal.classList.add('active');
  document.body.classList.add('modal-open');
  if (bottomNavDock) {
    bottomNavDock.style.display = 'none';
  }
}

function closeSheetsAuthModal() {
  const modal = document.getElementById('modalSheetsAuth');
  if (modal) modal.classList.remove('active');
  document.body.classList.remove('modal-open');
  const bottomNavDock = document.getElementById('bottomNavDock');
  if (bottomNavDock) {
    const isSpecialView = typeof currentActiveView !== 'undefined' && (currentActiveView === 'dt' || currentActiveView === 'estadisticas');
    bottomNavDock.style.display = isSpecialView ? 'none' : 'flex';
  }
}

async function verifySheetsPassword() {
  const input = document.getElementById('inputSheetsPassword');
  const error = document.getElementById('sheetsAuthErrorMsg');
  const gate = document.getElementById('sheetsAuthGate');
  const body = document.getElementById('sheetsAuthBody');
  const entered = (input ? input.value : '').trim().toLowerCase();

  const ok = await verifyCtPassword(entered);
  if (ok) {
    setCtAuthenticated(true);
    if (error) error.style.display = 'none';
    if (gate) gate.style.display = 'none';
    if (body) body.style.display = 'flex';
    showToast('🔓 Acceso concedido a Planillas');
  } else {
    if (error) error.style.display = 'block';
    if (input) input.select();
  }
}

function lockSheetsSession() {
  lockCtSession();
  closeSheetsAuthModal();
}

// ============================================================================

// ============================================================================
// MÓDULO: 08_fisico.js
// ============================================================================

// Definición de Tests Físicos de la Planilla
const TESTS_CONFIG = [
  { key: 'broadJump', name: 'Broad Jump', type: 'Salto Horizontal', unit: 'm', higherIsBetter: true, icon: '🏃‍♀️', decimals: 2, cols: [3, 4, 5] },
  { key: 'cmj', name: 'CMJ (Salto Vertical)', type: 'Salto con Contramovimiento', unit: 'cm', higherIsBetter: true, icon: '⚡', decimals: 1, cols: [6, 7, 8] },
  { key: 'agility', name: 'Test 5-10-5', type: 'Agilidad Pro Agility', unit: 'seg', higherIsBetter: false, icon: '⏱️', decimals: 2, cols: [9, 10, 11] },
  { key: 'sprint', name: 'Velocidad 40 mts', type: 'Aceleración Lineal', unit: 'seg', higherIsBetter: false, icon: '💨', decimals: 2, cols: [12, 13, 14] },
  { key: 'yoyo', name: 'Yo-Yo Test', type: 'Resistencia Intermitente', unit: 'm', higherIsBetter: true, icon: '🫁', decimals: 0, cols: [15, 16, 17] },
  { key: 'bench', name: 'Press de Banca', type: 'Fuerza Tren Superior', unit: 'kg', higherIsBetter: true, icon: '🏋️‍♀️', decimals: 1, cols: [18, 19, 20] },
  { key: 'deadlift', name: 'Peso Muerto', type: 'Fuerza Cadena Posterior', unit: 'kg', higherIsBetter: true, icon: '🏋️', decimals: 1, cols: [21, 22, 23] },
  { key: 'squat', name: 'Sentadilla', type: 'Fuerza Tren Inferior', unit: 'kg', higherIsBetter: true, icon: '🦵', decimals: 1, cols: [24, 25, 26] },
  { key: 'platform', name: 'Plataforma', type: 'Potencia', unit: '', higherIsBetter: true, icon: '🎯', decimals: 1, cols: [27, 28, 29] }
];

// SECCIÓN DE EVALUACIONES FÍSICAS
// ============================================================================

function setupPhysicalSection() {
  const inputSearch = document.getElementById('inputSearchPlayer');
  const btnClear = document.getElementById('btnClearSearch');
  const filterChips = document.getElementById('physFilterChips');
  const btnChange = document.getElementById('btnChangePlayer');
  const btnModePlayers = document.getElementById('btnPhysModePlayers');
  const btnModeAverages = document.getElementById('btnPhysModeAverages');
  const btnModeTop10 = document.getElementById('btnPhysModeTop10');
  const benchScopePills = document.getElementById('benchmarkScopePills');

  // Cargar datos cacheados si existen
  const cached = localStorage.getItem(PHYSICAL_STORAGE_KEY);
  if (cached) {
    try {
      physicalPlayers = JSON.parse(cached);
      physicalCategoryAverages = calculateCategoryAverages();
      if (currentPhysViewMode === 'averages') {
        renderCategoryAverages(currentPhysFilter);
      } else if (currentPhysViewMode === 'top10') {
        renderTop10Panel();
      } else {
        renderPhysicalSuggestions();
      }
    } catch (e) {}
  }

  // Input de Búsqueda
  if (inputSearch) {
    inputSearch.addEventListener('input', () => {
      const q = inputSearch.value.trim();
      if (btnClear) btnClear.style.display = q ? 'block' : 'none';
      const suggestList = document.getElementById('playersSuggestList');
      if (suggestList) suggestList.style.display = 'flex';
      renderPhysicalSuggestions(q);
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      inputSearch.value = '';
      btnClear.style.display = 'none';
      inputSearch.focus();
      renderPhysicalSuggestions('');
    });
  }

  // Selector de Modo: Jugadoras vs Medias vs Top 10
  if (btnModePlayers) {
    btnModePlayers.addEventListener('click', () => {
      switchPhysicalViewMode('players');
    });
  }

  if (btnModeAverages) {
    btnModeAverages.addEventListener('click', () => {
      switchPhysicalViewMode('averages');
    });
  }

  if (btnModeTop10) {
    btnModeTop10.addEventListener('click', () => {
      switchPhysicalViewMode('top10');
    });
  }

  // Chips de Filtro (Categoría)
  if (filterChips) {
    filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;

      filterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentPhysFilter = chip.getAttribute('data-filter') || 'all';

      if (currentPhysViewMode === 'averages') {
        renderCategoryAverages(currentPhysFilter);
      } else if (currentPhysViewMode === 'top10') {
        renderTop10Panel();
      } else {
        const q = inputSearch ? inputSearch.value.trim() : '';
        renderPhysicalSuggestions(q);
      }
    });
  }

  // Selector de Alcance de Comparativa en Perfil (Categoría vs Plantel Completo)
  if (benchScopePills) {
    benchScopePills.addEventListener('click', (e) => {
      const pill = e.target.closest('.bench-pill');
      if (!pill) return;

      benchScopePills.querySelectorAll('.bench-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentPhysBenchmarkScope = pill.getAttribute('data-scope') || 'category';

      if (selectedPlayerId) {
        const p = physicalPlayers.find(pl => pl.id === selectedPlayerId);
        if (p) renderPlayerCard(p);
      }
    });
  }

  // Botón Cambiar Jugadora (Cerrar ficha)
  if (btnChange) {
    btnChange.addEventListener('click', () => {
      selectedPlayerId = null;
      const profileCard = document.getElementById('playerProfileCard');
      const emptyState = document.getElementById('emptyPlayerState');
      const suggestList = document.getElementById('playersSuggestList');
      if (profileCard) profileCard.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (suggestList) suggestList.style.display = 'flex';
      if (inputSearch) {
        inputSearch.value = '';
        inputSearch.focus();
      }
      renderPhysicalSuggestions();
    });
  }

  // Botones de Compartir Ficha (WhatsApp e Imagen)
  const btnShareWA = document.getElementById('btnShareProfileWhatsApp');
  const btnShareImg = document.getElementById('btnShareProfileImage');

  if (btnShareWA) {
    btnShareWA.addEventListener('click', () => {
      if (!selectedPlayerId) return;
      const p = physicalPlayers.find(pl => pl.id === selectedPlayerId);
      if (p) sharePlayerProfileWhatsApp(p);
    });
  }

  if (btnShareImg) {
    btnShareImg.addEventListener('click', () => {
      if (!selectedPlayerId) return;
      const p = physicalPlayers.find(pl => pl.id === selectedPlayerId);
      if (p) generateAndSharePlayerImage(p);
    });
  }
}

// Conmutar entre Modo Jugadoras, Modo Medias y Modo Top 10
function switchPhysicalViewMode(mode) {
  currentPhysViewMode = mode;
  const btnPlayers = document.getElementById('btnPhysModePlayers');
  const btnAverages = document.getElementById('btnPhysModeAverages');
  const btnTop10 = document.getElementById('btnPhysModeTop10');
  const suggestList = document.getElementById('playersSuggestList');
  const searchWrapper = document.querySelector('.search-input-wrapper');
  const avgPanel = document.getElementById('categoryAveragesPanel');
  const top10Panel = document.getElementById('physTop10Panel');
  const profileCard = document.getElementById('playerProfileCard');
  const emptyState = document.getElementById('emptyPlayerState');
  const inputSearch = document.getElementById('inputSearchPlayer');

  if (btnPlayers) btnPlayers.classList.toggle('active', mode === 'players');
  if (btnAverages) btnAverages.classList.toggle('active', mode === 'averages');
  if (btnTop10) btnTop10.classList.toggle('active', mode === 'top10');

  if (mode === 'averages') {
    if (suggestList) suggestList.style.display = 'none';
    if (searchWrapper) searchWrapper.style.display = 'none';
    if (profileCard) profileCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (top10Panel) top10Panel.style.display = 'none';
    if (avgPanel) avgPanel.style.display = 'flex';
    renderCategoryAverages(currentPhysFilter);
  } else if (mode === 'top10') {
    if (suggestList) suggestList.style.display = 'none';
    if (searchWrapper) searchWrapper.style.display = 'none';
    if (profileCard) profileCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (avgPanel) avgPanel.style.display = 'none';
    if (top10Panel) top10Panel.style.display = 'flex';
    renderTop10Panel();
  } else {
    // Modo Jugadoras
    if (searchWrapper) searchWrapper.style.display = 'flex';
    if (avgPanel) avgPanel.style.display = 'none';
    if (top10Panel) top10Panel.style.display = 'none';

    if (selectedPlayerId) {
      if (profileCard) profileCard.style.display = 'flex';
      if (emptyState) emptyState.style.display = 'none';
      if (suggestList) suggestList.style.display = 'none';
      const p = physicalPlayers.find(pl => pl.id === selectedPlayerId);
      if (p) renderPlayerCard(p);
    } else {
      if (profileCard) profileCard.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (suggestList) suggestList.style.display = 'flex';
      renderPhysicalSuggestions(inputSearch ? inputSearch.value.trim() : '');
    }
  }
}

// Calcular Medias de Cada Evaluación por Categoría y Plantel Completo
function calculateCategoryAverages() {
  if (!physicalPlayers || physicalPlayers.length === 0) return null;

  const categories = [
    { key: 'all', label: 'Todo el Plantel', filter: () => true },
    { key: '1ra', label: '1ra División', filter: p => p.filterTag === '1ra' },
    { key: 'Inter', label: 'Intermedia', filter: p => p.filterTag === 'Inter' },
    { key: '5ta', label: '5ta División', filter: p => p.filterTag === '5ta' }
  ];

  const result = {};

  categories.forEach(cat => {
    const playersInCat = physicalPlayers.filter(cat.filter);
    const testsStats = {};

    TESTS_CONFIG.forEach(cfg => {
      const rounds = {
        1: { count: 0, sum: 0, avg: null },
        2: { count: 0, sum: 0, avg: null },
        3: { count: 0, sum: 0, avg: null }
      };

      const latestVals = [];

      playersInCat.forEach(p => {
        const pTest = p.tests ? p.tests[cfg.key] : null;
        if (!pTest || !pTest.evals || pTest.evals.length === 0) return;

        pTest.evals.forEach(ev => {
          if (ev.round >= 1 && ev.round <= 3 && typeof ev.value === 'number') {
            rounds[ev.round].count++;
            rounds[ev.round].sum += ev.value;
          }
        });

        const lastEv = pTest.evals[pTest.evals.length - 1];
        if (lastEv && typeof lastEv.value === 'number') {
          latestVals.push(lastEv.value);
        }
      });

      // Medias de cada ronda (1°, 2°, 3° evaluación)
      [1, 2, 3].forEach(r => {
        if (rounds[r].count > 0) {
          rounds[r].avg = +(rounds[r].sum / rounds[r].count).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
        }
      });

      // Media general / última medición
      let latestAvg = null;
      if (latestVals.length > 0) {
        const sum = latestVals.reduce((a, b) => a + b, 0);
        latestAvg = +(sum / latestVals.length).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
      }

      // Evolución de la media del grupo entre primera y última evaluación disponible
      let diff = null;
      let diffPct = null;
      let improved = null;
      const validRoundKeys = [1, 2, 3].filter(r => rounds[r].avg !== null);
      if (validRoundKeys.length >= 2) {
        const firstR = validRoundKeys[0];
        const lastR = validRoundKeys[validRoundKeys.length - 1];
        diff = +(rounds[lastR].avg - rounds[firstR].avg).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
        diffPct = rounds[firstR].avg !== 0 ? +((diff / rounds[firstR].avg) * 100).toFixed(1) : 0;
        improved = cfg.higherIsBetter ? (diff > 0) : (diff < 0);
      }

      testsStats[cfg.key] = {
        config: cfg,
        rounds,
        latestAvg,
        latestCount: latestVals.length,
        diff,
        diffPct,
        improved
      };
    });

    result[cat.key] = {
      key: cat.key,
      label: cat.label,
      playerCount: playersInCat.length,
      tests: testsStats
    };
  });

  return result;
}

// Renderizar Panel de Medias de Evaluaciones por Categoría
function renderCategoryAverages(catFilter = 'all') {
  const container = document.getElementById('categoryAveragesPanel');
  if (!container) return;

  if (!physicalCategoryAverages) {
    physicalCategoryAverages = calculateCategoryAverages();
  }

  if (!physicalCategoryAverages) {
    container.innerHTML = '<div style="text-align: center; color: #9bb1d6; padding: 20px;">No hay evaluaciones físicas disponibles para calcular medias.</div>';
    return;
  }

  const catData = physicalCategoryAverages[catFilter] || physicalCategoryAverages['all'];
  if (!catData) return;

  const testCardsHtml = TESTS_CONFIG.map(cfg => {
    const tData = catData.tests[cfg.key];
    const unit = cfg.unit ? ` ${cfg.unit}` : '';

    if (!tData || tData.latestCount === 0) {
      return `
        <div class="cat-avg-card">
          <div class="cat-avg-header">
            <div class="cat-avg-title-box">
              <span class="cat-avg-icon">${cfg.icon}</span>
              <div>
                <h4 class="cat-avg-name">${cfg.name}</h4>
                <span class="cat-avg-type">${cfg.type}</span>
              </div>
            </div>
            <div class="cat-avg-latest-val">
              <span class="cat-avg-num" style="color: var(--text-muted); font-size: 0.95rem;">Sin registros</span>
            </div>
          </div>
        </div>
      `;
    }

    // Badge de evolución de la media si existen 2+ rondas
    let diffBadgeHtml = '';
    if (tData.diff !== null) {
      const sign = tData.diff > 0 ? '+' : '';
      const pctSign = tData.diffPct > 0 ? '+' : '';
      if (tData.improved) {
        diffBadgeHtml = `<span class="test-diff-badge positive">${sign}${tData.diff}${unit} (${pctSign}${tData.diffPct}%) ↗ Evolución</span>`;
      } else if (tData.diff === 0) {
        diffBadgeHtml = `<span class="test-diff-badge neutral">= Media estable</span>`;
      } else {
        diffBadgeHtml = `<span class="test-diff-badge negative">${sign}${tData.diff}${unit} (${pctSign}${tData.diffPct}%) ↘</span>`;
      }
    }

    // Rondas evaluadas
    const roundsHtml = [1, 2, 3].map(r => {
      const rData = tData.rounds[r];
      const hasAvg = (rData && rData.avg !== null);
      const valStr = hasAvg ? `${rData.avg}<small>${cfg.unit}</small>` : '-';
      const countStr = hasAvg ? `${rData.count} evaluadas` : 'Sin registros';

      return `
        <div class="cat-avg-round-item">
          <span class="cat-avg-round-name">${r}° EVAL</span>
          <div class="cat-avg-round-num">${valStr}</div>
          <span class="cat-avg-round-count">${countStr}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="cat-avg-card">
        <div class="cat-avg-header">
          <div class="cat-avg-title-box">
            <span class="cat-avg-icon">${cfg.icon}</span>
            <div>
              <h4 class="cat-avg-name">${cfg.name}</h4>
              <span class="cat-avg-type">${cfg.type}</span>
            </div>
          </div>
          <div class="cat-avg-latest-val">
            <div class="cat-avg-num">${tData.latestAvg !== null ? tData.latestAvg : '-'}<small>${tData.latestAvg !== null ? cfg.unit : ''}</small></div>
            <div class="cat-avg-lbl">Media Actual</div>
          </div>
        </div>

        <div class="cat-avg-rounds-row">
          ${roundsHtml}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; flex-wrap:wrap; gap:6px;">
          <button type="button" class="btn-card-top10" data-test="${cfg.key}">
            🏆 Ver Top 10 en ${cfg.name}
          </button>
          ${diffBadgeHtml ? `<div>${diffBadgeHtml}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="cat-avg-intro">
      <div class="cat-avg-intro-title">
        <span>📊</span> Medias de Rendimiento: <strong>${escapeHtml(catData.label)}</strong>
      </div>
      <span class="cat-avg-count-badge">${catData.playerCount} Jugadoras</span>
    </div>
    <div class="cat-avg-grid">
      ${testCardsHtml}
    </div>
  `;

  // Listener para el botón directo al Top 10 de ese test
  container.querySelectorAll('.btn-card-top10').forEach(btn => {
    btn.addEventListener('click', () => {
      const tKey = btn.getAttribute('data-test');
      if (tKey) currentTop10Test = tKey;
      switchPhysicalViewMode('top10');
    });
  });
}

// ============================================================================
// TOP 10 Y RANKINGS POR EVALUACIÓN
// ============================================================================

// Obtener ranking ordenado de jugadoras para un test físico
function getRankedPlayersForTest(testKey, categoryFilter = 'all', roundFilter = 'latest') {
  const cfg = TESTS_CONFIG.find(c => c.key === testKey);
  if (!cfg || !physicalPlayers || physicalPlayers.length === 0) return [];

  const catPlayers = (categoryFilter === 'all')
    ? physicalPlayers
    : physicalPlayers.filter(p => p.filterTag === categoryFilter);

  const rankedList = [];

  catPlayers.forEach(p => {
    const pTest = p.tests ? p.tests[testKey] : null;
    if (!pTest || !pTest.evals || pTest.evals.length === 0) return;

    let targetEv = null;
    let evalCount = 1;
    let roundLabelTag = '';

    if (roundFilter === 'latest') {
      targetEv = pTest.evals[pTest.evals.length - 1];
      roundLabelTag = `${targetEv ? targetEv.round : 1}° Eval`;
    } else if (roundFilter === 'best') {
      let best = null;
      pTest.evals.forEach(ev => {
        if (typeof ev.value !== 'number') return;
        if (!best) {
          best = ev;
        } else if (cfg.higherIsBetter ? (ev.value > best.value) : (ev.value < best.value)) {
          best = ev;
        }
      });
      targetEv = best;
      roundLabelTag = `${best ? best.round : 1}° Eval (Mejor)`;
    } else if (roundFilter === 'avg') {
      const validEvals = pTest.evals.filter(ev => typeof ev.value === 'number');
      if (validEvals.length > 0) {
        const sum = validEvals.reduce((acc, ev) => acc + ev.value, 0);
        const avg = +(sum / validEvals.length).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
        targetEv = { value: avg, round: validEvals[validEvals.length - 1].round };
        evalCount = validEvals.length;
        roundLabelTag = validEvals.length > 1 ? `Promedio (${validEvals.length} evals)` : '1 eval';
      }
    } else {
      const rNum = parseInt(roundFilter, 10);
      targetEv = pTest.evals.find(ev => ev.round === rNum);
      roundLabelTag = `${rNum}° Eval`;
    }

    if (targetEv && typeof targetEv.value === 'number') {
      rankedList.push({
        id: p.id,
        name: p.name,
        divisionLabel: p.divisionLabel,
        filterTag: p.filterTag,
        value: targetEv.value,
        round: targetEv.round,
        evalCount,
        roundLabelTag
      });
    }
  });

  // Ordenar según el test (mayor o menor es mejor)
  if (cfg.higherIsBetter) {
    rankedList.sort((a, b) => b.value - a.value);
  } else {
    rankedList.sort((a, b) => a.value - b.value);
  }

  // Asignar puestos de ranking con desempate
  rankedList.forEach((item, idx) => {
    if (idx > 0 && item.value === rankedList[idx - 1].value) {
      item.rank = rankedList[idx - 1].rank;
    } else {
      item.rank = idx + 1;
    }
  });

  return rankedList;
}

// Obtener la posición de una jugadora en un test específico
function getPlayerRankInTest(playerId, testKey, categoryFilter = 'all', roundFilter = 'latest') {
  const ranked = getRankedPlayersForTest(testKey, categoryFilter, roundFilter);
  const found = ranked.find(p => p.id === playerId);
  return found ? { rank: found.rank, total: ranked.length, value: found.value } : null;
}

// Renderizar Panel de Top 10 por Evaluación
function renderTop10Panel() {
  const container = document.getElementById('physTop10Panel');
  if (!container) return;

  if (!physicalPlayers || physicalPlayers.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #9bb1d6; padding: 24px;">No hay evaluaciones físicas disponibles para calcular el Top 10.</div>';
    return;
  }

  let scopeLabel = 'Todo el Plantel';
  if (currentPhysFilter === '1ra') scopeLabel = '1ra División';
  if (currentPhysFilter === 'Inter') scopeLabel = 'Intermedia';
  if (currentPhysFilter === '5ta') scopeLabel = '5ta División';

  let roundLabel = 'Última Evaluación';
  if (currentTop10Round === 'best') roundLabel = 'Mejor Marca';
  if (currentTop10Round === 'avg') roundLabel = 'Promedio de Evaluaciones';
  if (currentTop10Round === '1') roundLabel = '1° Evaluación';
  if (currentTop10Round === '2') roundLabel = '2° Evaluación';
  if (currentTop10Round === '3') roundLabel = '3° Evaluación';

  // Pills de Tests
  const testPillsHtml = `
    <div class="top10-test-pills" id="top10TestPills">
      <button type="button" class="top10-test-pill ${currentTop10Test === 'all' ? 'active' : ''}" data-test="all">
        <span>📋</span> Todos los Tests
      </button>
      ${TESTS_CONFIG.map(cfg => `
        <button type="button" class="top10-test-pill ${currentTop10Test === cfg.key ? 'active' : ''}" data-test="${cfg.key}">
          <span>${cfg.icon}</span> ${cfg.name}
        </button>
      `).join('')}
    </div>
  `;

  // Barra de Selector de Ronda
  const roundBarHtml = `
    <div class="top10-round-bar">
      <span class="top10-round-label">Medición:</span>
      <div class="top10-round-pills" id="top10RoundPills">
        <button type="button" class="top10-round-pill ${currentTop10Round === 'latest' ? 'active' : ''}" data-round="latest">Última</button>
        <button type="button" class="top10-round-pill ${currentTop10Round === 'best' ? 'active' : ''}" data-round="best">Mejor Marca</button>
        <button type="button" class="top10-round-pill ${currentTop10Round === 'avg' ? 'active' : ''}" data-round="avg">Promedio</button>
        <button type="button" class="top10-round-pill ${currentTop10Round === '1' ? 'active' : ''}" data-round="1">1° Eval</button>
        <button type="button" class="top10-round-pill ${currentTop10Round === '2' ? 'active' : ''}" data-round="2">2° Eval</button>
        <button type="button" class="top10-round-pill ${currentTop10Round === '3' ? 'active' : ''}" data-round="3">3° Eval</button>
      </div>
    </div>
  `;

  // Tests a mostrar
  const testsToDisplay = (currentTop10Test === 'all')
    ? TESTS_CONFIG
    : TESTS_CONFIG.filter(cfg => cfg.key === currentTop10Test);

  const cardsHtml = testsToDisplay.map(cfg => {
    const fullRanked = getRankedPlayersForTest(cfg.key, currentPhysFilter, currentTop10Round);
    const top10 = fullRanked.slice(0, 10);

    let itemsHtml = '';
    if (top10.length === 0) {
      itemsHtml = '<div style="text-align: center; color: #9bb1d6; font-size: 0.8rem; padding: 14px;">No hay mediciones registradas en esta evaluación para el filtro actual.</div>';
    } else {
      itemsHtml = top10.map(item => {
        let rankClass = 'rank-other';
        let rankIcon = `#${item.rank}`;
        if (item.rank === 1) {
          rankClass = 'rank-1';
          rankIcon = '🥇';
        } else if (item.rank === 2) {
          rankClass = 'rank-2';
          rankIcon = '🥈';
        } else if (item.rank === 3) {
          rankClass = 'rank-3';
          rankIcon = '🥉';
        }

        let badgeClass = 'badge-1ra';
        if (item.filterTag === 'Inter') badgeClass = 'badge-inter';
        if (item.filterTag === '5ta') badgeClass = 'badge-5ta';

        return `
          <div class="top10-item" data-player-id="${item.id}" title="Ver ficha de ${escapeHtml(item.name)}">
            <div class="top10-rank-box">
              <span class="top10-rank-badge ${rankClass}">${rankIcon}</span>
              <div class="top10-player-info">
                <span class="top10-player-name">${escapeHtml(item.name)}</span>
                <div class="top10-player-meta">
                  <span class="suggest-player-badge ${badgeClass}">${item.divisionLabel}</span>
                  <span class="top10-round-tag">${escapeHtml(item.roundLabelTag || (item.round + '° Eval'))}</span>
                </div>
              </div>
            </div>
            <div class="top10-val-box">
              <div class="top10-val-num">${item.value}<small>${cfg.unit}</small></div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="top10-card">
        <div class="top10-card-header">
          <div class="top10-card-title">
            <span class="top10-icon">${cfg.icon}</span>
            <div>
              <h4 class="top10-name">${cfg.name}</h4>
              <span class="top10-type">${cfg.type}</span>
            </div>
          </div>
          <span class="top10-scope-badge">${escapeHtml(scopeLabel)} • ${top10.length} clasificadas</span>
        </div>
        <div class="top10-items-list">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="top10-header-card">
      <span class="top10-badge">🏆 TABLA DE LÍDERES</span>
      <h3 class="top10-title">TOP 10 POR EVALUACIÓN</h3>
      <p class="top10-subtitle">Las mejores marcas físicas para <strong>${escapeHtml(scopeLabel)}</strong> (${roundLabel}). Tocá cualquier jugadora para ver su perfil completo.</p>
    </div>
    ${testPillsHtml}
    ${roundBarHtml}
    <div class="top10-grid">
      ${cardsHtml}
    </div>
  `;

  // Listeners de Selección de Test
  const pillsContainer = document.getElementById('top10TestPills');
  if (pillsContainer) {
    pillsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.top10-test-pill');
      if (!btn) return;
      currentTop10Test = btn.getAttribute('data-test') || 'all';
      renderTop10Panel();
    });
  }

  // Listeners de Selección de Ronda
  const roundContainer = document.getElementById('top10RoundPills');
  if (roundContainer) {
    roundContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.top10-round-pill');
      if (!btn) return;
      currentTop10Round = btn.getAttribute('data-round') || 'latest';
      renderTop10Panel();
    });
  }

  // Listeners para abrir la ficha de la jugadora al hacer clic en el Top 10
  container.querySelectorAll('.top10-item').forEach(el => {
    el.addEventListener('click', () => {
      const pId = el.getAttribute('data-player-id');
      if (pId) {
        switchPhysicalViewMode('players');
        selectPlayer(pId);
      }
    });
  });
}

// Cargar y Parsear Planilla de Evaluaciones Físicas
async function loadPhysicalEvaluations(manual = false) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${PHYSICAL_SPREADSHEET_ID}/gviz/tq?tqx=out:json&_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const match = text.match(/setResponse\(([\s\S]+)\);/);
    if (!match) throw new Error('Formato inválido de Google Sheets');
    const json = JSON.parse(match[1]);
    const table = json.table;

    if (!table || !table.rows) return;

    const parsed = [];
    table.rows.forEach((r, idx) => {
      if (!r || !r.c) return;
      const c0 = r.c[0] ? (r.c[0].f || r.c[0].v || '').toString().trim() : '';
      const c1 = r.c[1] ? (r.c[1].f || r.c[1].v || '').toString().trim() : '';
      const c2 = r.c[2] ? (r.c[2].f || r.c[2].v || '').toString().trim() : '';

      if (!c2 || c2.toLowerCase().includes('apellido') || c0.toLowerCase().includes('promedio') || c0.toLowerCase().includes('categoria') || c2.length <= 1) {
        return;
      }

      // Etiqueta de división y filtro
      let divLabel = '1ra División';
      let filterTag = '1ra';

      const normC0 = c0.toLowerCase();
      const normC1 = c1.toLowerCase();

      if (normC0.includes('5ta') || normC0.includes('quinta')) {
        divLabel = '5ta División';
        filterTag = '5ta';
      } else if (normC1.includes('inter')) {
        divLabel = 'Intermedia';
        filterTag = 'Inter';
      } else {
        divLabel = '1ra División';
        filterTag = '1ra';
      }

      const tests = {};

      TESTS_CONFIG.forEach(cfg => {
        const evals = cfg.cols.map(cIdx => {
          if (!r.c[cIdx]) return null;
          return parseCellValue(r.c[cIdx].f || r.c[cIdx].v);
        });

        const validEvals = [];
        evals.forEach((ev, i) => {
          if (ev !== null) {
            validEvals.push({ round: i + 1, value: ev });
          }
        });

        if (validEvals.length > 0) {
          let diff = null;
          let diffPct = null;
          let improved = null;

          if (validEvals.length >= 2) {
            const first = validEvals[0].value;
            const last = validEvals[validEvals.length - 1].value;
            diff = +(last - first).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
            diffPct = first !== 0 ? +((diff / first) * 100).toFixed(1) : 0;
            improved = cfg.higherIsBetter ? (diff > 0) : (diff < 0);
          }

          tests[cfg.key] = {
            config: cfg,
            evals: validEvals,
            diff,
            diffPct,
            improved
          };
        }
      });

      parsed.push({
        id: 'p_' + idx,
        name: c2,
        division: c0 || 'PS',
        rama: c1 || 'B',
        divisionLabel: divLabel,
        filterTag,
        testsCount: Object.keys(tests).length,
        tests
      });
    });

    if (parsed.length > 0) {
      physicalPlayers = parsed;
      try {
        localStorage.setItem(PHYSICAL_STORAGE_KEY, JSON.stringify(physicalPlayers));
      } catch (e) {}

      // Calcular medias por categoría
      physicalCategoryAverages = calculateCategoryAverages();

      // Actualizar vista activa
      if (currentPhysViewMode === 'averages') {
        renderCategoryAverages(currentPhysFilter);
      } else if (currentPhysViewMode === 'top10') {
        renderTop10Panel();
      } else if (selectedPlayerId) {
        const p = physicalPlayers.find(pl => pl.id === selectedPlayerId);
        if (p) renderPlayerCard(p);
      } else {
        renderPhysicalSuggestions();
      }

      if (manual) {
        showToast('¡Evaluaciones físicas sincronizadas!');
      }
    }
  } catch (e) {
    console.warn('Error cargando evaluaciones físicas:', e);
  }
}

// Limpiar valores numéricos con comas
function parseCellValue(val) {
  if (val === null || val === undefined) return null;
  const str = val.toString().trim().replace(',', '.');
  if (str === '' || str.includes('#') || str === '-') return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// Renderizar Lista de Sugerencias de Jugadoras
function renderPhysicalSuggestions(query = '') {
  const container = document.getElementById('playersSuggestList');
  if (!container) return;

  const normQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = physicalPlayers.filter(p => {
    // Filtro por Chip
    if (currentPhysFilter !== 'all' && p.filterTag !== currentPhysFilter) {
      return false;
    }
    // Filtro por Búsqueda
    if (normQuery) {
      const normName = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normName.includes(normQuery);
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #9bb1d6; font-size: 0.8rem; padding: 16px;">No se encontraron jugadoras para esta búsqueda.</div>';
    return;
  }

  // Ordenar alfabéticamente
  filtered.sort((a, b) => a.name.localeCompare(b.name));

  container.innerHTML = filtered.map(p => {
    let badgeClass = 'badge-1ra';
    if (p.filterTag === 'Inter') badgeClass = 'badge-inter';
    if (p.filterTag === '5ta') badgeClass = 'badge-5ta';

    return `
      <div class="suggest-player-item" data-id="${p.id}">
        <span class="suggest-player-name">${escapeHtml(p.name)}</span>
        <span class="suggest-player-badge ${badgeClass}">${p.divisionLabel}</span>
      </div>
    `;
  }).join('');

  // Event Listeners para cada jugadora sugerida
  container.querySelectorAll('.suggest-player-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      selectPlayer(id);
    });
  });
}

// Seleccionar Jugadora y mostrar ficha
function selectPlayer(id) {
  const p = physicalPlayers.find(pl => pl.id === id);
  if (!p) return;

  selectedPlayerId = id;
  renderPlayerCard(p);

  const profileCard = document.getElementById('playerProfileCard');
  const emptyState = document.getElementById('emptyPlayerState');
  const suggestList = document.getElementById('playersSuggestList');

  if (profileCard) profileCard.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';
  if (suggestList) suggestList.style.display = 'none';

  // Scroll suave hacia la ficha en móviles
  profileCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================================
// PERFIL ATLÉTICO INTEGRAL (RADAR)
// ============================================================================

const RADAR_DIMENSIONS = [
  { key: 'velocidad', name: 'Velocidad', icon: '💨', tests: ['sprint'] },
  { key: 'potencia', name: 'Salto / Pot.', icon: '🚀', tests: ['cmj', 'broadJump', 'platform'] },
  { key: 'fuerzaSup', name: 'Fuerza Sup.', icon: '🏋️‍♀️', tests: ['bench'] },
  { key: 'fuerzaInf', name: 'Fuerza Inf.', icon: '🦵', tests: ['squat', 'deadlift'] },
  { key: 'resistencia', name: 'Resistencia', icon: '🫁', tests: ['yoyo'] },
  { key: 'agilidad', name: 'Agilidad', icon: '⏱️', tests: ['agility'] }
];

function getRadarTestMinMax(testKey, category = 'all') {
  if (!physicalPlayers || physicalPlayers.length === 0) return { min: 0, max: 100 };
  const catPlayers = (category === 'all')
    ? physicalPlayers
    : physicalPlayers.filter(p => p.filterTag === category);

  const pool = (catPlayers.length >= 3) ? catPlayers : physicalPlayers;
  const values = [];

  pool.forEach(p => {
    const t = p.tests ? p.tests[testKey] : null;
    if (!t || !t.evals || t.evals.length === 0) return;
    const lastEv = t.evals[t.evals.length - 1];
    if (lastEv && typeof lastEv.value === 'number') {
      values.push(lastEv.value);
    }
  });

  if (values.length === 0) return { min: 0, max: 100 };
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function getRadarTestScore(testKey, val, category = 'all') {
  const cfg = TESTS_CONFIG.find(c => c.key === testKey);
  if (!cfg || typeof val !== 'number') return 50;

  const { min, max } = getRadarTestMinMax(testKey, category);
  if (max === min) return 70;

  let ratio;
  if (cfg.higherIsBetter) {
    ratio = (val - min) / (max - min);
  } else {
    ratio = (max - val) / (max - min);
  }
  ratio = Math.max(0, Math.min(1, ratio));
  return Math.round(32 + ratio * 64);
}

function getPlayerDimensionScore(player, dim, category = 'all') {
  const testScores = [];
  dim.tests.forEach(tKey => {
    const pTest = player.tests ? player.tests[tKey] : null;
    if (pTest && pTest.evals && pTest.evals.length > 0) {
      const lastEv = pTest.evals[pTest.evals.length - 1];
      if (lastEv && typeof lastEv.value === 'number') {
        testScores.push(getRadarTestScore(tKey, lastEv.value, category));
      }
    }
  });

  if (testScores.length > 0) {
    const sum = testScores.reduce((a, b) => a + b, 0);
    return Math.round(sum / testScores.length);
  }
  return 50;
}

function getCategoryDimensionScore(category, dim) {
  const catPlayers = (category === 'all')
    ? physicalPlayers
    : physicalPlayers.filter(p => p.filterTag === category);

  const pool = (catPlayers.length > 0) ? catPlayers : physicalPlayers;
  const scores = [];

  pool.forEach(p => {
    scores.push(getPlayerDimensionScore(p, dim, category));
  });

  if (scores.length === 0) return 50;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function renderPlayerRadar(player, category = 'all', scopeName = '1ra División', scopeShort = '1ra') {
  const container = document.getElementById('playerRadarCard');
  if (!container) return;

  const numAxes = RADAR_DIMENSIONS.length;
  const cx = 175;
  const cy = 155;
  const r = 85;

  const playerDimScores = RADAR_DIMENSIONS.map((dim, i) => {
    const score = getPlayerDimensionScore(player, dim, category);
    return { dim, score, index: i };
  });

  const catDimScores = RADAR_DIMENSIONS.map((dim, i) => {
    const score = getCategoryDimensionScore(category, dim);
    return { dim, score, index: i };
  });

  const playerOverall = Math.round(playerDimScores.reduce((acc, s) => acc + s.score, 0) / numAxes);
  const catOverall = Math.round(catDimScores.reduce((acc, s) => acc + s.score, 0) / numAxes);

  const sortedScores = [...playerDimScores].sort((a, b) => b.score - a.score);
  const topDim = sortedScores[0];
  const lowDim = sortedScores[sortedScores.length - 1];

  const gridLevels = [0.25, 0.50, 0.75, 1.00];
  const gridPolygonsHtml = gridLevels.map(lvl => {
    const pts = RADAR_DIMENSIONS.map((d, i) => {
      const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
      const x = cx + (r * lvl) * Math.cos(angleRad);
      const y = cy + (r * lvl) * Math.sin(angleRad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const strokeOp = lvl === 1.0 ? '0.25' : '0.12';
    return `<polygon points="${pts}" fill="none" stroke="rgba(255, 255, 255, ${strokeOp})" stroke-width="1"/>`;
  }).join('');

  const gridSpokesHtml = RADAR_DIMENSIONS.map((d, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const x = cx + r * Math.cos(angleRad);
    const y = cy + r * Math.sin(angleRad);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>`;
  }).join('');

  const catPoints = catDimScores.map((s, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const radius = r * (s.score / 100);
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const playerPointsArr = playerDimScores.map((s, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const radius = r * (s.score / 100);
    const x = cx + radius * Math.cos(angleRad);
    const y = cy + radius * Math.sin(angleRad);
    return { x, y, score: s.score, dim: s.dim };
  });

  const playerPoints = playerPointsArr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const playerDotsHtml = playerPointsArr.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5"/>
  `).join('');

  const labelsHtml = RADAR_DIMENSIONS.map((d, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    let anchor = 'middle';
    if (cos > 0.25) anchor = 'start';
    else if (cos < -0.25) anchor = 'end';

    const lx = cx + (r + 26) * cos;
    let ly = cy + (r + 26) * sin;
    if (sin < -0.7) ly -= 4;
    if (sin > 0.7) ly += 8;

    const pScore = playerDimScores[i].score;

    return `
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" class="radar-axis-label">
        ${d.icon} ${d.name}
        <tspan x="${lx.toFixed(1)}" dy="12" class="radar-axis-score">${pScore} pts</tspan>
      </text>
    `;
  }).join('');

  container.innerHTML = `
    <div class="radar-header">
      <div class="radar-title-box">
        <span style="font-size: 1.15rem;">🕸️</span>
        <h4 class="radar-title">PERFIL ATLÉTICO INTEGRAL</h4>
      </div>
      <span class="radar-score-badge">Índice: ${playerOverall} / 100</span>
    </div>

    <div class="radar-chart-wrapper">
      <svg class="radar-svg" viewBox="0 0 350 310" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="radarRadialGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="playerPolyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00a2ff" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.35"/>
          </linearGradient>
        </defs>

        <!-- Fondo sutil con brillo central -->
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#radarRadialGlow)"/>

        <!-- Rejilla concéntrica -->
        ${gridPolygonsHtml}

        <!-- Ejes radiales -->
        ${gridSpokesHtml}

        <!-- Polígono Media Categoría -->
        <polygon points="${catPoints}" fill="rgba(148, 163, 184, 0.12)" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,3"/>

        <!-- Polígono Jugadora -->
        <polygon points="${playerPoints}" fill="url(#playerPolyGrad)" stroke="var(--color-regatas-cyan)" stroke-width="2.5"/>

        <!-- Vértices Jugadora -->
        ${playerDotsHtml}

        <!-- Etiquetas de Dimensiones -->
        ${labelsHtml}
      </svg>
    </div>

    <!-- Leyenda -->
    <div class="radar-legend">
      <div class="radar-legend-item">
        <span class="radar-legend-dot player"></span>
        <span>${escapeHtml(player.name.split(' ')[0])} (${playerOverall} pts)</span>
      </div>
      <div class="radar-legend-item">
        <span class="radar-legend-dot category"></span>
        <span>Media ${escapeHtml(scopeShort)} (${catOverall} pts)</span>
      </div>
    </div>

    <!-- Insights -->
    <div class="radar-insights-bar">
      <div class="radar-insight-box">
        <span class="radar-insight-lbl strength">🌟 Mayor Fortaleza</span>
        <span class="radar-insight-val">${topDim.dim.icon} ${topDim.dim.name} <small>(${topDim.score} pts)</small></span>
      </div>
      <div class="radar-insight-box">
        <span class="radar-insight-lbl focus">🎯 A Trabajar</span>
        <span class="radar-insight-val">${lowDim.dim.icon} ${lowDim.dim.name} <small>(${lowDim.score} pts)</small></span>
      </div>
    </div>
  `;
}

// Renderizar Perfil y Comparativas de la Jugadora vs Medias de Cada Evaluación
function renderPlayerCard(player) {
  const nameEl = document.getElementById('profilePlayerName');
  const initialEl = document.getElementById('profileInitial');
  const divEl = document.getElementById('profilePlayerDiv');
  const countEl = document.getElementById('profilePlayerTestsCount');
  const testsGrid = document.getElementById('testsGrid');
  const summaryText = document.getElementById('profileSummaryText');

  if (nameEl) nameEl.textContent = player.name;
  if (initialEl) initialEl.textContent = (player.name.trim().charAt(0) || 'P').toUpperCase();
  if (divEl) divEl.textContent = player.divisionLabel;

  const testKeys = Object.keys(player.tests);
  if (countEl) countEl.textContent = `${testKeys.length} Tests Evaluados`;

  // Asegurar medias de categorías calculadas
  if (!physicalCategoryAverages) {
    physicalCategoryAverages = calculateCategoryAverages();
  }

  // Determinar categoría para la comparativa
  const isCatScope = (currentPhysBenchmarkScope !== 'all');
  const benchCatKey = isCatScope ? (player.filterTag || '1ra') : 'all';
  const benchScopeName = isCatScope ? player.divisionLabel : 'Todo el Plantel';
  const benchScopeShort = isCatScope ? (player.filterTag === 'Inter' ? 'Inter' : (player.filterTag === '5ta' ? '5ta' : '1ra')) : 'Plantel';
  const catBenchmark = physicalCategoryAverages ? physicalCategoryAverages[benchCatKey] : null;

  // Actualizar estado visual de los botones de alcance de comparativa
  const pillCat = document.getElementById('btnBenchCategory');
  const pillAll = document.getElementById('btnBenchAll');
  if (pillCat) pillCat.classList.toggle('active', isCatScope);
  if (pillAll) pillAll.classList.toggle('active', !isCatScope);

  // Contar mejoras personales y marcas que superan la media
  let improvedCount = 0;
  let comparableCount = 0;
  let aboveAvgCount = 0;
  let benchCount = 0;

  testKeys.forEach(k => {
    const t = player.tests[k];
    const cfg = t.config;
    const evals = t.evals || [];

    if (evals.length >= 2) {
      comparableCount++;
      if (t.improved) improvedCount++;
    }

    if (evals.length > 0 && catBenchmark) {
      const lastEval = evals[evals.length - 1];
      const catTest = catBenchmark.tests[k];
      const catRoundAvg = (catTest?.rounds[lastEval.round]?.avg !== null && catTest?.rounds[lastEval.round]?.avg !== undefined)
        ? catTest.rounds[lastEval.round].avg
        : catTest?.latestAvg;

      if (catRoundAvg !== null && catRoundAvg !== undefined) {
        benchCount++;
        const diff = +(lastEval.value - catRoundAvg).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
        const isSuperior = cfg.higherIsBetter ? (diff > 0) : (diff < 0);
        if (isSuperior) aboveAvgCount++;
      }
    }
  });

  if (summaryText) {
    const summaryParts = [];
    if (comparableCount > 0) {
      summaryParts.push(`📈 <strong>${improvedCount}/${comparableCount}</strong> tests con superación personal`);
    }
    if (benchCount > 0) {
      summaryParts.push(`⭐ <strong>${aboveAvgCount}/${benchCount}</strong> superan la media (${benchScopeShort})`);
    }
    summaryText.innerHTML = summaryParts.length > 0
      ? summaryParts.join(' &nbsp;•&nbsp; ')
      : 'Mediciones físicas registradas.';
  }

  // Renderizar Radar de Perfil Atlético Integral
  renderPlayerRadar(player, benchCatKey, benchScopeName, benchScopeShort);

  if (!testsGrid) return;

  if (testKeys.length === 0) {
    testsGrid.innerHTML = '<div style="text-align: center; color: #9bb1d6; padding: 20px;">Esta jugadora aún no tiene mediciones cargadas en la planilla.</div>';
    return;
  }

  // Renderizar cada test físico con comparativa de media por cada evaluación
  testsGrid.innerHTML = testKeys.map(k => {
    const t = player.tests[k];
    const cfg = t.config;
    const evals = t.evals || [];
    const unit = cfg.unit ? ` ${cfg.unit}` : '';

    // Ranking en Top 10 si corresponde
    let rankPillHtml = '';
    const rankInfo = getPlayerRankInTest(player.id, k, benchCatKey, 'latest');
    if (rankInfo && rankInfo.rank <= 10) {
      let rankClass = 'rank-other';
      let medal = '🏆';
      if (rankInfo.rank === 1) { rankClass = 'rank-1'; medal = '🥇'; }
      else if (rankInfo.rank === 2) { rankClass = 'rank-2'; medal = '🥈'; }
      else if (rankInfo.rank === 3) { rankClass = 'rank-3'; medal = '🥉'; }
      rankPillHtml = `<span class="test-top10-pill ${rankClass}" title="Posición #${rankInfo.rank} de ${rankInfo.total} en ${benchScopeName}">${medal} #${rankInfo.rank} en ${benchScopeShort}</span>`;
    }

    // Badge de Evolución Personal
    let diffBadgeHtml = '';
    if (evals.length >= 2) {
      const sign = t.diff > 0 ? '+' : '';
      const pctSign = t.diffPct > 0 ? '+' : '';
      if (t.improved) {
        diffBadgeHtml = `<span class="test-diff-badge positive">${sign}${t.diff}${unit} (${pctSign}${t.diffPct}%) ↗</span>`;
      } else if (t.diff === 0) {
        diffBadgeHtml = `<span class="test-diff-badge neutral">= Sin variación</span>`;
      } else {
        diffBadgeHtml = `<span class="test-diff-badge negative">${sign}${t.diff}${unit} (${pctSign}${t.diffPct}%) ↘</span>`;
      }
    } else {
      diffBadgeHtml = `<span class="test-diff-badge info">1° Medición</span>`;
    }

    // Promedio Personal de la Jugadora
    let avgPillHtml = '';
    const validEvalsForAvg = evals.filter(e => typeof e.value === 'number');
    if (validEvalsForAvg.length > 0) {
      const sumEvals = validEvalsForAvg.reduce((acc, ev) => acc + ev.value, 0);
      const personalAvg = +(sumEvals / validEvalsForAvg.length).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
      avgPillHtml = `<span class="test-diff-badge info" style="background: rgba(0, 162, 255, 0.15); border-color: rgba(0, 162, 255, 0.4); color: #38bdf8;">Promedio: <strong>${personalAvg}${unit}</strong></span>`;
    }

    // Fila de Cajas de Evaluación (con subtítulo de media de cada evaluación por categoría)
    const evalsBoxesHtml = evals.map((ev, i) => {
      const isLast = (i === evals.length - 1 && evals.length > 1);
      const highlightClass = isLast ? 'highlight' : '';
      const arrowHtml = (i < evals.length - 1) ? '<div class="eval-arrow">➔</div>' : '';

      // Media de esta evaluación específica
      let avgSubHtml = '';
      const catTest = catBenchmark ? catBenchmark.tests[k] : null;
      const rAvg = catTest?.rounds[ev.round]?.avg;
      if (rAvg !== null && rAvg !== undefined) {
        const rDiff = +(ev.value - rAvg).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
        const isBetter = cfg.higherIsBetter ? (rDiff >= 0) : (rDiff <= 0);
        const rSign = rDiff > 0 ? '+' : '';
        const rColor = isBetter ? '#34d399' : '#f87171';
        avgSubHtml = `
          <span class="eval-box-avg" title="Media de ${benchScopeName}: ${rAvg}${cfg.unit}">
            Media ${benchScopeShort}: <strong style="color: #ffffff;">${rAvg}</strong>
            <span style="color: ${rColor}; font-size: 0.62rem; margin-left: 2px;">(${rSign}${rDiff})</span>
          </span>
        `;
      }

      return `
        <div class="eval-box ${highlightClass}">
          <span class="eval-label">${ev.round}° EVALUACIÓN</span>
          <span class="eval-val">${ev.value}<small>${cfg.unit}</small></span>
          ${avgSubHtml}
        </div>
        ${arrowHtml}
      `;
    }).join('');

    // Barra de Progreso Personal (si hay 2+ evaluaciones)
    let progressBarHtml = '';
    if (evals.length >= 2) {
      const values = evals.map(e => e.value);
      const maxVal = Math.max(...values) * 1.08;
      
      const barsHtml = evals.map((ev, i) => {
        const isLast = (i === evals.length - 1);
        let fillClass = 'fill-first';
        if (isLast) {
          fillClass = t.improved ? 'fill-improved' : 'fill-declined';
        }
        const widthPct = Math.min(100, Math.max(15, (ev.value / maxVal) * 100));

        return `
          <div style="margin-bottom: 4px;">
            <div style="display:flex; justify-content:space-between; font-size:0.68rem; margin-bottom:2px; color:#9bb1d6;">
              <span>${ev.round}° Eval</span>
              <span style="font-weight:700; color:#ffffff;">${ev.value}${unit}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${fillClass}" style="width: ${widthPct.toFixed(1)}%;"></div>
            </div>
          </div>
        `;
      }).join('');

      progressBarHtml = `
        <div class="progress-bar-container">
          ${barsHtml}
        </div>
      `;
    }

    // Box Comparativo Benchmark vs Media de la Categoría
    let benchmarkHtml = '';
    const lastEval = evals[evals.length - 1];
    const catTest = catBenchmark ? catBenchmark.tests[k] : null;
    const catRefAvg = (lastEval && catTest?.rounds[lastEval.round]?.avg !== null && catTest?.rounds[lastEval.round]?.avg !== undefined)
      ? catTest.rounds[lastEval.round].avg
      : catTest?.latestAvg;

    if (lastEval && catRefAvg !== null && catRefAvg !== undefined) {
      const playerVal = lastEval.value;
      const benchDiff = +(playerVal - catRefAvg).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);
      const benchDiffAbs = Math.abs(benchDiff);
      const benchPct = catRefAvg !== 0 ? +((benchDiffAbs / catRefAvg) * 100).toFixed(1) : 0;
      const isSuperior = cfg.higherIsBetter ? (benchDiff > 0) : (benchDiff < 0);
      const isIdentical = (benchDiff === 0);

      let bClass = 'positive';
      let bText = '';

      if (isIdentical) {
        bClass = 'neutral';
        bText = '= Igual a la media';
      } else if (isSuperior) {
        bClass = 'positive';
        if (cfg.higherIsBetter) {
          bText = `+${benchDiffAbs}${unit} (+${benchPct}%) Supera media`;
        } else {
          bText = `-${benchDiffAbs}${unit} (${benchPct}% más rápida)`;
        }
      } else {
        bClass = 'warning';
        if (cfg.higherIsBetter) {
          bText = `-${benchDiffAbs}${unit} (-${benchPct}%) Bajo la media`;
        } else {
          bText = `+${benchDiffAbs}${unit} (${benchPct}% sobre la media)`;
        }
      }

      const maxRef = Math.max(playerVal, catRefAvg) * 1.12;
      const playerWidthPct = Math.min(100, Math.max(12, (playerVal / maxRef) * 100));
      const avgWidthPct = Math.min(100, Math.max(12, (catRefAvg / maxRef) * 100));
      const playerFillClass = isSuperior ? 'player-better' : 'player-regular';

      benchmarkHtml = `
        <div class="test-benchmark-box">
          <div class="benchmark-header">
            <div class="benchmark-title">
              <span>📊</span> Comparativa vs Media (${benchScopeName})
            </div>
            <span class="benchmark-badge ${bClass}">${bText}</span>
          </div>
          <div class="benchmark-bars-wrapper">
            <div class="benchmark-bar-row">
              <span class="benchmark-bar-lbl">Jugadora:</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar-fill ${playerFillClass}" style="width: ${playerWidthPct.toFixed(1)}%;"></div>
              </div>
              <span class="benchmark-bar-val">${playerVal}${unit}</span>
            </div>
            <div class="benchmark-bar-row">
              <span class="benchmark-bar-lbl">Media ${benchScopeShort}:</span>
              <div class="benchmark-bar-track">
                <div class="benchmark-bar-fill average-ref" style="width: ${avgWidthPct.toFixed(1)}%;"></div>
              </div>
              <span class="benchmark-bar-val">${catRefAvg}${unit}</span>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="test-card">
        <div class="test-card-header">
          <div class="test-title-group">
            <span class="test-icon">${cfg.icon}</span>
            <div>
              <h4 class="test-name">${cfg.name}</h4>
              <span class="test-type">${cfg.type}</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            ${rankPillHtml}
            ${avgPillHtml}
            ${diffBadgeHtml}
          </div>
        </div>

        <div class="test-evals-row">
          ${evalsBoxesHtml}
        </div>

        ${progressBarHtml}

        ${benchmarkHtml}
      </div>
    `;
  }).join('');
}

// Toast
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2600);
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// COMPARTIR FICHA DE RENDIMIENTO FÍSICO (WHATSAPP E IMAGEN)
// ============================================================================

function sharePlayerProfileWhatsApp(player) {
  if (!player) return;

  const isCatScope = (currentPhysBenchmarkScope !== 'all');
  const benchCatKey = isCatScope ? (player.filterTag || '1ra') : 'all';
  const benchScopeShort = isCatScope ? (player.filterTag === 'Inter' ? 'Inter' : (player.filterTag === '5ta' ? '5ta' : '1ra')) : 'Plantel';

  // Dimensiones del Radar para calcular puntaje global y fortaleza
  const playerDimScores = RADAR_DIMENSIONS.map(d => ({
    dim: d,
    score: getPlayerDimensionScore(player, d, benchCatKey)
  }));
  const playerOverall = Math.round(playerDimScores.reduce((acc, s) => acc + s.score, 0) / RADAR_DIMENSIONS.length);
  const topDim = [...playerDimScores].sort((a, b) => b.score - a.score)[0];

  // Líneas de cada test
  const testLines = [];
  let improvedCount = 0;
  let comparableCount = 0;

  TESTS_CONFIG.forEach(cfg => {
    const t = player.tests ? player.tests[cfg.key] : null;
    if (!t || !t.evals || t.evals.length === 0) return;

    const validEvals = t.evals.filter(e => typeof e.value === 'number');
    if (validEvals.length === 0) return;

    const unit = cfg.unit ? ` ${cfg.unit}` : '';
    const u = cfg.unit ? (cfg.unit === 'seg' ? 's' : (cfg.unit === ' ' ? '' : cfg.unit)) : '';

    const sum = validEvals.reduce((acc, ev) => acc + ev.value, 0);
    const avgVal = +(sum / validEvals.length).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);

    if (validEvals.length >= 2) {
      comparableCount++;
      if (t.improved) improvedCount++;
    }

    let diffTag = '';
    if (t.diff !== null) {
      const sign = t.diff > 0 ? '+' : '';
      const arrow = t.improved ? '↗' : '↘';
      diffTag = ` (${sign}${t.diff}${u} ${arrow})`;
    }

    let rankTag = '';
    const rankInfo = getPlayerRankInTest(player.id, cfg.key, benchCatKey, 'avg') || getPlayerRankInTest(player.id, cfg.key, benchCatKey, 'latest');
    if (rankInfo && rankInfo.rank <= 10) {
      const medal = rankInfo.rank === 1 ? '🥇' : (rankInfo.rank === 2 ? '🥈' : (rankInfo.rank === 3 ? '🥉' : '🏆'));
      rankTag = ` | ${medal} #${rankInfo.rank} en ${benchScopeShort}`;
    }

    if (validEvals.length > 1) {
      const evalsStr = validEvals.map(ev => `${ev.round}°: ${ev.value}${u}`).join(' • ');
      testLines.push(
        `• ${cfg.icon} *${cfg.name}*\n` +
        `   ├ 📋 *Evaluaciones:* ${evalsStr}\n` +
        `   └ ⚡ *Promedio: ${avgVal}${unit}*${diffTag}${rankTag}`
      );
    } else {
      testLines.push(
        `• ${cfg.icon} *${cfg.name}:* ${validEvals[0].value}${unit} *(Promedio: ${avgVal}${unit})*${rankTag}`
      );
    }
  });

  let progressText = '';
  if (comparableCount > 0) {
    progressText = `\n📈 *Evolución:* ${improvedCount} de ${comparableCount} tests con superación personal.`;
  }

  const msg = [
    `🏑 *CLUB REGATAS ANDINO • HOCKEY*`,
    `📋 *FICHA DE EVALUACIÓN FÍSICA*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Jugadora:* ${player.name}`,
    `🎽 *División:* ${player.divisionLabel}`,
    `⚡ *Índice Atlético:* ${playerOverall} / 100`,
    `🌟 *Mayor Fortaleza:* ${topDim.dim.icon} ${topDim.dim.name} (${topDim.score} pts)`,
    ``,
    `📊 *MEDICIONES REGISTRADAS:*`,
    testLines.join('\n'),
    progressText,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `🔵⚪ *Club Regatas Andino • Temporada 2026*`
  ].filter(line => line !== '').join('\n');

  // Intentar copiar al portapapeles
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).catch(() => {});
  }

  // Abrir WhatsApp con el mensaje codificado
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
  showToast('¡Abriendo WhatsApp y ficha copiada al portapapeles!');
}

function generateAndSharePlayerImage(player) {
  if (!player) return;

  const canvas = document.createElement('canvas');
  canvas.width = 840;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isCatScope = (currentPhysBenchmarkScope !== 'all');
  const benchCatKey = isCatScope ? (player.filterTag || '1ra') : 'all';
  const benchScopeShort = isCatScope ? (player.filterTag === 'Inter' ? 'Inter' : (player.filterTag === '5ta' ? '5ta' : '1ra')) : 'Plantel';

  const playerDimScores = RADAR_DIMENSIONS.map(d => ({
    dim: d,
    score: getPlayerDimensionScore(player, d, benchCatKey)
  }));
  const catDimScores = RADAR_DIMENSIONS.map(d => ({
    dim: d,
    score: getCategoryDimensionScore(benchCatKey, d)
  }));
  const playerOverall = Math.round(playerDimScores.reduce((acc, s) => acc + s.score, 0) / RADAR_DIMENSIONS.length);
  const catOverall = Math.round(catDimScores.reduce((acc, s) => acc + s.score, 0) / RADAR_DIMENSIONS.length);
  const topDim = [...playerDimScores].sort((a, b) => b.score - a.score)[0];

  // 1. Fondo degradé
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1350);
  bgGrad.addColorStop(0, '#030d2d');
  bgGrad.addColorStop(1, '#071542');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 840, 1350);

  // Línea de acento superior
  ctx.fillStyle = '#00a2ff';
  ctx.fillRect(0, 0, 840, 8);

  // 2. Cabecera
  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 24px Outfit, system-ui, sans-serif';
  ctx.fillText('CLUB REGATAS ANDINO', 40, 48);

  ctx.fillStyle = '#9bb1d6';
  ctx.font = '700 12px Outfit, system-ui, sans-serif';
  ctx.fillText('HOCKEY FEMENINO • EVALUACIONES FÍSICAS 2026', 40, 68);

  // Línea divisoria
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 86);
  ctx.lineTo(800, 86);
  ctx.stroke();

  // 3. Ficha de la Jugadora (Tarjeta Superior)
  drawRoundRect(ctx, 40, 102, 760, 155, 16);
  ctx.fillStyle = 'rgba(9, 24, 73, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Avatar / Círculo inicial
  const avatarGrad = ctx.createLinearGradient(60, 125, 120, 185);
  avatarGrad.addColorStop(0, '#0284c7');
  avatarGrad.addColorStop(1, '#00a2ff');
  ctx.beginPath();
  ctx.arc(95, 150, 32, 0, Math.PI * 2);
  ctx.fillStyle = avatarGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Letra inicial
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((player.name.trim().charAt(0) || 'P').toUpperCase(), 95, 160);
  ctx.textAlign = 'left';

  // Nombre de la jugadora
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 26px Outfit, system-ui, sans-serif';
  ctx.fillText(player.name.toUpperCase(), 145, 146);

  // Badge de División
  drawRoundRect(ctx, 145, 156, 115, 24, 12);
  ctx.fillStyle = 'rgba(0, 162, 255, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 11px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(player.divisionLabel.toUpperCase(), 202, 172);
  ctx.textAlign = 'left';

  // Badge de Índice Atlético (derecha)
  drawRoundRect(ctx, 610, 120, 170, 58, 12);
  ctx.fillStyle = 'rgba(3, 13, 45, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffd700';
  ctx.font = '900 24px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${playerOverall}`, 670, 154);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '700 13px Outfit, system-ui, sans-serif';
  ctx.fillText('/ 100', 730, 154);

  ctx.fillStyle = '#9bb1d6';
  ctx.font = '800 10px Outfit, system-ui, sans-serif';
  ctx.fillText('ÍNDICE ATLÉTICO', 695, 170);
  ctx.textAlign = 'left';

  // Banner de Mayor Fortaleza (inferior de la tarjeta)
  drawRoundRect(ctx, 56, 198, 728, 42, 8);
  ctx.fillStyle = 'rgba(3, 13, 45, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = '800 13px Outfit, system-ui, sans-serif';
  ctx.fillText(`🌟 Mayor Fortaleza: ${topDim.dim.icon} ${topDim.dim.name} (${topDim.score} pts)`, 75, 224);

  // 4. RADAR DE PERFIL ATLÉTICO INTEGRAL
  const rx = 40;
  const ry = 275;
  const rw = 760;
  const rh = 390;

  drawRoundRect(ctx, rx, ry, rw, rh, 16);
  ctx.fillStyle = 'rgba(6, 18, 56, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Título de la tarjeta de Radar
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 15px Outfit, system-ui, sans-serif';
  ctx.fillText('🕸️ PERFIL ATLÉTICO INTEGRAL', rx + 20, ry + 30);

  // Centro y radio del Radar en Canvas
  const rcx = 420;
  const rcy = 475;
  const rr = 95;
  const numAxes = RADAR_DIMENSIONS.length;

  // Brillo radial central
  const glow = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, rr);
  glow.addColorStop(0, 'rgba(2, 132, 199, 0.25)');
  glow.addColorStop(1, 'rgba(2, 132, 199, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(rcx, rcy, rr, 0, Math.PI * 2);
  ctx.fill();

  // Rejilla concéntrica (25%, 50%, 75%, 100%)
  [0.25, 0.50, 0.75, 1.00].forEach(lvl => {
    ctx.beginPath();
    RADAR_DIMENSIONS.forEach((d, i) => {
      const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
      const x = rcx + (rr * lvl) * Math.cos(angleRad);
      const y = rcy + (rr * lvl) * Math.sin(angleRad);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = lvl === 1.0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Ejes radiales
  RADAR_DIMENSIONS.forEach((d, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const x = rcx + rr * Math.cos(angleRad);
    const y = rcy + rr * Math.sin(angleRad);
    ctx.beginPath();
    ctx.moveTo(rcx, rcy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Polígono de la Media de la Categoría
  ctx.beginPath();
  catDimScores.forEach((s, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const radius = rr * (s.score / 100);
    const x = rcx + radius * Math.cos(angleRad);
    const y = rcy + radius * Math.sin(angleRad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.fill();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // Polígono de la Jugadora
  ctx.beginPath();
  const playerPts = playerDimScores.map((s, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const radius = rr * (s.score / 100);
    const x = rcx + radius * Math.cos(angleRad);
    const y = rcy + radius * Math.sin(angleRad);
    return { x, y, score: s.score, dim: s.dim };
  });
  playerPts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 162, 255, 0.38)';
  ctx.fill();
  ctx.strokeStyle = '#00a2ff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Vértices de la Jugadora (Puntos)
  playerPts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Etiquetas de los ejes del Radar
  RADAR_DIMENSIONS.forEach((d, i) => {
    const angleRad = ((-90 + (i * 360 / numAxes)) * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const lx = rcx + (rr + 28) * cos;
    let ly = rcy + (rr + 28) * sin;

    if (cos > 0.25) ctx.textAlign = 'start';
    else if (cos < -0.25) ctx.textAlign = 'end';
    else ctx.textAlign = 'center';

    if (sin < -0.7) ly -= 4;
    if (sin > 0.7) ly += 6;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 12px Outfit, system-ui, sans-serif';
    ctx.fillText(`${d.icon} ${d.name}`, lx, ly);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 11px Outfit, system-ui, sans-serif';
    ctx.fillText(`${playerDimScores[i].score} pts`, lx, ly + 14);
    ctx.textAlign = 'left';
  });

  // Leyenda en la parte inferior del Radar
  ctx.font = '700 11px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`■ ${player.name.split(' ')[0]} (${playerOverall} pts)`, rcx - 90, ry + rh - 14);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`□ Media ${benchScopeShort} (${catOverall} pts)`, rcx + 90, ry + rh - 14);
  ctx.textAlign = 'left';

  // 5. Grilla de Tests Físicos (2 Columnas)
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 15px Outfit, system-ui, sans-serif';
  ctx.fillText('RESULTADOS DE MEDICIONES FÍSICAS', 40, 698);

  ctx.fillStyle = '#9bb1d6';
  ctx.font = '700 11px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Detalle por Evaluación y Promedio', 800, 698);
  ctx.textAlign = 'left';

  const colW = 370;
  const colH = 96;
  const startY = 718;
  const gapY = 12;

  TESTS_CONFIG.forEach((cfg, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const x = colIdx === 0 ? 40 : 430;
    const y = startY + rowIdx * (colH + gapY);

    if (y + colH > 1260) return;

    const t = player.tests ? player.tests[cfg.key] : null;
    const validEvals = (t && t.evals) ? t.evals.filter(e => typeof e.value === 'number') : [];
    const hasData = validEvals.length > 0;
    const unit = cfg.unit ? ` ${cfg.unit}` : '';
    const u = cfg.unit ? (cfg.unit === 'seg' ? 's' : (cfg.unit === ' ' ? '' : cfg.unit)) : '';

    // Caja del Test
    drawRoundRect(ctx, x, y, colW, colH, 10);
    ctx.fillStyle = hasData ? 'rgba(6, 18, 56, 0.85)' : 'rgba(4, 16, 52, 0.45)';
    ctx.fill();
    ctx.strokeStyle = hasData ? 'rgba(0, 162, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 1. Línea Superior Izquierda: Icono y Nombre
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px Outfit, system-ui, sans-serif';
    ctx.fillText(`${cfg.icon} ${cfg.name}`, x + 14, y + 23);

    ctx.fillStyle = '#9bb1d6';
    ctx.font = '600 11px Outfit, system-ui, sans-serif';
    ctx.fillText(cfg.type, x + 14, y + 40);

    // 2. Línea Superior Derecha: Promedio
    if (hasData) {
      const sum = validEvals.reduce((acc, ev) => acc + ev.value, 0);
      const avgVal = +(sum / validEvals.length).toFixed(cfg.decimals !== undefined ? cfg.decimals : 2);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd700';
      ctx.font = '800 10px Outfit, system-ui, sans-serif';
      ctx.fillText('★ PROMEDIO', x + colW - 14, y + 21);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 18px Outfit, system-ui, sans-serif';
      ctx.fillText(`${avgVal}${unit}`, x + colW - 14, y + 42);
      ctx.textAlign = 'left';

      // 3. Línea Divisoria interna
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 51);
      ctx.lineTo(x + colW - 12, y + 51);
      ctx.stroke();

      // 4. Línea Inferior Izquierda: Resultados de todas las evaluaciones
      let evalsText = '';
      if (validEvals.length > 1) {
        evalsText = validEvals.map(ev => `${ev.round}°: ${ev.value}${u}`).join('  •  ');
      } else {
        evalsText = `1° Medición: ${validEvals[0].value}${u}`;
      }
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 11px Outfit, system-ui, sans-serif';
      ctx.fillText(evalsText, x + 14, y + 74);

      // 5. Línea Inferior Derecha: Ranking en la categoría o Evolución
      const rankInfo = getPlayerRankInTest(player.id, cfg.key, benchCatKey, 'avg') || getPlayerRankInTest(player.id, cfg.key, benchCatKey, 'latest');
      ctx.textAlign = 'right';
      if (rankInfo && rankInfo.rank <= 10) {
        const medal = rankInfo.rank === 1 ? '🥇' : (rankInfo.rank === 2 ? '🥈' : (rankInfo.rank === 3 ? '🥉' : '🏆'));
        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 11px Outfit, system-ui, sans-serif';
        ctx.fillText(`${medal} #${rankInfo.rank} en ${benchScopeShort}`, x + colW - 14, y + 74);
      } else if (t && t.diff !== null) {
        const sign = t.diff > 0 ? '+' : '';
        const arrow = t.improved ? '↗' : '↘';
        ctx.fillStyle = t.improved ? '#34d399' : '#f87171';
        ctx.font = '800 11px Outfit, system-ui, sans-serif';
        ctx.fillText(`${sign}${t.diff}${u} ${arrow}`, x + colW - 14, y + 74);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 10.5px Outfit, system-ui, sans-serif';
        ctx.fillText('1 registro', x + colW - 14, y + 74);
      }
      ctx.textAlign = 'left';
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '700 12px Outfit, system-ui, sans-serif';
      ctx.fillText('Sin datos', x + colW - 14, y + 36);
      ctx.textAlign = 'left';
    }
  });

  // 6. Footer
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 1272);
  ctx.lineTo(800, 1272);
  ctx.stroke();

  ctx.fillStyle = '#9bb1d6';
  ctx.font = '700 12px Outfit, system-ui, sans-serif';
  ctx.fillText('Preparación Física • Club Regatas Andino Hockey Femenino', 40, 1302);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'right';
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  ctx.fillText(`Generado el ${dateStr}`, 800, 1302);
  ctx.textAlign = 'left';

  // Exportar a Blob y Compartir/Descargar
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const cleanName = player.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Ficha_Fisica_${cleanName}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Ficha Física - ${player.name}`,
          text: `Ficha de rendimiento físico de ${player.name} - Club Regatas Andino`
        });
        showToast('¡Placa compartida con éxito!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Descarga directa como fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('¡Placa con radar guardada en tu dispositivo!');
  }, 'image/png');
}

function drawRoundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============================================================================

// ============================================================================
// MÓDULO: 09_sheets_sync.js
// ============================================================================

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

// ============================================================================
// MÓDULO: 10_dt_tracker.js
// ============================================================================

function cleanupEmptyDtMatches() {
  if (!dtMatchesStore) return;
  let changed = false;
  Object.keys(dtMatchesStore).forEach(k => {
    if (k === dtCurrentMatchKey) return;
    const m = dtMatchesStore[k];
    const hasEvents = m && Array.isArray(m.events) && m.events.length > 0;
    const hasScore = m && m.score && (m.score.home > 0 || m.score.away > 0);
    if (!hasEvents && !hasScore) {
      delete dtMatchesStore[k];
      changed = true;
    }
  });
  if (changed) {
    try {
      localStorage.setItem(DT_MATCHES_STORE_KEY, JSON.stringify(dtMatchesStore));
    } catch (e) {}
  }
}

// VISTA 4: BOTONERA DE INCIDENCIAS DT EN VIVO (HOCKEY LIVE TRACKER)
// ============================================================================

const DT_MATCHES_STORE_KEY = 'regatas_dt_matches_v3';
const DT_ACTIVE_MATCH_KEY = 'regatas_dt_cur_match_v3';
const DT_LEGACY_MATCH_KEY = 'regatas_dt_match_v2';
const DT_TEAM_VIEW_KEY = 'regatas_dt_team_view_pref_v1';

let dtClockInterval = null;
let dtPendingOptionAction = null; // { type: 'corner'|'stroke', team: 'home'|'away' }
let dtCurrentTeamView = 'home';
try {
  const savedView = localStorage.getItem(DT_TEAM_VIEW_KEY);
  if (savedView && ['home', 'away', 'both'].includes(savedView)) {
    dtCurrentTeamView = savedView;
  }
} catch (e) {}

const DT_SUN_MODE_KEY = 'regatas_dt_sun_mode_pref_v1';

let dtSunModeActive = false;
try {
  dtSunModeActive = localStorage.getItem(DT_SUN_MODE_KEY) === 'true';
} catch (e) {}

function initSunMode() {
  applyDtSunMode();

  const btnToggle = document.getElementById('btnDtSunToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setDtSunMode(!dtSunModeActive);
    });
  }
}

function setDtSunMode(active) {
  dtSunModeActive = !!active;
  try {
    localStorage.setItem(DT_SUN_MODE_KEY, dtSunModeActive ? 'true' : 'false');
  } catch (e) {}
  applyDtSunMode();
  showToast(dtSunModeActive ? '☀️ Modo Cancha al Sol activado (Alto Contraste)' : '🌙 Modo Noche activado');
}

function applyDtSunMode() {
  const isSun = !!dtSunModeActive;
  
  // Solo aplicar clase a body si estamos en la vista DT y autenticados
  if (currentActiveView === 'dt' && isCtAuthenticated()) {
    document.body.classList.toggle('dt-sun-mode', isSun);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isSun ? '#ffffff' : '#030d2d');
  } else {
    document.body.classList.remove('dt-sun-mode');
  }

  const viewDt = document.getElementById('viewDT');
  if (viewDt) viewDt.classList.toggle('sun-mode-active', isSun);

  const btnToggle = document.getElementById('btnDtSunToggle');
  if (btnToggle) {
    btnToggle.classList.toggle('active', isSun);
    const icon = btnToggle.querySelector('.sun-icon');
    const text = btnToggle.querySelector('.sun-text');
    if (icon) icon.textContent = isSun ? '🌙' : '☀️';
    if (text) text.textContent = isSun ? 'Noche' : 'Modo Sol';
    btnToggle.title = isSun ? 'Cambiar a Modo Noche' : 'Modo Cancha al Sol (Alto Contraste)';
  }
}

function setDtTeamView(viewMode) {
  if (!['home', 'away', 'both'].includes(viewMode)) viewMode = 'home';
  dtCurrentTeamView = viewMode;
  try {
    localStorage.setItem(DT_TEAM_VIEW_KEY, viewMode);
  } catch (e) {}

  const grid = document.getElementById('dtKeypadGrid');
  if (grid) {
    grid.setAttribute('data-team-view', viewMode);
  }

  const btnHome = document.getElementById('btnDtTabHome');
  const btnAway = document.getElementById('btnDtTabAway');
  const btnBoth = document.getElementById('btnDtTabBoth');

  if (btnHome) btnHome.classList.toggle('active', viewMode === 'home');
  if (btnAway) btnAway.classList.toggle('active', viewMode === 'away');
  if (btnBoth) btnBoth.classList.toggle('active', viewMode === 'both');
}

function createDefaultQuarterStats() {
  return {
    home: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0, goals: 0 },
    away: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0, goals: 0 }
  };
}

function getMatchKey(division, round) {
  const cleanRound = (round || 'general').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `primera_${cleanRound}`;
}

function findFixtureMatch(round) {
  if (!tournamentData) loadTournamentData();
  const divData = (tournamentData && tournamentData.primera) || (DEFAULT_TOURNAMENT_DATA && DEFAULT_TOURNAMENT_DATA.primera);
  if (!divData) return null;

  const normalize = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(round);

  if (divData.nextMatch && normalize(divData.nextMatch.round) === target) {
    return divData.nextMatch;
  }
  if (Array.isArray(divData.pendingMatches)) {
    const p = divData.pendingMatches.find(m => normalize(m.round) === target);
    if (p) return p;
  }
  if (Array.isArray(divData.matches)) {
    const m = divData.matches.find(m => normalize(m.round) === target);
    if (m) return m;
  }
  return null;
}

function createDefaultMatchState(round, rivalName, homeAway, fecha) {
  const cleanRound = round || 'Próxima Fecha';
  return {
    id: getMatchKey('primera', cleanRound),
    division: 'primera',
    round: cleanRound,
    rivalName: (rivalName || 'Rival').toUpperCase(),
    homeAway: homeAway || 'Local',
    fecha: fecha || '',
    currentQuarter: 1,
    timer: {
      seconds: 15 * 60,
      isRunning: false
    },
    score: { home: 0, away: 0 },
    quarters: {
      1: createDefaultQuarterStats(),
      2: createDefaultQuarterStats(),
      3: createDefaultQuarterStats(),
      4: createDefaultQuarterStats()
    },
    events: []
  };
}

let dtMatchesStore = {};

function getInitialTrackerMatchState() {
  if (typeof tournamentData === 'undefined' || !tournamentData) {
    try { if (typeof loadTournamentData === 'function') loadTournamentData(); } catch (_) {}
  }
  const divData = (typeof tournamentData !== 'undefined' && tournamentData && tournamentData.primera)
    || (typeof DEFAULT_TOURNAMENT_DATA !== 'undefined' && DEFAULT_TOURNAMENT_DATA && DEFAULT_TOURNAMENT_DATA.primera);

  if (divData && divData.nextMatch) {
    const nm = divData.nextMatch;
    return createDefaultMatchState(nm.round, nm.rival, nm.homeAway || 'Local', nm.fecha || '');
  }
  return createDefaultMatchState('Próxima Fecha', 'Rival', 'Local', '');
}

let dtMatchState = getInitialTrackerMatchState();
let dtCurrentMatchKey = dtMatchState ? dtMatchState.id : 'primera_proximo';

function ensureMatchStateExists(matchKey, meta = {}) {
  if (!matchKey) matchKey = dtCurrentMatchKey || 'primera_proximo';

  if (!dtMatchesStore[matchKey]) {
    let round = meta.round;
    if (!round) {
      const suffix = matchKey.replace('primera_', '').replace('intermedia_', '');
      const parts = suffix.split('_');
      round = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      if (!round || round.toLowerCase() === 'amistoso') round = 'Amistoso';
    }

    const fixtureMatch = findFixtureMatch(round);
    const rival = meta.rivalName || (fixtureMatch ? fixtureMatch.rival : (round.toLowerCase() === 'amistoso' ? 'AMISTOSO' : 'RIVAL'));
    const homeAway = meta.homeAway || (fixtureMatch ? fixtureMatch.homeAway : 'Local');
    const fecha = meta.fecha || (fixtureMatch ? fixtureMatch.fecha : '');

    dtMatchesStore[matchKey] = createDefaultMatchState(round, rival, homeAway, fecha);
  } else {
    dtMatchesStore[matchKey].division = 'primera';
    if (meta.rivalName && (!dtMatchesStore[matchKey].rivalName || dtMatchesStore[matchKey].rivalName === 'RIVAL')) {
      dtMatchesStore[matchKey].rivalName = meta.rivalName.toUpperCase();
    }
    if (meta.round && !dtMatchesStore[matchKey].round) {
      dtMatchesStore[matchKey].round = meta.round;
    }
    if (meta.homeAway && !dtMatchesStore[matchKey].homeAway) {
      dtMatchesStore[matchKey].homeAway = meta.homeAway;
    }
    if (meta.fecha && !dtMatchesStore[matchKey].fecha) {
      dtMatchesStore[matchKey].fecha = meta.fecha;
    }
  }

  return dtMatchesStore[matchKey];
}

// Carga y guardado de tienda multi-partido en LocalStorage
function loadDtMatchesStore() {
  try {
    const saved = localStorage.getItem(DT_MATCHES_STORE_KEY);
    if (saved) {
      dtMatchesStore = JSON.parse(saved) || {};
    }
  } catch (e) {
    console.warn('Error cargando dtMatchesStore:', e);
    dtMatchesStore = {};
  }

  // Migración desde versión anterior monomatch (v2) si existe
  try {
    const oldSaved = localStorage.getItem(DT_LEGACY_MATCH_KEY);
    if (oldSaved) {
      const oldMatch = JSON.parse(oldSaved);
      if (oldMatch && Array.isArray(oldMatch.events) && oldMatch.events.length > 0) {
        const legacyDiv = oldMatch.division || 'primera';
        const legacyKey = `${legacyDiv}_fecha_12`;
        if (!dtMatchesStore[legacyKey]) {
          oldMatch.id = legacyKey;
          oldMatch.round = oldMatch.round || 'Fecha 12';
          dtMatchesStore[legacyKey] = oldMatch;
        }
      }
    }
  } catch (e) {}

  const savedActiveKey = localStorage.getItem(DT_ACTIVE_MATCH_KEY);
  dtCurrentMatchKey = savedActiveKey || (dtMatchState ? dtMatchState.id : 'primera_proximo');

  cleanupEmptyDtMatches();

  ensureMatchStateExists(dtCurrentMatchKey);
  dtMatchState = dtMatchesStore[dtCurrentMatchKey];
  recalculateDtStatsFromEvents();
}

function saveDtMatchesStore() {
  try {
    if (dtMatchState && dtCurrentMatchKey) {
      dtMatchesStore[dtCurrentMatchKey] = dtMatchState;
    }
    localStorage.setItem(DT_MATCHES_STORE_KEY, JSON.stringify(dtMatchesStore));
    localStorage.setItem(DT_ACTIVE_MATCH_KEY, dtCurrentMatchKey);
  } catch (e) {
    console.warn('Error guardando dtMatchesStore:', e);
  }
}

// Aliases de compatibilidad
function loadDtMatchState() {
  loadDtMatchesStore();
}

function saveDtMatchState() {
  saveDtMatchesStore();
}

// Cambio de partido activo en la Botonera DT
function switchDtMatch(matchKey, meta = {}) {
  if (!matchKey) return;
  pauseDtClock();

  saveDtMatchesStore();

  dtCurrentMatchKey = matchKey;
  ensureMatchStateExists(matchKey, meta);
  dtMatchState = dtMatchesStore[matchKey];

  recalculateDtStatsFromEvents();
  saveDtMatchesStore();

  renderDtView();

  // Sincronizar inmediatamente las incidencias desde Google Sheets para este partido
  if (isDtAuthenticated()) {
    fetchDtMatchFromCloud();
  }
}

// Llenado dinámico del selector de partidos (Exclusivo 1ra División)
function populateDtMatchSelect() {
  const select = document.getElementById('selectDtMatch');
  if (!select) return;

  if (!tournamentData) loadTournamentData();

  const def1 = (typeof DEFAULT_TOURNAMENT_DATA !== 'undefined' && DEFAULT_TOURNAMENT_DATA.primera) || {};
  const div1 = (tournamentData && tournamentData.primera) || def1;

  const pending1 = (Array.isArray(div1.pendingMatches) && div1.pendingMatches.length > 0)
    ? div1.pendingMatches
    : (Array.isArray(def1.pendingMatches) ? def1.pendingMatches : []);
  const played1 = (Array.isArray(div1.matches) && div1.matches.length > 0)
    ? div1.matches
    : (Array.isArray(def1.matches) ? def1.matches : []);

  let html = '';

  // 1. Fixture por Disputarse (1ra División)
  if (pending1.length > 0) {
    html += `<optgroup label="⏳ Fixture por Disputarse (1ra División)">`;
    pending1.forEach(m => {
      const key = getMatchKey('primera', m.round);
      const isSaved = dtMatchesStore[key] && dtMatchesStore[key].events && dtMatchesStore[key].events.length > 0;
      const scoreBadge = isSaved ? ` [● En vivo ${dtMatchesStore[key].score.home}-${dtMatchesStore[key].score.away}]` : '';
      const selectedAttr = key === dtCurrentMatchKey ? 'selected' : '';
      const cond = m.homeAway ? ` (${m.homeAway})` : '';
      html += `<option value="${key}" ${selectedAttr}>${escapeHtml(m.round)} • vs ${escapeHtml(m.rival)}${cond}${scoreBadge}</option>`;
    });
    html += `</optgroup>`;
  }

  // 2. Partidos Disputados (Historial 1ra División)
  if (played1.length > 0) {
    html += `<optgroup label="✅ Partidos Disputados (Historial 1ra División)">`;
    const revPlayed = [...played1].reverse();
    revPlayed.forEach(m => {
      const key = getMatchKey('primera', m.round);
      const isSaved = dtMatchesStore[key] && dtMatchesStore[key].events && dtMatchesStore[key].events.length > 0;
      const scoreBadge = isSaved ? ` [● DT ${dtMatchesStore[key].score.home}-${dtMatchesStore[key].score.away}]` : ` (${m.score || 'Jugado'})`;
      const selectedAttr = key === dtCurrentMatchKey ? 'selected' : '';
      html += `<option value="${key}" ${selectedAttr}>${escapeHtml(m.round)} • vs ${escapeHtml(m.rival)}${scoreBadge}</option>`;
    });
    html += `</optgroup>`;
  }

  // 3. Amistoso / Libre
  const customKey = 'primera_amistoso';
  const isCustomSaved = dtMatchesStore[customKey] && dtMatchesStore[customKey].events && dtMatchesStore[customKey].events.length > 0;
  const customBadge = isCustomSaved ? ` [● ${dtMatchesStore[customKey].score.home}-${dtMatchesStore[customKey].score.away}]` : '';
  const customSelected = customKey === dtCurrentMatchKey ? 'selected' : '';
  html += `
    <optgroup label="⚡ Personalizado / Amistoso">
      <option value="${customKey}" ${customSelected}>Amistoso / Práctica Libre${customBadge}</option>
    </optgroup>
  `;

  select.innerHTML = html;
}

function deduceEventType(evt) {
  if (evt && evt.type) return evt.type;
  const label = ((evt && evt.label) || '').toLowerCase();
  if (label.includes('ingreso') || label.includes('área') || label.includes('area')) return 'entry';
  if (label.includes('córner') || label.includes('corner')) return 'corner';
  if (label.includes('penal') || label.includes('stroke')) return 'stroke';
  if (label.includes('gol de jugada') || label.includes('jugada')) return 'fieldGoal';
  if (label.includes('verde')) return 'cardGreen';
  if (label.includes('amarilla')) return 'cardYellow';
  if (label.includes('roja')) return 'cardRed';
  return 'entry';
}

// Recalcular todas las estadísticas y marcador directamente desde el feed de eventos
// (Garantiza 100% de coherencia matemática al deshacer o sincronizar desde la nube)
function recalculateDtStatsFromEvents() {
  if (dtMatchState) {
    recalculateMatchStats(dtMatchState);
  }
}

// ============================================================================
// SINCRONIZACIÓN EN VIVO CON GOOGLE SHEETS (MULTI-CELULAR)
// ============================================================================

const DT_WEBHOOK_URL_KEY = 'regatas_dt_webhook_url_v1';
const DT_SYNC_QUEUE_KEY = 'regatas_dt_sync_queue_v1';

// URL global por defecto: si está configurada, todos los celulares y computadoras
// se conectan automáticamente en vivo sin necesidad de pegar la URL manualmente.
const DEFAULT_DT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxPdnHYI0eYdBQKxtGX-pM24GGnP5Nys-ab_XJEnJ4jA76t9N8OOqfacOFtBA2RioM/exec';

let dtCloudSyncPollingInterval = null;
let dtIsProcessingSyncQueue = false;
let dtIsPollingCloud = false;

function getDtWebhookUrl() {
  try {
    const saved = localStorage.getItem(DT_WEBHOOK_URL_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {}
  return DEFAULT_DT_WEBHOOK_URL || '';
}

function setDtWebhookUrl(url) {
  try {
    if (url && url.trim()) {
      localStorage.setItem(DT_WEBHOOK_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(DT_WEBHOOK_URL_KEY);
    }
  } catch (e) {}
  updateDtCloudSyncStatus();
}

function updateDtCloudSyncStatus(state, text) {
  const badge = document.getElementById('dtCloudSyncBadge');
  const label = document.getElementById('dtCloudStatusText');
  const modalDot = document.getElementById('modalSheetsStatusDot');
  const modalTitle = document.getElementById('modalSheetsStatusTitle');
  const modalDesc = document.getElementById('modalSheetsStatusDesc');

  const webhook = getDtWebhookUrl();

  if (!state) {
    if (!webhook) {
      state = 'disconnected';
      text = 'Conectar Sheets';
    } else {
      state = 'connected';
      text = 'Sheets en vivo';
    }
  }

  if (badge) {
    badge.classList.remove('connected', 'syncing', 'error');
    if (state === 'connected') badge.classList.add('connected');
    else if (state === 'syncing') badge.classList.add('syncing');
    else if (state === 'error' || state === 'disconnected') badge.classList.add('error');
  }

  if (label) label.textContent = text || 'Sheets';

  if (modalDot && modalTitle && modalDesc) {
    if (state === 'connected') {
      modalDot.style.background = '#34d399';
      modalTitle.textContent = 'Conectado a Google Sheets';
      modalDesc.textContent = 'Cada botón que toques se guardará en tu hoja de cálculo y se sincronizará con otros celulares.';
    } else if (state === 'syncing') {
      modalDot.style.background = '#fbbf24';
      modalTitle.textContent = 'Transmitiendo jugadas...';
      modalDesc.textContent = text || 'Guardando cambios en Google Sheets...';
    } else {
      modalDot.style.background = '#f87171';
      modalTitle.textContent = 'Sin conexión configurada';
      modalDesc.textContent = 'Pegá abajo la URL de Apps Script de tu Google Sheets para activar la sincronización en vivo.';
    }
  }
}

function getDtSyncQueue() {
  try {
    const raw = localStorage.getItem(DT_SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveDtSyncQueue(queue) {
  try {
    localStorage.setItem(DT_SYNC_QUEUE_KEY, JSON.stringify(queue || []));
  } catch (e) {}
}

function enqueueDtSyncAction(item) {
  const queue = getDtSyncQueue();
  queue.push(item);
  saveDtSyncQueue(queue);
  processDtSyncQueue();
}

async function processDtSyncQueue() {
  if (dtIsProcessingSyncQueue) return;
  const webhookUrl = getDtWebhookUrl();
  if (!webhookUrl) {
    updateDtCloudSyncStatus('disconnected', 'Conectar Sheets');
    return;
  }

  const queue = getDtSyncQueue();
  if (queue.length === 0) {
    updateDtCloudSyncStatus('connected', 'Sheets en vivo');
    return;
  }

  dtIsProcessingSyncQueue = true;
  updateDtCloudSyncStatus('syncing', `Guardando (${queue.length})...`);

  while (queue.length > 0) {
    const currentItem = queue[0];
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(currentItem)
      });
      queue.shift();
      saveDtSyncQueue(queue);
    } catch (err) {
      console.warn('Error enviando acción a Google Sheets:', err);
      break;
    }
  }

  dtIsProcessingSyncQueue = false;
  if (queue.length === 0) {
    updateDtCloudSyncStatus('connected', 'Sheets en vivo');
  } else {
    updateDtCloudSyncStatus('syncing', `Pendientes (${queue.length})`);
  }
}

// Nombre canónico de la pestaña de Google Sheets para cada partido
function getDtMatchSheetName(matchState) {
  const m = matchState || dtMatchState;
  if (!m) return 'Incidencias';
  const round = (m.round || 'Fecha').trim();
  let rival = (m.rivalName || 'RIVAL').trim().toUpperCase();
  return `${round} - ${rival}`;
}

// Polling multi-dispositivo: lectura periódica de incidencias de otros celulares
async function fetchDtMatchFromCloud() {
  if (dtIsPollingCloud || !isDtAuthenticated() || currentActiveView !== 'dt') return;
  const webhookUrl = getDtWebhookUrl();
  if (!webhookUrl || !dtMatchState) return;

  dtIsPollingCloud = true;
  const sheetName = getDtMatchSheetName(dtMatchState);

  try {
    const url = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'ok' && Array.isArray(data.events)) {
        mergeCloudEventsIntoMatchState(data.events);
      }
    }
  } catch (e) {
    // Sin conexión temporal
  } finally {
    dtIsPollingCloud = false;
  }
}

function formatCloudTimeString(val) {
  if (!val) return '';
  const str = val.toString().trim();
  if (str.includes('T') && (str.includes('Z') || str.includes('.'))) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
  }
  return str;
}

function normalizeCloudEvent(cEvt) {
  if (!cEvt) return null;
  const type = deduceEventType(cEvt);
  const label = (cEvt.label || '').toString();
  const isGoal = cEvt.endedInGoal === true || cEvt.endedInGoal === 'true' || 
                 (label.toLowerCase().includes('gol') && (label.toLowerCase().includes('córner') || label.toLowerCase().includes('penal') || label.toLowerCase().includes('jugada')));

  const team = (cEvt.team === 'away' || (cEvt.team && cEvt.team.toLowerCase().includes('rival'))) ? 'away' : 'home';
  const quarter = parseInt(cEvt.quarter, 10) || 1;

  let clockTime = formatCloudTimeString(cEvt.clockTime);
  let timeDisplay = formatCloudTimeString(cEvt.timeDisplay);

  let player = (cEvt.player || '').toString().trim();
  let wonBy = (cEvt.wonBy || '').toString().trim();

  // Si wonBy no vino explícito (ej: descargado desde Google Sheets), extraer de la etiqueta o del campo jugadora
  if (!wonBy && label) {
    const mWon = label.match(/Provocó:\s*([^)\].]+)/i);
    if (mWon) wonBy = mWon[1].trim();
  }
  if (!wonBy && type === 'corner' && !isGoal && player) {
    wonBy = player;
  }

  return {
    id: cEvt.id || ('evt_cloud_' + Math.random().toString(36).substr(2, 6)),
    quarter: quarter >= 1 && quarter <= 4 ? quarter : 1,
    clockTime: clockTime,
    timeDisplay: timeDisplay,
    type: type,
    team: team,
    endedInGoal: isGoal,
    player: player,
    wonBy: wonBy,
    label: label || getIncidentLabel(type, isGoal, team, player, wonBy)
  };
}

function mergeCloudEventsIntoMatchState(cloudEvents) {
  if (!dtMatchState || !Array.isArray(cloudEvents)) return;

  const normalizedCloud = cloudEvents.map(normalizeCloudEvent).filter(Boolean);
  const localQueue = getDtSyncQueue();
  const pendingIds = new Set(localQueue.map(q => q.event && q.event.id).filter(Boolean));

  // Si no hay acciones pendientes en la cola local, la planilla en la nube es la fuente de verdad
  if (localQueue.length === 0) {
    dtMatchState.events = normalizedCloud;
  } else {
    const cloudIds = new Set(normalizedCloud.map(e => e.id));
    const merged = [...normalizedCloud];
    (dtMatchState.events || []).forEach(localEvt => {
      if (pendingIds.has(localEvt.id) && !cloudIds.has(localEvt.id)) {
        merged.push(localEvt);
      }
    });
    dtMatchState.events = merged;
  }

  recalculateDtStatsFromEvents();
  saveDtMatchesStore();
  renderDtView();
  updateDtCloudSyncStatus('connected', 'Sheets en vivo');
}

function startDtCloudPolling() {
  if (dtCloudSyncPollingInterval) clearInterval(dtCloudSyncPollingInterval);
  // Llamada inmediata para no esperar los 4 segundos
  fetchDtMatchFromCloud();
  processDtSyncQueue();

  dtCloudSyncPollingInterval = setInterval(() => {
    fetchDtMatchFromCloud();
    processDtSyncQueue();
  }, 4000);
}

function stopDtCloudPolling() {
  if (dtCloudSyncPollingInterval) {
    clearInterval(dtCloudSyncPollingInterval);
    dtCloudSyncPollingInterval = null;
  }
}

async function pushFullCurrentMatchToSheets() {
  const webhookUrl = getDtWebhookUrl();
  if (!webhookUrl) {
    alert('Primero pegá y guardá la URL de la Aplicación Web de Apps Script.');
    return;
  }

  const sheetName = getDtMatchSheetName(dtMatchState);
  showToast('☁️ Enviando partido completo a Google Sheets...');
  updateDtCloudSyncStatus('syncing', 'Subiendo partido...');

  const payload = {
    action: 'sync_full_match',
    round: dtMatchState.round,
    rival: dtMatchState.rivalName,
    sheetName: sheetName,
    matchState: dtMatchState
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    updateDtCloudSyncStatus('connected', 'Sheets en vivo');
    showToast(`✅ ¡Pestaña "${payload.sheetName}" actualizada en Google Sheets!`);
    closeDtSheetsConfigModal();
  } catch (err) {
    console.error('Error al subir partido a Sheets:', err);
    updateDtCloudSyncStatus('error', 'Error al enviar');
    showToast('⚠️ No se pudo conectar con Sheets. Verificá la URL.');
  }
}

function openDtSheetsConfigModal() {
  const modal = document.getElementById('modalDtSheetsConfig');
  const input = document.getElementById('inputDtWebhookUrl');
  if (input) {
    input.value = getDtWebhookUrl();
  }
  updateDtCloudSyncStatus();
  if (modal) modal.classList.add('active');
}

function closeDtSheetsConfigModal() {
  const modal = document.getElementById('modalDtSheetsConfig');
  if (modal) modal.classList.remove('active');
}

function handleDtViewOpen() {
  const gateCard = document.getElementById('dtAuthGateCard');
  const livePanel = document.getElementById('dtLivePanel');
  const passInput = document.getElementById('inputDtGatePassword');
  const errorMsg = document.getElementById('dtGateErrorMsg');

  if (isCtAuthenticated()) {
    if (gateCard) gateCard.style.display = 'none';
    if (livePanel) livePanel.style.display = 'flex';
    applyDtSunMode();
    renderDtView();
    updateDtCloudSyncStatus();
    startDtCloudPolling();
    processDtSyncQueue();
  } else {
    stopDtCloudPolling();
    document.body.classList.remove('dt-sun-mode');
    if (livePanel) livePanel.style.display = 'none';
    if (gateCard) gateCard.style.display = 'block';
    if (errorMsg) errorMsg.style.display = 'none';
    if (passInput) {
      passInput.value = '';
      setTimeout(() => passInput.focus(), 150);
    }
  }
}

async function verifyDtPassword() {
  const passInput = document.getElementById('inputDtGatePassword');
  const errorMsg = document.getElementById('dtGateErrorMsg');
  const entered = (passInput ? passInput.value : '').trim().toLowerCase();

  const ok = await verifyCtPassword(entered);
  if (ok) {
    setCtAuthenticated(true);
    handleDtViewOpen();
    showToast('⏱️ Acceso concedido a la Botonera DT');
  } else {
    if (errorMsg) errorMsg.style.display = 'block';
    if (passInput) passInput.select();
  }
}

function lockDtSession() {
  lockCtSession();
}

// Cronómetro del Cuarto (15:00 hacia abajo)
function formatClockTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateDtClockDisplay() {
  const display = document.getElementById('dtClockDisplay');
  const btnToggle = document.getElementById('btnDtClockToggle');
  if (display) {
    display.textContent = formatClockTime(dtMatchState.timer.seconds);
  }
  if (btnToggle) {
    btnToggle.textContent = dtMatchState.timer.isRunning ? '⏸' : '▶';
  }
}

function startDtClock() {
  if (dtClockInterval) clearInterval(dtClockInterval);
  dtMatchState.timer.isRunning = true;
  dtClockInterval = setInterval(() => {
    if (dtMatchState.timer.seconds > 0) {
      dtMatchState.timer.seconds--;
      updateDtClockDisplay();
    } else {
      pauseDtClock();
      showToast(`⏰ ¡Fin del ${dtMatchState.currentQuarter}° Cuarto!`);
    }
  }, 1000);
  updateDtClockDisplay();
}

function pauseDtClock() {
  dtMatchState.timer.isRunning = false;
  if (dtClockInterval) {
    clearInterval(dtClockInterval);
    dtClockInterval = null;
  }
  updateDtClockDisplay();
}

function resetDtClock() {
  pauseDtClock();
  dtMatchState.timer.seconds = 15 * 60;
  updateDtClockDisplay();
}

// Inicialización de Eventos y Botones del Módulo DT
function initDtModule() {
  loadDtMatchState();
  populateDtMatchSelect();

  // 1. Auth Gate
  const btnSubmit = document.getElementById('btnDtGateSubmit');
  const inputPass = document.getElementById('inputDtGatePassword');
  if (btnSubmit) btnSubmit.addEventListener('click', verifyDtPassword);
  if (inputPass) {
    inputPass.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') verifyDtPassword();
    });
  }

  // 2. Cerrar sesión / Bloquear
  const btnLock = document.getElementById('btnDtLockSession');
  if (btnLock) btnLock.addEventListener('click', lockDtSession);

  // 3. Conexión & Modal Google Sheets
  const btnOpenSheets = document.getElementById('btnDtOpenSheetsConfig');
  const btnQuickSync = document.getElementById('btnDtQuickSync');
  const badgeSync = document.getElementById('dtCloudSyncBadge');
  if (btnOpenSheets) btnOpenSheets.addEventListener('click', openDtSheetsConfigModal);
  if (btnQuickSync) {
    btnQuickSync.addEventListener('click', () => {
      if (isDtAuthenticated()) {
        fetchDtMatchFromCloud();
        processDtSyncQueue();
        showToast('🔄 Sincronizando con Google Sheets...');
      }
    });
  }
  if (badgeSync) {
    badgeSync.addEventListener('click', () => {
      if (isDtAuthenticated()) {
        fetchDtMatchFromCloud();
        processDtSyncQueue();
        showToast('🔄 Sincronizando con Google Sheets...');
      } else {
        openDtSheetsConfigModal();
      }
    });
  }

  const btnCloseSheets = document.getElementById('btnCloseDtSheetsConfig');
  const btnCloseSheetsBottom = document.getElementById('btnCloseDtSheetsBottom');
  if (btnCloseSheets) btnCloseSheets.addEventListener('click', closeDtSheetsConfigModal);
  if (btnCloseSheetsBottom) btnCloseSheetsBottom.addEventListener('click', closeDtSheetsConfigModal);

  const modalSheets = document.getElementById('modalDtSheetsConfig');
  if (modalSheets) {
    modalSheets.addEventListener('click', (e) => {
      if (e.target === modalSheets) closeDtSheetsConfigModal();
    });
  }

  const btnSaveWebhook = document.getElementById('btnSaveWebhookUrl');
  if (btnSaveWebhook) {
    btnSaveWebhook.addEventListener('click', () => {
      const input = document.getElementById('inputDtWebhookUrl');
      const val = input ? input.value : '';
      setDtWebhookUrl(val);
      if (val && val.trim()) {
        showToast('✅ Conexión con Google Sheets guardada');
        processDtSyncQueue();
      } else {
        showToast('ℹ️ Conexión con Google Sheets desactivada');
      }
      closeDtSheetsConfigModal();
    });
  }

  const btnPushFull = document.getElementById('btnPushFullMatchToSheets');
  if (btnPushFull) {
    btnPushFull.addEventListener('click', pushFullCurrentMatchToSheets);
  }

  // 3.5 Selector Móvil de Vista de Equipos (Regatas / Rival / Ambos)
  const tabHome = document.getElementById('btnDtTabHome');
  const tabAway = document.getElementById('btnDtTabAway');
  const tabBoth = document.getElementById('btnDtTabBoth');
  if (tabHome) tabHome.addEventListener('click', () => setDtTeamView('home'));
  if (tabAway) tabAway.addEventListener('click', () => setDtTeamView('away'));
  if (tabBoth) tabBoth.addEventListener('click', () => setDtTeamView('both'));
  setDtTeamView(dtCurrentTeamView);

  // 4. Selector de Partido Sincronizado con Fixture Oficial
  const selectMatch = document.getElementById('selectDtMatch');
  if (selectMatch) {
    selectMatch.addEventListener('change', (e) => {
      const chosenKey = e.target.value;
      if (chosenKey && chosenKey !== dtCurrentMatchKey) {
        switchDtMatch(chosenKey);
        showToast(`📍 Partido cargado: ${dtMatchState.round} vs ${dtMatchState.rivalName}`);
      }
    });
  }

  // 5. Selector de Cuarto (1C, 2C, 3C, 4C)
  const qBtns = document.querySelectorAll('.dt-quarter-btn');
  qBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const q = parseInt(btn.getAttribute('data-q'), 10);
      if (q && q >= 1 && q <= 4) {
        dtMatchState.currentQuarter = q;
        resetDtClock();
        saveDtMatchState();
        renderDtView();
        showToast(`📍 Cambiaste al ${q}° Cuarto`);
      }
    });
  });

  // 6. Cronómetro
  const btnToggleClock = document.getElementById('btnDtClockToggle');
  if (btnToggleClock) {
    btnToggleClock.addEventListener('click', () => {
      if (dtMatchState.timer.isRunning) pauseDtClock(); else startDtClock();
    });
  }
  const btnResetClock = document.getElementById('btnDtClockReset');
  if (btnResetClock) {
    btnResetClock.addEventListener('click', () => {
      resetDtClock();
    });
  }

  // 7. Botones Tácticos Regatas (A Favor)
  const btnHomeEntry = document.getElementById('btnHomeEntry');
  if (btnHomeEntry) btnHomeEntry.addEventListener('click', () => logIncident('entry', 'home'));

  const btnHomeCorner = document.getElementById('btnHomeCorner');
  if (btnHomeCorner) btnHomeCorner.addEventListener('click', () => openPlayerAssignModal({ type: 'cornerWon', team: 'home' }));

  const btnHomeStroke = document.getElementById('btnHomeStroke');
  if (btnHomeStroke) btnHomeStroke.addEventListener('click', () => openIncidentOptionModal('stroke', 'home'));

  const btnHomeGoal = document.getElementById('btnHomeFieldGoal');
  if (btnHomeGoal) btnHomeGoal.addEventListener('click', () => openPlayerAssignModal({ type: 'fieldGoal', team: 'home', endedInGoal: true }));

  // Tarjetas Regatas
  const btnHomeGreen = document.getElementById('btnHomeCardGreen');
  if (btnHomeGreen) btnHomeGreen.addEventListener('click', () => openPlayerAssignModal({ type: 'cardGreen', team: 'home', endedInGoal: false }));
  const btnHomeYellow = document.getElementById('btnHomeCardYellow');
  if (btnHomeYellow) btnHomeYellow.addEventListener('click', () => openPlayerAssignModal({ type: 'cardYellow', team: 'home', endedInGoal: false }));
  const btnHomeRed = document.getElementById('btnHomeCardRed');
  if (btnHomeRed) btnHomeRed.addEventListener('click', () => openPlayerAssignModal({ type: 'cardRed', team: 'home', endedInGoal: false }));

  // 8. Botones Tácticos Rival (En Contra)
  const btnAwayEntry = document.getElementById('btnAwayEntry');
  if (btnAwayEntry) btnAwayEntry.addEventListener('click', () => logIncident('entry', 'away'));

  const btnAwayCorner = document.getElementById('btnAwayCorner');
  if (btnAwayCorner) btnAwayCorner.addEventListener('click', () => openIncidentOptionModal('corner', 'away'));

  const btnAwayStroke = document.getElementById('btnAwayStroke');
  if (btnAwayStroke) btnAwayStroke.addEventListener('click', () => openIncidentOptionModal('stroke', 'away'));

  const btnAwayGoal = document.getElementById('btnAwayFieldGoal');
  if (btnAwayGoal) btnAwayGoal.addEventListener('click', () => logIncident('fieldGoal', 'away'));

  // Tarjetas Rival
  const btnAwayGreen = document.getElementById('btnAwayCardGreen');
  if (btnAwayGreen) btnAwayGreen.addEventListener('click', () => logCard('cardGreen', 'away'));
  const btnAwayYellow = document.getElementById('btnAwayCardYellow');
  if (btnAwayYellow) btnAwayYellow.addEventListener('click', () => logCard('cardYellow', 'away'));
  const btnAwayRed = document.getElementById('btnAwayCardRed');
  if (btnAwayRed) btnAwayRed.addEventListener('click', () => logCard('cardRed', 'away'));

  // 9. Modal de Opción A (Córner / Penal)
  const btnChoiceGoal = document.getElementById('btnChoiceGoal');
  if (btnChoiceGoal) btnChoiceGoal.addEventListener('click', () => confirmIncidentOption(true));
  const btnChoiceMiss = document.getElementById('btnChoiceMiss');
  if (btnChoiceMiss) btnChoiceMiss.addEventListener('click', () => confirmIncidentOption(false));
  const btnChoiceCancel = document.getElementById('btnChoiceCancel');
  if (btnChoiceCancel) btnChoiceCancel.addEventListener('click', closeIncidentOptionModal);

  // 9.5 Modal de Asignación de Jugadora a Incidencias
  const btnCloseAssign = document.getElementById('btnClosePlayerAssign');
  if (btnCloseAssign) btnCloseAssign.addEventListener('click', closePlayerAssignModal);

  const btnSkipAssign = document.getElementById('btnSkipPlayerAssign');
  if (btnSkipAssign) btnSkipAssign.addEventListener('click', () => confirmPlayerAssign(''));

  const btnCustomAssign = document.getElementById('btnAssignCustomPlayer');
  const inputCustom = document.getElementById('inputCustomPlayerName');
  if (btnCustomAssign) {
    btnCustomAssign.addEventListener('click', () => {
      const val = inputCustom ? inputCustom.value.trim() : '';
      confirmPlayerAssign(val);
    });
  }
  if (inputCustom) {
    inputCustom.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmPlayerAssign(inputCustom.value.trim());
      }
    });
  }

  const inputFilterAssign = document.getElementById('inputFilterAssignPlayer');
  if (inputFilterAssign) {
    inputFilterAssign.addEventListener('input', (e) => {
      renderPlayerAssignGrid(e.target.value);
    });
  }

  // 10. Herramientas Inferiores (Undo, Resumen, Feed, WhatsApp, Reset)
  const btnUndo = document.getElementById('btnDtUndo');
  if (btnUndo) btnUndo.addEventListener('click', undoLastIncident);

  const btnSummary = document.getElementById('btnDtOpenSummary');
  if (btnSummary) btnSummary.addEventListener('click', openDtSummaryModal);

  const btnToggleFeed = document.getElementById('btnDtToggleFeed');
  if (btnToggleFeed) {
    btnToggleFeed.addEventListener('click', () => {
      const feed = document.getElementById('dtFeedWrapper');
      if (feed) {
        feed.style.display = feed.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  const btnShareWa = document.getElementById('btnDtShareWhatsapp');
  if (btnShareWa) btnShareWa.addEventListener('click', shareDtMatchWhatsApp);

  const btnReset = document.getElementById('btnDtResetMatch');
  if (btnReset) btnReset.addEventListener('click', resetDtMatchWithConfirm);

  // 11. Modal Resumen Actions
  const btnCloseSummary = document.getElementById('btnCloseDtSummary');
  if (btnCloseSummary) btnCloseSummary.addEventListener('click', closeDtSummaryModal);
  const btnCloseSummaryBottom = document.getElementById('btnCloseDtSummaryBottom');
  if (btnCloseSummaryBottom) btnCloseSummaryBottom.addEventListener('click', closeDtSummaryModal);
  const btnModalShareWa = document.getElementById('btnModalShareWhatsApp');
  if (btnModalShareWa) btnModalShareWa.addEventListener('click', shareDtMatchWhatsApp);

  const btnModalShareImg = document.getElementById('btnModalShareImage');
  if (btnModalShareImg) btnModalShareImg.addEventListener('click', exportDtMatchImage);

  const modalSummary = document.getElementById('modalDtSummary');
  if (modalSummary) {
    modalSummary.addEventListener('click', (e) => {
      if (e.target === modalSummary) closeDtSummaryModal();
    });
  }

  const modalOption = document.getElementById('modalIncidentOption');
  if (modalOption) {
    modalOption.addEventListener('click', (e) => {
      if (e.target === modalOption) closeIncidentOptionModal();
    });
  }

  const modalPlayerAssign = document.getElementById('modalPlayerAssign');
  if (modalPlayerAssign) {
    modalPlayerAssign.addEventListener('click', (e) => {
      if (e.target === modalPlayerAssign) closePlayerAssignModal();
    });
  }

  // 12. Atajo global para abrir un partido específico en la Botonera DT (desde Torneo)
  window.openDtForMatch = function(division, round, rival) {
    const div = (division === '2' || division === 'intermedia') ? 'intermedia' : 'primera';
    const matchKey = getMatchKey(div, round);
    switchDtMatch(matchKey, { division: div, round, rivalName: rival });
    showView('dt');
    showToast(`⏱️ Botonera DT: ${round} vs ${rival || 'Rival'}`);
  };

  // 13. Sincronización automática al reactivar la pestaña o desbloquear el celular
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentActiveView === 'dt' && isDtAuthenticated()) {
      fetchDtMatchFromCloud();
      processDtSyncQueue();
    }
  });
  window.addEventListener('focus', () => {
    if (currentActiveView === 'dt' && isDtAuthenticated()) {
      fetchDtMatchFromCloud();
      processDtSyncQueue();
    }
  });
}

// Registro centralizado de incidencias
function logIncident(type, team, endedInGoal = false, player = '', wonBy = '') {
  const clockStr = formatClockTime(dtMatchState.timer.seconds);
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const evt = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    quarter: dtMatchState.currentQuarter || 1,
    clockTime: clockStr,
    timeDisplay: timeStr,
    type,
    team,
    endedInGoal: !!endedInGoal,
    player: player || '',
    wonBy: wonBy || '',
    label: getIncidentLabel(type, endedInGoal, team, player, wonBy)
  };

  if (!dtMatchState.events) dtMatchState.events = [];
  dtMatchState.events.push(evt);

  recalculateDtStatsFromEvents();
  saveDtMatchState();

  // Sincronización en vivo con Google Sheets en segundo plano
  enqueueDtSyncAction({
    action: 'log_incident',
    event: evt,
    matchState: dtMatchState,
    round: dtMatchState.round,
    rival: dtMatchState.rivalName,
    sheetName: getDtMatchSheetName(dtMatchState)
  });
  if (endedInGoal) {
  } else if (type.startsWith('card')) {
  } else if (type === 'entry') {
  } else if (type === 'corner') {
  } else if (type === 'stroke') {
  } else {
  }

  showToast(`${evt.team === 'home' ? '🔵' : '🔴'} ${evt.label}`);
  renderDtView();
}

function getIncidentLabel(type, endedInGoal, team, player = '', wonBy = '') {
  const teamLabel = team === 'home' ? 'Regatas' : (dtMatchState.rivalName || 'Rival');
  const playerSuffix = player ? ` (${player})` : '';
  const wonByClean = (wonBy || '').trim();

  if (type === 'entry') return `Ingreso al área (${teamLabel})`;
  if (type === 'corner') {
    if (endedInGoal) {
      return wonByClean
        ? `¡GOL de Córner Corto! (${teamLabel}${playerSuffix} • Provocó: ${wonByClean})`
        : `¡GOL de Córner Corto! (${teamLabel}${playerSuffix})`;
    } else {
      return wonByClean
        ? `Córner Corto (${teamLabel} • Provocó: ${wonByClean})`
        : `Córner Corto (${teamLabel})`;
    }
  }
  if (type === 'stroke') return endedInGoal ? `¡GOL de Penal! (${teamLabel}${playerSuffix})` : `Penal ejecutado (${teamLabel})`;
  if (type === 'fieldGoal') return `¡GOL de Jugada! (${teamLabel}${playerSuffix})`;
  if (type === 'cardGreen') return `Tarjeta Verde 🟩 (${teamLabel}${playerSuffix})`;
  if (type === 'cardYellow') return `Tarjeta Amarilla 🟨 (${teamLabel}${playerSuffix})`;
  if (type === 'cardRed') return `Tarjeta Roja 🟥 (${teamLabel}${playerSuffix})`;
  return 'Incidencia';
}

function logCard(cardType, team) {
  if (team === 'home') {
    openPlayerAssignModal({ type: cardType, team: 'home', endedInGoal: false });
    return;
  }
  logIncident(cardType, team, false, '');
}

// ============================================================================
// ASIGNACIÓN DE JUGADORA A INCIDENCIAS (GOLES Y TARJETAS)
// ============================================================================

let dtPendingPlayerIncident = null;

function getActiveMatchSquad() {
  if (!matchData) loadData();
  const divKey = (dtMatchState && dtMatchState.division === 'intermedia') ? 'intermedia' : 'primera';
  let list = [];
  if (matchData && matchData[divKey] && Array.isArray(matchData[divKey].players)) {
    list = matchData[divKey].players;
  } else if (DEFAULT_MATCH_DATA && DEFAULT_MATCH_DATA[divKey] && Array.isArray(DEFAULT_MATCH_DATA[divKey].players)) {
    list = DEFAULT_MATCH_DATA[divKey].players;
  }
  return list.filter(p => p && p.trim()).sort((a, b) => a.localeCompare(b));
}

function openPlayerAssignModal(incidentData) {
  dtPendingPlayerIncident = incidentData;
  const modal = document.getElementById('modalPlayerAssign');
  const icon = document.getElementById('playerAssignModalIcon');
  const title = document.getElementById('playerAssignModalTitle');
  const subtitle = document.getElementById('playerAssignModalSubtitle');
  const searchInput = document.getElementById('inputFilterAssignPlayer');
  const customInput = document.getElementById('inputCustomPlayerName');

  if (searchInput) searchInput.value = '';
  if (customInput) customInput.value = '';

  const isGoal = !!incidentData.endedInGoal;
  const type = incidentData.type;

  if (type === 'cornerWon') {
    if (icon) icon.textContent = '🏑';
    if (title) title.textContent = 'CÓRNER CORTO A FAVOR';
    if (subtitle) subtitle.textContent = '¿Quién provocó o consiguió el córner corto?';
  } else if (type === 'fieldGoal') {
    if (icon) icon.textContent = '⚽';
    if (title) title.textContent = '¡GOL DE JUGADA!';
    if (subtitle) subtitle.textContent = '¿Quién convirtió el gol de Regatas?';
  } else if (type === 'corner') {
    if (icon) icon.textContent = '🏑';
    if (title) title.textContent = '¡GOL DE CÓRNER CORTO!';
    const wonByTxt = incidentData.wonBy ? `Provocó: ${incidentData.wonBy} • ` : '';
    if (subtitle) subtitle.textContent = `${wonByTxt}¿Quién convirtió el gol de jugada fija?`;
  } else if (type === 'stroke') {
    if (icon) icon.textContent = '🎯';
    if (title) title.textContent = '¡GOL DE PENAL!';
    if (subtitle) subtitle.textContent = '¿Quién ejecutó y convirtió el penal?';
  } else if (type === 'cardGreen') {
    if (icon) icon.textContent = '🟩';
    if (title) title.textContent = 'TARJETA VERDE (2 MIN)';
    if (subtitle) subtitle.textContent = '¿Quién recibió la sanción temporal?';
  } else if (type === 'cardYellow') {
    if (icon) icon.textContent = '🟨';
    if (title) title.textContent = 'TARJETA AMARILLA (5 MIN)';
    if (subtitle) subtitle.textContent = '¿Quién recibió la tarjeta en Regatas?';
  } else if (type === 'cardRed') {
    if (icon) icon.textContent = '🟥';
    if (title) title.textContent = 'TARJETA ROJA (EXPULSIÓN)';
    if (subtitle) subtitle.textContent = '¿Quién fue expulsada de Regatas?';
  } else {
    if (icon) icon.textContent = isGoal ? '🥅' : '👤';
    if (title) title.textContent = isGoal ? '¡GOL DE REGATAS!' : 'ASIGNAR JUGADORA';
    if (subtitle) subtitle.textContent = isGoal ? '¿Quién convirtió el gol?' : 'Seleccioná la jugadora';
  }

  renderPlayerAssignGrid('');
  if (modal) modal.classList.add('active');
}

function renderPlayerAssignGrid(filter = '') {
  const grid = document.getElementById('playerAssignGrid');
  if (!grid) return;

  const players = getActiveMatchSquad();
  const cleanFilter = (filter || '').toLowerCase().trim();

  const filtered = cleanFilter
    ? players.filter(p => p.toLowerCase().includes(cleanFilter))
    : players;

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 14px;">No se encontraron jugadoras con "${escapeHtml(filter)}". Podés ingresar el nombre abajo.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(name => {
    const parts = name.trim().split(/\s+/);
    let initials = '';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts[0]) {
      initials = parts[0].slice(0, 2).toUpperCase();
    }

    return `
      <button type="button" class="player-assign-chip" data-player="${escapeHtml(name)}">
        <span class="player-chip-avatar">${initials}</span>
        <span class="player-chip-name">${escapeHtml(name)}</span>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('.player-assign-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pName = chip.getAttribute('data-player');
      confirmPlayerAssign(pName);
    });
  });
}

function confirmPlayerAssign(playerName = '') {
  if (dtPendingPlayerIncident) {
    const { type, team, endedInGoal, wonBy } = dtPendingPlayerIncident;
    dtPendingPlayerIncident = null;
    closePlayerAssignModal();

    if (type === 'cornerWon') {
      openIncidentOptionModal('corner', 'home', (playerName || '').trim());
      return;
    }

    logIncident(type, team, endedInGoal, (playerName || '').trim(), wonBy || '');
  } else {
    closePlayerAssignModal();
  }
}

function closePlayerAssignModal() {
  const modal = document.getElementById('modalPlayerAssign');
  if (modal) modal.classList.remove('active');
  dtPendingPlayerIncident = null;
}
window.confirmPlayerAssign = confirmPlayerAssign;
window.closePlayerAssignModal = closePlayerAssignModal;

// Modal de Opción A: Córner Corto / Penal
function openIncidentOptionModal(type, team, wonBy = '') {
  dtPendingOptionAction = { type, team, wonBy: wonBy || '' };

  const modal = document.getElementById('modalIncidentOption');
  const icon = document.getElementById('choiceModalIcon');
  const title = document.getElementById('choiceModalTitle');
  const subtitle = document.getElementById('choiceModalSubtitle');
  const teamName = team === 'home' ? 'Regatas Andino' : (dtMatchState.rivalName || 'Rival');

  if (type === 'corner') {
    if (icon) icon.textContent = '🏑';
    if (title) title.textContent = `Córner Corto - ${teamName}`;
    if (wonBy) {
      if (subtitle) subtitle.innerHTML = `Provocó: <strong style="color: #c084fc;">${escapeHtml(wonBy)}</strong><br>¿Terminó en gol esta jugada fija?`;
    } else {
      if (subtitle) subtitle.textContent = '¿Terminó en gol esta jugada fija?';
    }
  } else {
    if (icon) icon.textContent = '🎯';
    if (title) title.textContent = `Penal - ${teamName}`;
    if (subtitle) subtitle.textContent = '¿Terminó en gol este penal?';
  }

  if (modal) modal.classList.add('active');
}

function confirmIncidentOption(isGoal) {
  if (dtPendingOptionAction) {
    const action = { ...dtPendingOptionAction };
    closeIncidentOptionModal();
    if (isGoal && action.team === 'home') {
      openPlayerAssignModal({ type: action.type, team: 'home', endedInGoal: true, wonBy: action.wonBy || '' });
    } else {
      logIncident(action.type, action.team, isGoal, '', action.wonBy || '');
    }
  } else {
    closeIncidentOptionModal();
  }
}

function closeIncidentOptionModal() {
  const modal = document.getElementById('modalIncidentOption');
  if (modal) modal.classList.remove('active');
  dtPendingOptionAction = null;
}

// Deshacer último evento (Undo)
function undoLastIncident() {
  if (!dtMatchState.events || dtMatchState.events.length === 0) {
    showToast('ℹ️ No hay incidencias registradas para deshacer');
    return;
  }

  const popped = dtMatchState.events.pop();
  recalculateDtStatsFromEvents();
  saveDtMatchState();

  enqueueDtSyncAction({
    action: 'undo_incident',
    matchState: dtMatchState,
    round: dtMatchState.round,
    rival: dtMatchState.rivalName,
    sheetName: getDtMatchSheetName(dtMatchState)
  });
  showToast(`↩ Deshecho: ${popped.label}`);
  renderDtView();
}

// Eliminar evento específico desde el Feed
function deleteEventById(eventId) {
  if (!dtMatchState.events) return;
  const idx = dtMatchState.events.findIndex(e => e.id === eventId);
  if (idx !== -1) {
    const removed = dtMatchState.events.splice(idx, 1)[0];
    recalculateDtStatsFromEvents();
    saveDtMatchState();

    enqueueDtSyncAction({
      action: 'delete_incident',
      eventId: eventId,
      matchState: dtMatchState,
      round: dtMatchState.round,
      rival: dtMatchState.rivalName,
      sheetName: getDtMatchSheetName(dtMatchState)
    });

    showToast(`🗑️ Evento eliminado: ${removed.label}`);
    renderDtView();
  }
}
window.deleteEventById = deleteEventById;

// Reiniciar Partido
function resetDtMatchWithConfirm() {
  const matchDesc = `${dtMatchState.round || 'Partido'} (1ra División vs ${dtMatchState.rivalName || 'Rival'})`;
  if (confirm(`¿Reiniciar este partido?\n${matchDesc}\n\nSe borrarán todas las incidencias de este partido y el marcador volverá a 0-0. Los demás partidos del fixture se mantendrán intactos.`)) {
    dtMatchState.currentQuarter = 1;
    dtMatchState.score = { home: 0, away: 0 };
    dtMatchState.events = [];
    dtMatchState.quarters = {
      1: createDefaultQuarterStats(),
      2: createDefaultQuarterStats(),
      3: createDefaultQuarterStats(),
      4: createDefaultQuarterStats()
    };
    resetDtClock();
    saveDtMatchesStore();

    enqueueDtSyncAction({
      action: 'reset_match',
      matchState: dtMatchState,
      round: dtMatchState.round,
      rival: dtMatchState.rivalName,
      sheetName: getDtMatchSheetName(dtMatchState)
    });

    renderDtView();
    showToast('🔄 Partido reiniciado exitosamente');
  }
}

// Modal de Resumen y Estadísticas
function openDtSummaryModal() {
  const modal = document.getElementById('modalDtSummary');
  const container = document.getElementById('dtSummaryContent');
  if (!container) return;

  const rival = dtMatchState.rivalName || 'RIVAL';
  const qStats = dtMatchState.quarters || {};

  // Acumulados totales
  const tot = {
    home: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0, goals: 0 },
    away: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0, goals: 0 }
  };

  [1, 2, 3, 4].forEach(q => {
    const cur = qStats[q] || createDefaultQuarterStats();
    ['home', 'away'].forEach(tm => {
      tot[tm].entries += cur[tm].entries || 0;
      tot[tm].corners += cur[tm].corners || 0;
      tot[tm].cornerGoals += cur[tm].cornerGoals || 0;
      tot[tm].strokes += cur[tm].strokes || 0;
      tot[tm].strokeGoals += cur[tm].strokeGoals || 0;
      tot[tm].fieldGoals += cur[tm].fieldGoals || 0;
      tot[tm].green += cur[tm].green || 0;
      tot[tm].yellow += cur[tm].yellow || 0;
      tot[tm].red += cur[tm].red || 0;
      tot[tm].goals += cur[tm].goals || 0;
    });
  });

  const calcEff = (goals, total) => total > 0 ? Math.round((goals / total) * 100) + '%' : '0%';

  container.innerHTML = `
    <div style="background: rgba(3, 13, 45, 0.85); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px; text-align: center;">
      <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase;">Marcador Final</span>
      <div style="font-size: 2.2rem; font-weight: 900; margin: 4px 0;">
        <span style="color: var(--color-regatas-cyan);">REGATAS ${tot.home.goals}</span>
        <span style="color: var(--text-muted); font-size: 1.5rem; margin: 0 8px;">-</span>
        <span style="color: #f87171;">${tot.away.goals} ${escapeHtml(rival)}</span>
      </div>
      <span style="font-size: 0.75rem; color: var(--text-muted);">1ra División • ${escapeHtml(dtMatchState.round || 'Partido')} • Clausura 2026</span>
    </div>

    <!-- Tabla Comparativa Total -->
    <div class="dt-summary-table-wrap">
      <table class="dt-summary-table">
        <thead>
          <tr>
            <th style="text-align: left;">MÉTRICA TÁCTICA</th>
            <th style="color: var(--color-regatas-cyan);">REGATAS</th>
            <th style="color: #f87171;">${escapeHtml(rival)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="team-name-cell">📥 Ingresos al Área</td>
            <td><strong>${tot.home.entries}</strong></td>
            <td><strong>${tot.away.entries}</strong></td>
          </tr>
          <tr>
            <td class="team-name-cell">🏑 Córner Cortos Obtenidos</td>
            <td><strong>${tot.home.corners}</strong></td>
            <td><strong>${tot.away.corners}</strong></td>
          </tr>
          <tr>
            <td class="team-name-cell">🥅 Goles de Córner Corto</td>
            <td><strong>${tot.home.cornerGoals}</strong></td>
            <td><strong>${tot.away.cornerGoals}</strong></td>
          </tr>
          <tr>
            <td class="team-name-cell">🎯 Efectividad de Córner Corto</td>
            <td><strong style="color: #34d399;">${calcEff(tot.home.cornerGoals, tot.home.corners)}</strong></td>
            <td><strong style="color: #34d399;">${calcEff(tot.away.cornerGoals, tot.away.corners)}</strong></td>
          </tr>
          <tr>
            <td class="team-name-cell">🎯 Penales Obtenidos (Goles)</td>
            <td><strong>${tot.home.strokes} (${tot.home.strokeGoals})</strong></td>
            <td><strong>${tot.away.strokes} (${tot.away.strokeGoals})</strong></td>
          </tr>
          <tr>
            <td class="team-name-cell">⚽ Goles de Jugada</td>
            <td><strong>${tot.home.fieldGoals}</strong></td>
            <td><strong>${tot.away.fieldGoals}</strong></td>
          </tr>
          <tr>
            <td class="team-name-cell">🟨 Tarjetas (🟩 / 🟨 / 🟥)</td>
            <td>${tot.home.green} / ${tot.home.yellow} / ${tot.home.red}</td>
            <td>${tot.away.green} / ${tot.away.yellow} / ${tot.away.red}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Desglose por Cuartos -->
    <div class="dt-summary-table-wrap">
      <table class="dt-summary-table">
        <thead>
          <tr>
            <th style="text-align: left;">CUARTO</th>
            <th>GOLES</th>
            <th>ÁREA</th>
            <th>CÓRNER CORTO</th>
          </tr>
        </thead>
        <tbody>
          ${[1, 2, 3, 4].map(q => {
            const h = (qStats[q] && qStats[q].home) || {};
            const a = (qStats[q] && qStats[q].away) || {};
            return `
              <tr>
                <td class="team-name-cell"><strong>${q}° Cuarto</strong></td>
                <td><span style="color: var(--color-regatas-cyan);">${h.goals || 0}</span> - <span style="color: #f87171;">${a.goals || 0}</span></td>
                <td>${h.entries || 0} vs ${a.entries || 0}</td>
                <td>${h.corners || 0} (${h.cornerGoals || 0}) vs ${a.corners || 0} (${a.cornerGoals || 0})</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Goleadoras Asignadas de Regatas -->
    ${(() => {
      const scorersMap = {};
      (dtMatchState.events || []).forEach(evt => {
        if (evt.team === 'home' && evt.endedInGoal && evt.player) {
          scorersMap[evt.player] = (scorersMap[evt.player] || 0) + 1;
        }
      });
      const scorersList = Object.entries(scorersMap).sort((a, b) => b[1] - a[1]);
      if (scorersList.length === 0) return '';
      return `
        <div class="dt-summary-scorers-box">
          <div class="dt-summary-scorers-header">
            <span class="dt-summary-scorers-title">⚽ GOLEADORAS DE REGATAS</span>
            <span style="font-size: 0.72rem; color: #34d399; font-weight: 800;">${tot.home.goals} goles</span>
          </div>
          <div class="dt-summary-scorers-list">
            ${scorersList.map(([name, gCount]) => `
              <div class="dt-summary-scorer-row">
                <span class="dt-summary-scorer-name">👤 ${escapeHtml(name)}</span>
                <span class="dt-summary-scorer-badge">${gCount} gol${gCount === 1 ? '' : 'es'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    })()}

    <!-- Córners Cortos Conseguidos (Regatas) -->
    ${(() => {
      const cornersWonMap = {};
      let totalWon = 0;
      (dtMatchState.events || []).forEach(evt => {
        if (evt.team === 'home' && evt.type === 'corner' && evt.wonBy && evt.wonBy.trim()) {
          const w = evt.wonBy.trim();
          if (!cornersWonMap[w]) cornersWonMap[w] = { total: 0, goals: 0 };
          cornersWonMap[w].total++;
          if (evt.endedInGoal) cornersWonMap[w].goals++;
          totalWon++;
        }
      });
      const cornersWonList = Object.entries(cornersWonMap).sort((a, b) => b[1].total - a[1].total);
      if (cornersWonList.length === 0) return '';
      return `
        <div class="dt-summary-scorers-box" style="border-left: 3px solid #c084fc;">
          <div class="dt-summary-scorers-header">
            <span class="dt-summary-scorers-title" style="color: #c084fc;">🏑 CÓRNERS CORTOS CONSEGUIDOS</span>
            <span style="font-size: 0.72rem; color: #c084fc; font-weight: 800;">${totalWon} forzado${totalWon === 1 ? '' : 's'}</span>
          </div>
          <div class="dt-summary-scorers-list">
            ${cornersWonList.map(([name, data], idx) => {
              const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}.`));
              return `
                <div class="dt-summary-scorer-row">
                  <span class="dt-summary-scorer-name">
                    <span style="color: #c084fc; font-weight: 800; margin-right: 4px;">${medal}</span>
                    👤 ${escapeHtml(name)}
                    ${data.goals > 0 ? `<span style="font-size: 0.68rem; color: #34d399; margin-left: 6px;">(${data.goals} con gol)</span>` : ''}
                  </span>
                  <span class="dt-summary-scorer-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-weight: 900;">${data.total} corto${data.total === 1 ? '' : 's'}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    })()}

    <!-- Sanciones y Tarjetas de Regatas -->
    ${(() => {
      const cardsMap = {};
      (dtMatchState.events || []).forEach(evt => {
        if (evt.team === 'home' && ['cardGreen', 'cardYellow', 'cardRed'].includes(evt.type) && evt.player) {
          if (!cardsMap[evt.player]) cardsMap[evt.player] = [];
          cardsMap[evt.player].push({ type: evt.type, q: evt.quarter });
        }
      });
      const cardsList = Object.entries(cardsMap);
      if (cardsList.length === 0) return '';
      return `
        <div class="dt-summary-scorers-box">
          <div class="dt-summary-scorers-header">
            <span class="dt-summary-scorers-title" style="color: #fbbf24;">🟨 SANCIONES Y TARJETAS REGATAS</span>
          </div>
          <div class="dt-summary-scorers-list">
            ${cardsList.map(([name, cArr]) => `
              <div class="dt-summary-scorer-row">
                <span class="dt-summary-scorer-name">👤 ${escapeHtml(name)}</span>
                <div style="display: flex; gap: 4px;">
                  ${cArr.map(c => {
                    const icon = c.type === 'cardGreen' ? '🟩' : (c.type === 'cardYellow' ? '🟨' : '🟥');
                    return `<span class="dt-summary-card-badge">${icon} ${c.q}°C</span>`;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    })()}
  `;

  container.scrollTop = 0;
  if (modal) modal.classList.add('active');
}

function closeDtSummaryModal() {
  const modal = document.getElementById('modalDtSummary');
  if (modal) modal.classList.remove('active');
}

// Compartir Resumen por WhatsApp
function shareDtMatchWhatsApp() {
  const rival = dtMatchState.rivalName || 'RIVAL';
  const qStats = dtMatchState.quarters || {};
  const divName = '1ra División';

  const tot = {
    home: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0, goals: 0 },
    away: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0, goals: 0 }
  };

  [1, 2, 3, 4].forEach(q => {
    const cur = qStats[q] || createDefaultQuarterStats();
    ['home', 'away'].forEach(tm => {
      tot[tm].entries += cur[tm].entries || 0;
      tot[tm].corners += cur[tm].corners || 0;
      tot[tm].cornerGoals += cur[tm].cornerGoals || 0;
      tot[tm].strokes += cur[tm].strokes || 0;
      tot[tm].strokeGoals += cur[tm].strokeGoals || 0;
      tot[tm].fieldGoals += cur[tm].fieldGoals || 0;
      tot[tm].green += cur[tm].green || 0;
      tot[tm].yellow += cur[tm].yellow || 0;
      tot[tm].red += cur[tm].red || 0;
      tot[tm].goals += cur[tm].goals || 0;
    });
  });

  const calcEff = (goals, total) => total > 0 ? Math.round((goals / total) * 100) + '%' : '0%';

  // Desglose de Goleadoras y Tarjetas para WhatsApp
  const scorersMap = {};
  const cardsMap = {};
  (dtMatchState.events || []).forEach(evt => {
    if (evt.team === 'home' && evt.endedInGoal && evt.player) {
      scorersMap[evt.player] = (scorersMap[evt.player] || 0) + 1;
    }
    if (evt.team === 'home' && ['cardGreen', 'cardYellow', 'cardRed'].includes(evt.type) && evt.player) {
      if (!cardsMap[evt.player]) cardsMap[evt.player] = [];
      cardsMap[evt.player].push({ type: evt.type, q: evt.quarter });
    }
  });

  const scorersList = Object.entries(scorersMap).sort((a, b) => b[1] - a[1]);
  const cardsList = Object.entries(cardsMap);
  const getQ = (q, team, key) => (qStats[q] && qStats[q][team] && qStats[q][team][key]) || 0;

  const lines = [
    `🏑 *REPORTE TÁCTICO EN VIVO - REGATAS ANDINO B*`,
    `🏆 Categoría: *${divName}*`,
    `⚔️ Rival: *${rival}*`,
    `🏁 Resultado Final: *REGATAS ${tot.home.goals} - ${tot.away.goals} ${rival}*`,
    ``,
    `📊 *ESTADÍSTICAS GENERALES:*`,
    `• 📥 Ingresos al Área: Regatas ${tot.home.entries} vs ${tot.away.entries} ${rival}`,
    `• 🏑 Córner Corto: Regatas ${tot.home.corners} (${tot.home.cornerGoals} goles, ${calcEff(tot.home.cornerGoals, tot.home.corners)}) vs ${rival} ${tot.away.corners} (${tot.away.cornerGoals} goles, ${calcEff(tot.away.cornerGoals, tot.away.corners)})`,
    `• 🎯 Penales: Regatas ${tot.home.strokes} (${tot.home.strokeGoals} goles) vs ${rival} ${tot.away.strokes} (${tot.away.strokeGoals} goles)`,
    `• ⚽ Goles de Jugada: Regatas ${tot.home.fieldGoals} vs ${tot.away.fieldGoals} ${rival}`,
    `• 🟨 Tarjetas Regatas: 🟩 ${tot.home.green} | 🟨 ${tot.home.yellow} | 🟥 ${tot.home.red}`,
    `• 🟨 Tarjetas ${rival}: 🟩 ${tot.away.green} | 🟨 ${tot.away.yellow} | 🟥 ${tot.away.red}`,
    ``,
    `📋 *DETALLE POR CUARTOS:*`,
    `• 1°C: Goles ${getQ(1, 'home', 'goals')}-${getQ(1, 'away', 'goals')} | Área ${getQ(1, 'home', 'entries')}-${getQ(1, 'away', 'entries')} | CC ${getQ(1, 'home', 'corners')}-${getQ(1, 'away', 'corners')}`,
    `• 2°C: Goles ${getQ(2, 'home', 'goals')}-${getQ(2, 'away', 'goals')} | Área ${getQ(2, 'home', 'entries')}-${getQ(2, 'away', 'entries')} | CC ${getQ(2, 'home', 'corners')}-${getQ(2, 'away', 'corners')}`,
    `• 3°C: Goles ${getQ(3, 'home', 'goals')}-${getQ(3, 'away', 'goals')} | Área ${getQ(3, 'home', 'entries')}-${getQ(3, 'away', 'entries')} | CC ${getQ(3, 'home', 'corners')}-${getQ(3, 'away', 'corners')}`,
    `• 4°C: Goles ${getQ(4, 'home', 'goals')}-${getQ(4, 'away', 'goals')} | Área ${getQ(4, 'home', 'entries')}-${getQ(4, 'away', 'entries')} | CC ${getQ(4, 'home', 'corners')}-${getQ(4, 'away', 'corners')}`
  ];

  if (scorersList.length > 0) {
    lines.push(``);
    lines.push(`⚽ *GOLEADORAS REGATAS:*`);
    scorersList.forEach(([name, count]) => {
      lines.push(`• 👤 ${name}: ${count} gol${count === 1 ? '' : 'es'}`);
    });
  }

  if (cardsList.length > 0) {
    lines.push(``);
    lines.push(`🟨 *SANCIONES REGATAS:*`);
    cardsList.forEach(([name, cArr]) => {
      const cStr = cArr.map(c => `${c.type === 'cardGreen' ? '🟩' : (c.type === 'cardYellow' ? '🟨' : '🟥')} (${c.q}°C)`).join(', ');
      lines.push(`• 👤 ${name}: ${cStr}`);
    });
  }

  lines.push(``);
  lines.push(`_Generado desde la Web Oficial de Citaciones Regatas Andino B_`);

  const fullText = lines.join('\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(fullText).then(() => {
      showToast('📋 ¡Reporte copiado al portapapeles!');
    }).catch(() => {});
  }

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
  window.open(waUrl, '_blank');
}

// Renderizado de la Pantalla DT en Vivo
function renderDtView() {
  if (!isDtAuthenticated()) return;
  if (!dtMatchState) loadDtMatchesStore();

  // Sincronización del Selector de Partido y Título
  populateDtMatchSelect();

  const pickerTitle = document.getElementById('dtMatchPickerTitle');
  if (pickerTitle) {
    const roundLabel = (dtMatchState.round || 'PARTIDO').toUpperCase();
    pickerTitle.textContent = `${roundLabel}:`;
  }

  const selectMatch = document.getElementById('selectDtMatch');
  if (selectMatch && selectMatch.value !== dtCurrentMatchKey) {
    selectMatch.value = dtCurrentMatchKey;
  }

  const rival = dtMatchState.rivalName || 'RIVAL';
  const curQ = dtMatchState.currentQuarter || 1;
  const qData = (dtMatchState.quarters && dtMatchState.quarters[curQ]) || createDefaultQuarterStats();

  // Acumulados totales
  const tot = {
    home: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0 },
    away: { entries: 0, corners: 0, cornerGoals: 0, strokes: 0, strokeGoals: 0, fieldGoals: 0, green: 0, yellow: 0, red: 0 }
  };

  [1, 2, 3, 4].forEach(q => {
    const cur = (dtMatchState.quarters && dtMatchState.quarters[q]) || createDefaultQuarterStats();
    ['home', 'away'].forEach(tm => {
      tot[tm].entries += cur[tm].entries || 0;
      tot[tm].corners += cur[tm].corners || 0;
      tot[tm].cornerGoals += cur[tm].cornerGoals || 0;
      tot[tm].strokes += cur[tm].strokes || 0;
      tot[tm].strokeGoals += cur[tm].strokeGoals || 0;
      tot[tm].fieldGoals += cur[tm].fieldGoals || 0;
      tot[tm].green += cur[tm].green || 0;
      tot[tm].yellow += cur[tm].yellow || 0;
      tot[tm].red += cur[tm].red || 0;
    });
  });

  // Marcador y Nombres
  const awayName = document.getElementById('dtAwayTeamName');
  if (awayName) awayName.textContent = rival;

  const dtTabAwayText = document.getElementById('dtTabAwayText');
  if (dtTabAwayText) dtTabAwayText.textContent = `🔴 ${rival}`;

  const scoreH = document.getElementById('dtScoreHome');
  const scoreA = document.getElementById('dtScoreAway');
  if (scoreH) scoreH.textContent = dtMatchState.score.home;
  if (scoreA) scoreA.textContent = dtMatchState.score.away;

  // 3. Cuartos
  document.querySelectorAll('.dt-quarter-btn').forEach(btn => {
    const q = parseInt(btn.getAttribute('data-q'), 10);
    btn.classList.toggle('active', q === curQ);
  });

  // 4. Cronómetro
  updateDtClockDisplay();

  // 5. Contadores Regatas
  const cHomeEntry = document.getElementById('countHomeEntry');
  if (cHomeEntry) cHomeEntry.textContent = `${qData.home.entries} en cuarto (${tot.home.entries} total)`;

  const cHomeCorner = document.getElementById('countHomeCorner');
  if (cHomeCorner) cHomeCorner.textContent = `${qData.home.corners} en cuarto (${tot.home.corners} total • ${tot.home.cornerGoals} goles)`;

  const cHomeStroke = document.getElementById('countHomeStroke');
  if (cHomeStroke) cHomeStroke.textContent = `${qData.home.strokes} en cuarto (${tot.home.strokes} total • ${tot.home.strokeGoals} goles)`;

  const cHomeGoal = document.getElementById('countHomeFieldGoal');
  if (cHomeGoal) cHomeGoal.textContent = `${qData.home.fieldGoals} en cuarto (${tot.home.fieldGoals} de jugada)`;

  const cHomeGrn = document.getElementById('countHomeCardGreen');
  if (cHomeGrn) cHomeGrn.textContent = tot.home.green;
  const cHomeYel = document.getElementById('countHomeCardYellow');
  if (cHomeYel) cHomeYel.textContent = tot.home.yellow;
  const cHomeRed = document.getElementById('countHomeCardRed');
  if (cHomeRed) cHomeRed.textContent = tot.home.red;

  // 6. Contadores Rival
  const cAwayEntry = document.getElementById('countAwayEntry');
  if (cAwayEntry) cAwayEntry.textContent = `${qData.away.entries} en cuarto (${tot.away.entries} total)`;

  const cAwayCorner = document.getElementById('countAwayCorner');
  if (cAwayCorner) cAwayCorner.textContent = `${qData.away.corners} en cuarto (${tot.away.corners} total • ${tot.away.cornerGoals} goles)`;

  const cAwayStroke = document.getElementById('countAwayStroke');
  if (cAwayStroke) cAwayStroke.textContent = `${qData.away.strokes} en cuarto (${tot.away.strokes} total • ${tot.away.strokeGoals} goles)`;

  const cAwayGoal = document.getElementById('countAwayFieldGoal');
  if (cAwayGoal) cAwayGoal.textContent = `${qData.away.fieldGoals} en cuarto (${tot.away.fieldGoals} de jugada)`;

  const cAwayGrn = document.getElementById('countAwayCardGreen');
  if (cAwayGrn) cAwayGrn.textContent = tot.away.green;
  const cAwayYel = document.getElementById('countAwayCardYellow');
  if (cAwayYel) cAwayYel.textContent = tot.away.yellow;
  const cAwayRed = document.getElementById('countAwayCardRed');
  if (cAwayRed) cAwayRed.textContent = tot.away.red;

  // 7. Feed de Eventos
  const feedCount = document.getElementById('dtFeedCount');
  const evts = dtMatchState.events || [];
  if (feedCount) feedCount.textContent = evts.length;

  const feedList = document.getElementById('dtFeedList');
  if (feedList) {
    if (evts.length === 0) {
      feedList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.78rem;">No hay incidencias registradas aún. Tocá cualquier botón para comenzar el partido.</div>`;
    } else {
      // Orden cronológico inverso (los más recientes arriba)
      const reversed = [...evts].reverse();
      feedList.innerHTML = reversed.map(evt => {
        let icon = '📌';
        if (evt.type === 'entry') icon = '📥';
        else if (evt.type === 'corner') icon = evt.endedInGoal ? '🥅🏑' : '🏑';
        else if (evt.type === 'stroke') icon = evt.endedInGoal ? '🥅🎯' : '🎯';
        else if (evt.type === 'fieldGoal') icon = '⚽';
        else if (evt.type === 'cardGreen') icon = '🟩';
        else if (evt.type === 'cardYellow') icon = '🟨';
        else if (evt.type === 'cardRed') icon = '🟥';

        const teamClass = evt.team === 'home' ? 'home-event' : 'away-event';
        const playerBadge = (evt.player && evt.player.trim())
          ? `<span class="dt-feed-player-badge">👤 ${escapeHtml(evt.player)}</span>`
          : '';
        const wonByBadge = (evt.wonBy && evt.wonBy.trim())
          ? `<span class="dt-feed-wonby-badge">🏑 Provocó: ${escapeHtml(evt.wonBy)}</span>`
          : '';

        return `
          <div class="dt-feed-item ${teamClass}">
            <div class="dt-feed-left">
              <span class="dt-feed-icon">${icon}</span>
              <div class="dt-feed-info">
                <span class="dt-feed-label">${escapeHtml(evt.label)}</span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${playerBadge}
                  ${wonByBadge}
                </div>
                <span class="dt-feed-meta">${evt.quarter}° Cuarto • ${evt.clockTime || ''} (${evt.timeDisplay})</span>
              </div>
            </div>
            <button type="button" class="btn-feed-delete-event" onclick="deleteEventById('${evt.id}')" title="Eliminar este evento">✕</button>
          </div>
        `;
      }).join('');
    }
  }
}

// ============================================================================

// ============================================================================
// GENERADOR DE IMAGEN RESUMEN DEPORTIVA DEL PARTIDO (CANVAS HD)
// ============================================================================
async function exportDtMatchImage() {
  if (!dtMatchState) {
    showToast('⚠️ No hay partido seleccionado.');
    return;
  }

  showToast('🎨 Generando imagen oficial del partido...');

  const canvas = document.createElement('canvas');
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  function roundRect(x, y, w, h, r, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Fondo Degradado Deep Night Blue oficial
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#02081f');
  bgGrad.addColorStop(0.5, '#031238');
  bgGrad.addColorStop(1, '#051d54');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Acentos de luz sutil en esquinas
  const cyanRadial = ctx.createRadialGradient(W * 0.2, H * 0.15, 20, W * 0.2, H * 0.15, 500);
  cyanRadial.addColorStop(0, 'rgba(0, 162, 255, 0.14)');
  cyanRadial.addColorStop(1, 'rgba(0, 162, 255, 0)');
  ctx.fillStyle = cyanRadial;
  ctx.fillRect(0, 0, W, H);

  // Marco exterior
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.35)';
  ctx.lineWidth = 4;
  roundRect(24, 24, W - 48, H - 48, 28, false, true);

  // Cabecera Institucional
  const rival = (dtMatchState.rivalName || 'RIVAL').toUpperCase();
  const round = (dtMatchState.round || 'Fecha').toUpperCase();
  const hGoals = (dtMatchState.score && typeof dtMatchState.score.home === 'number') ? dtMatchState.score.home : 0;
  const aGoals = (dtMatchState.score && typeof dtMatchState.score.away === 'number') ? dtMatchState.score.away : 0;

  // Cargar imagen de escudo
  await new Promise(resolve => {
    const crestImg = new Image();
    crestImg.crossOrigin = 'anonymous';
    crestImg.onload = () => {
      try {
        ctx.save();
        ctx.beginPath();
        ctx.arc(110, 105, 46, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#00a2ff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(crestImg, 64, 59, 92, 92);
        ctx.restore();
      } catch (e) {}
      resolve();
    };
    crestImg.onerror = () => resolve();
    crestImg.src = 'escudo-regatas-andino.png';
  });

  // Textos Cabecera
  ctx.fillStyle = '#00a2ff';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CLUB REGATAS ANDINO', 180, 85);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px system-ui, -apple-system, sans-serif';
  ctx.fillText('PLANTEL SUPERIOR B', 180, 126);

  // Badge de Reporte
  ctx.fillStyle = 'rgba(0, 162, 255, 0.15)';
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.4)';
  ctx.lineWidth = 1.5;
  roundRect(W - 275, 78, 205, 42, 21, true, true);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REPORTE OFICIAL DT', W - 172, 105);

  // Línea divisoria
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 165);
  ctx.lineTo(W - 60, 165);
  ctx.stroke();

  // Torneo & Fecha Pill
  ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 1.5;
  roundRect(W / 2 - 210, 185, 420, 42, 21, true, true);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${round} • TORNEO CLAUSURA AMH`, W / 2, 212);

  // Tarjeta Principal de Marcador (Scoreboard)
  const scoreCardY = 250;
  const scoreCardH = 210;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.3)';
  ctx.lineWidth = 2;
  roundRect(60, scoreCardY, W - 120, scoreCardH, 24, true, true);

  // Regatas (Local)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LOCAL', 100, scoreCardY + 65);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px system-ui, -apple-system, sans-serif';
  ctx.fillText('REGATAS', 100, scoreCardY + 115);

  // Círculo Tanteador Regatas
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(W / 2 - 110, scoreCardY + scoreCardH / 2, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${hGoals}`, W / 2 - 110, scoreCardY + scoreCardH / 2 + 22);

  // VS Badge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  roundRect(W / 2 - 32, scoreCardY + scoreCardH / 2 - 22, 64, 44, 12, true, false);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '900 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('VS', W / 2, scoreCardY + scoreCardH / 2 + 6);

  // Círculo Tanteador Rival
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.arc(W / 2 + 110, scoreCardY + scoreCardH / 2, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${aGoals}`, W / 2 + 110, scoreCardY + scoreCardH / 2 + 22);

  // Rival (Visitante)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('VISITANTE', W - 100, scoreCardY + 65);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px system-ui, -apple-system, sans-serif';
  let rivalDisplay = rival;
  if (ctx.measureText(rivalDisplay).width > 240) {
    while (ctx.measureText(rivalDisplay + '...').width > 240 && rivalDisplay.length > 3) {
      rivalDisplay = rivalDisplay.slice(0, -1);
    }
    rivalDisplay += '...';
  }
  ctx.fillText(rivalDisplay, W - 100, scoreCardY + 115);

  // Pill de Resultado
  let statusText = 'FINAL';
  let statusBg = 'rgba(56, 189, 248, 0.2)';
  let statusColor = '#38bdf8';
  if (hGoals > aGoals) {
    statusText = 'VICTORIA DE REGATAS';
    statusBg = 'rgba(52, 211, 153, 0.25)';
    statusColor = '#34d399';
  } else if (hGoals < aGoals) {
    statusText = 'RESULTADO FINAL';
    statusBg = 'rgba(239, 68, 68, 0.2)';
    statusColor = '#f87171';
  } else {
    statusText = 'EMPATE';
    statusBg = 'rgba(251, 191, 36, 0.2)';
    statusColor = '#fbbf24';
  }
  ctx.fillStyle = statusBg;
  roundRect(W / 2 - 130, scoreCardY + scoreCardH - 42, 260, 30, 15, true, false);
  ctx.fillStyle = statusColor;
  ctx.font = '900 14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statusText, W / 2, scoreCardY + scoreCardH - 22);

  // 4. Tabla de Rendimiento por Cuartos
  const tableY = 485;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  roundRect(60, tableY, W - 120, 310, 18, true, true);

  // Encabezado de la tabla
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  roundRect(60, tableY, W - 120, 48, 18, true, false);
  ctx.fillRect(60, tableY + 28, W - 120, 20);

  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('MÉTRICA TÁCTICA', 90, tableY + 30);

  const cols = [360, 480, 600, 720, 850];
  const colLabels = ['1°C', '2°C', '3°C', '4°C', 'TOTAL'];
  ctx.textAlign = 'center';
  cols.forEach((cx, idx) => {
    ctx.fillStyle = idx === 4 ? '#00a2ff' : '#ffffff';
    ctx.fillText(colLabels[idx], cx, tableY + 30);
  });

  const qStats = dtMatchState.quarters || {};
  const tot = {
    home: { entries: 0, corners: 0, cornerGoals: 0, goals: 0 },
    away: { entries: 0, corners: 0, cornerGoals: 0, goals: 0 }
  };
  [1, 2, 3, 4].forEach(q => {
    const cur = qStats[q] || createDefaultQuarterStats();
    ['home', 'away'].forEach(tm => {
      tot[tm].entries += cur[tm].entries || 0;
      tot[tm].corners += cur[tm].corners || 0;
      tot[tm].cornerGoals += cur[tm].cornerGoals || 0;
      tot[tm].goals += cur[tm].goals || 0;
    });
  });

  const rowData = [
    {
      label: '⚽ Goles (Reg - Riv)',
      qVals: [1, 2, 3, 4].map(q => `${(qStats[q] && qStats[q].home && qStats[q].home.goals) || 0} - ${(qStats[q] && qStats[q].away && qStats[q].away.goals) || 0}`),
      totVal: `${tot.home.goals} - ${tot.away.goals}`,
      highlight: true
    },
    {
      label: '🏑 Córners Cortos',
      qVals: [1, 2, 3, 4].map(q => `${(qStats[q] && qStats[q].home && qStats[q].home.corners) || 0} vs ${(qStats[q] && qStats[q].away && qStats[q].away.corners) || 0}`),
      totVal: `${tot.home.corners} vs ${tot.away.corners}`
    },
    {
      label: '📥 Ingresos al Área 25 yd',
      qVals: [1, 2, 3, 4].map(q => `${(qStats[q] && qStats[q].home && qStats[q].home.entries) || 0} vs ${(qStats[q] && qStats[q].away && qStats[q].away.entries) || 0}`),
      totVal: `${tot.home.entries} vs ${tot.away.entries}`
    },
    {
      label: '🎯 Efectividad de Cortos',
      qVals: [1, 2, 3, 4].map(q => {
        const c = (qStats[q] && qStats[q].home && qStats[q].home.corners) || 0;
        const cg = (qStats[q] && qStats[q].home && qStats[q].home.cornerGoals) || 0;
        return c > 0 ? Math.round((cg / c) * 100) + '%' : '-';
      }),
      totVal: tot.home.corners > 0 ? Math.round((tot.home.cornerGoals / tot.home.corners) * 100) + '%' : '-'
    },
    {
      label: '🥅 Goles de Corto',
      qVals: [1, 2, 3, 4].map(q => `${(qStats[q] && qStats[q].home && qStats[q].home.cornerGoals) || 0}`),
      totVal: `${tot.home.cornerGoals}`
    }
  ];

  rowData.forEach((row, rIdx) => {
    const ry = tableY + 52 + (rIdx * 51);
    if (rIdx % 2 === 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(60, ry, W - 120, 51);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = row.highlight ? '#38bdf8' : '#ffffff';
    ctx.font = row.highlight ? '900 16px system-ui, sans-serif' : '600 15px system-ui, sans-serif';
    ctx.fillText(row.label, 90, ry + 32);

    ctx.textAlign = 'center';
    cols.forEach((cx, cIdx) => {
      const val = cIdx === 4 ? row.totVal : row.qVals[cIdx];
      ctx.fillStyle = cIdx === 4 ? '#34d399' : (row.highlight ? '#ffffff' : '#94a3b8');
      ctx.font = cIdx === 4 ? '900 17px system-ui, sans-serif' : '600 15px system-ui, sans-serif';
      ctx.fillText(val, cx, ry + 32);
    });
  });

  // 5. Goleadoras y Tarjetas Box
  const extraY = 820;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  roundRect(60, extraY, W - 120, 160, 18, true, true);

  const scorersMap = {};
  (dtMatchState.events || []).forEach(evt => {
    if (evt.team === 'home' && evt.endedInGoal && evt.player) {
      scorersMap[evt.player] = (scorersMap[evt.player] || 0) + 1;
    }
  });
  const scorersList = Object.entries(scorersMap).sort((a, b) => b[1] - a[1]);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#00a2ff';
  ctx.font = '900 18px system-ui, sans-serif';
  ctx.fillText('⚽ GOLEADORAS REGATAS', 90, extraY + 45);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 17px system-ui, sans-serif';
  if (scorersList.length > 0) {
    const textScorers = scorersList.map(([p, count]) => `${p} (${count} gol${count > 1 ? 'es' : ''})`).join('   •   ');
    ctx.fillText(textScorers, 90, extraY + 82);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('No se registraron autoras de gol en este partido', 90, extraY + 82);
  }

  const cardsMap = { green: 0, yellow: 0, red: 0 };
  (dtMatchState.events || []).forEach(evt => {
    if (evt.team === 'home') {
      if (evt.type === 'cardGreen') cardsMap.green++;
      if (evt.type === 'cardYellow') cardsMap.yellow++;
      if (evt.type === 'cardRed') cardsMap.red++;
    }
  });
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 16px system-ui, sans-serif';
  ctx.fillText('🟨 DISCIPLINA REGATAS:', 90, extraY + 125);

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(`🟩 ${cardsMap.green} Verdes  |  🟨 ${cardsMap.yellow} Amarillas  |  🟥 ${cardsMap.red} Rojas`, 310, extraY + 125);

  // 6. Pie de Página Institucional
  const footerY = 1010;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(60, footerY);
  ctx.lineTo(W - 60, footerY);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Club Regatas Andino • Hockey Damas B', 60, footerY + 38);

  ctx.fillStyle = '#00a2ff';
  ctx.font = 'italic 700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('« Juntas somos más »', W / 2, footerY + 38);

  const nowStr = new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(nowStr, W - 60, footerY + 38);

  // 7. Descargar o Compartir imagen
  canvas.toBlob(async (blob) => {
    if (!blob) {
      showToast('⚠️ Error al generar la imagen');
      return;
    }
    const cleanRound = (dtMatchState.round || 'partido').replace(/\s+/g, '-').toLowerCase();
    const cleanRival = rival.replace(/\s+/g, '-').toLowerCase();
    const fileName = `regatas-${cleanRound}-vs-${cleanRival}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Regatas Andino vs ${rival}`,
          text: `Reporte oficial: Regatas Andino ${hGoals} - ${aGoals} ${rival}`
        });
        showToast('📲 ¡Imagen compartida con éxito!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📸 ¡Imagen oficial descargada!');
  }, 'image/png');
}

window.exportDtMatchImage = exportDtMatchImage;

// ============================================================================
// MÓDULO: 11_estadisticas.js
// ============================================================================

// VISTA 5: APARTADO DE ESTADÍSTICAS & ANÁLISIS DE RENDIMIENTO POR CUARTOS
// ============================================================================

let statsCurrentSelectedFilter = 'all';
let statsActiveSubTab = 'trends'; // 'trends' | 'quarters'
let statsTabsInitialized = false;

// Recalcular estadísticas de cuartos para cualquier objeto de partido
function recalculateMatchStats(targetMatch) {
  if (!targetMatch) return;
  const newQuarters = {
    1: createDefaultQuarterStats(),
    2: createDefaultQuarterStats(),
    3: createDefaultQuarterStats(),
    4: createDefaultQuarterStats()
  };

  let homeTotalGoals = 0;
  let awayTotalGoals = 0;

  (targetMatch.events || []).forEach(evt => {
    const q = parseInt(evt.quarter, 10) || 1;
    if (!newQuarters[q]) newQuarters[q] = createDefaultQuarterStats();
    const team = (evt.team === 'away') ? 'away' : 'home';
    const teamStats = newQuarters[q][team];
    if (!teamStats) return;

    const type = deduceEventType(evt);
    evt.type = type;

    if (type === 'entry') {
      teamStats.entries++;
    } else if (type === 'corner') {
      teamStats.corners++;
      if (evt.endedInGoal) {
        teamStats.cornerGoals++;
        teamStats.goals++;
        if (team === 'home') homeTotalGoals++; else awayTotalGoals++;
      }
    } else if (type === 'stroke') {
      teamStats.strokes++;
      if (evt.endedInGoal) {
        teamStats.strokeGoals++;
        teamStats.goals++;
        if (team === 'home') homeTotalGoals++; else awayTotalGoals++;
      }
    } else if (type === 'fieldGoal') {
      teamStats.fieldGoals++;
      teamStats.goals++;
      if (team === 'home') homeTotalGoals++; else awayTotalGoals++;
    } else if (type === 'cardGreen') {
      teamStats.green++;
    } else if (type === 'cardYellow') {
      teamStats.yellow++;
    } else if (type === 'cardRed') {
      teamStats.red++;
    }
  });

  targetMatch.quarters = newQuarters;
  targetMatch.score = { home: homeTotalGoals, away: awayTotalGoals };
}

// Al abrir la vista de estadísticas

// Actualizar y persistir indicador de última sincronización
function updateStatsLastSyncBadge(customTime) {
  let timeStr = customTime;
  if (!timeStr) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    timeStr = `${hh}:${mm} hs`;
  }
  try {
    localStorage.setItem('psb_stats_last_sync_time', timeStr);
  } catch (e) {}

  const el = document.getElementById('statsLastSyncTime');
  if (el) {
    el.textContent = `Última sinc: ${timeStr}`;
  }
}

function handleStatsViewOpen() {
  const gateCard = document.getElementById('statsAuthGateCard');
  const mainContent = document.getElementById('statsMainContent');
  const passInput = document.getElementById('inputStatsGatePassword');
  const errorMsg = document.getElementById('statsGateErrorMsg');
  const statsLockBtn = document.getElementById('btnStatsLockSession');

  if (isCtAuthenticated()) {
    if (gateCard) gateCard.style.display = 'none';
    if (mainContent) mainContent.style.display = 'flex';
    if (statsLockBtn) statsLockBtn.style.display = 'inline-flex';
    setupStatsTabs();
    loadDtMatchesStore();
    populateStatsMatchFilter();
    renderAnalyticsDashboard(statsCurrentSelectedFilter);

    // Sincronización automática silenciosa en segundo plano con Google Sheets
    if (getDtWebhookUrl()) {
      syncAllMatchesFromCloud({ silent: true });
    }
  } else {
    if (mainContent) mainContent.style.display = 'none';
    if (gateCard) gateCard.style.display = 'block';
    if (statsLockBtn) statsLockBtn.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';
    if (passInput) {
      passInput.value = '';
      setTimeout(() => passInput.focus(), 150);
    }
  }
}

async function verifyStatsPassword() {
  const passInput = document.getElementById('inputStatsGatePassword');
  const errorMsg = document.getElementById('statsGateErrorMsg');
  const entered = (passInput ? passInput.value : '').trim().toLowerCase();

  const ok = await verifyCtPassword(entered);
  if (ok) {
    setCtAuthenticated(true);
    handleStatsViewOpen();
    showToast('📈 Acceso concedido a Estadísticas');
  } else {
    if (errorMsg) errorMsg.style.display = 'block';
    if (passInput) passInput.select();
  }
}

// Inicialización de pestañas: Tendencias de Temporada vs Desglose por Cuartos
function setupStatsTabs() {
  if (statsTabsInitialized) return;
  const tabTrends = document.getElementById('tabBtnSeasonTrends');
  const tabQuarters = document.getElementById('tabBtnQuarterBreakdown');

  if (tabTrends) {
    tabTrends.addEventListener('click', () => {
      switchStatsSubTab('trends');
    });
  }

  if (tabQuarters) {
    tabQuarters.addEventListener('click', () => {
      switchStatsSubTab('quarters');
    });
  }

  statsTabsInitialized = true;
}

function switchStatsSubTab(tabName) {
  statsActiveSubTab = tabName;
  const tabTrends = document.getElementById('tabBtnSeasonTrends');
  const tabQuarters = document.getElementById('tabBtnQuarterBreakdown');
  const trendsContent = document.getElementById('statsTabTrendsContent');
  const quartersContent = document.getElementById('statsTabQuartersContent');
  const headerTitle = document.getElementById('statsHeaderTitle');
  const headerDesc = document.getElementById('statsHeaderDesc');

  if (tabTrends && tabQuarters) {
    if (tabName === 'trends') {
      tabTrends.classList.add('active');
      tabTrends.setAttribute('aria-selected', 'true');
      tabQuarters.classList.remove('active');
      tabQuarters.setAttribute('aria-selected', 'false');
      if (trendsContent) trendsContent.style.display = 'flex';
      if (quartersContent) quartersContent.style.display = 'none';
      if (headerTitle) headerTitle.textContent = 'TENDENCIAS DE LA TEMPORADA';
      if (headerDesc) headerDesc.textContent = 'Diagnóstico táctico 1T vs 2T, efectividad en cortos, evolución fecha a fecha y goleadoras de Regatas Andino B.';
    } else {
      tabQuarters.classList.add('active');
      tabQuarters.setAttribute('aria-selected', 'true');
      tabTrends.classList.remove('active');
      tabTrends.setAttribute('aria-selected', 'false');
      if (trendsContent) trendsContent.style.display = 'none';
      if (quartersContent) quartersContent.style.display = 'flex';
      if (headerTitle) headerTitle.textContent = 'DETALLE POR CUARTOS';
      if (headerDesc) headerDesc.textContent = 'Métricas consolidadas por cuarto (1°C, 2°C, 3°C, 4°C y Total) de las incidencias registradas en la botonera.';
    }
  }
}

function inspectMatchQuarters(matchKey) {
  const select = document.getElementById('selectStatsMatchFilter');
  if (select && matchKey) {
    select.value = matchKey;
  }
  switchStatsSubTab('quarters');
  renderAnalyticsDashboard(matchKey);
  const container = document.getElementById('viewEstadisticas');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.inspectMatchQuarters = inspectMatchQuarters;
window.switchStatsSubTab = switchStatsSubTab;

// Llenado del selector de partidos a analizar
function populateStatsMatchFilter() {
  const select = document.getElementById('selectStatsMatchFilter');
  if (!select) return;

  const currentVal = select.value || statsCurrentSelectedFilter || 'all';
  let html = `<option value="all">🌟 Todos los Partidos (Acumulado General)</option>`;

  // Partidos guardados en dtMatchesStore con incidencias reales
  const matchKeys = Object.keys(dtMatchesStore || {});
  const matchesWithData = matchKeys.filter(k => {
    const m = dtMatchesStore[k];
    return m && ((m.events && m.events.length > 0) || (m.score && (m.score.home > 0 || m.score.away > 0)));
  });

  if (matchesWithData.length > 0) {
    html += `<optgroup label="📋 Partidos con Incidencias">`;
    matchesWithData.forEach(k => {
      const m = dtMatchesStore[k];
      const count = (m.events || []).length;
      const score = m.score ? `${m.score.home}-${m.score.away}` : '0-0';
      const round = m.round || k;
      const rival = m.rivalName || 'Rival';
      html += `<option value="${k}">${escapeHtml(round)} vs ${escapeHtml(rival)} (${score} • ${count} evts)</option>`;
    });
    html += `</optgroup>`;
  }

  select.innerHTML = html;
  if ([...select.options].some(opt => opt.value === currentVal)) {
    select.value = currentVal;
  } else {
    select.value = 'all';
  }
}

// Cálculo agregado de métricas cuarto por cuarto
function getAggregatedQuarterStats(selectedKey = 'all') {
  statsCurrentSelectedFilter = selectedKey;

  // Sincronizar partido activo actual en memoria con el almacén multi-partido
  if (typeof dtMatchState !== 'undefined' && dtMatchState && typeof dtCurrentMatchKey !== 'undefined' && dtCurrentMatchKey) {
    if (typeof dtMatchesStore === 'undefined' || !dtMatchesStore) dtMatchesStore = {};
    dtMatchesStore[dtCurrentMatchKey] = dtMatchState;
  }

  // Colección de partidos a incluir (solo con datos reales cuando es acumulado)
  let targetMatches = [];
  if (selectedKey === 'all') {
    targetMatches = Object.values(dtMatchesStore || {}).filter(m => m && ((m.events && m.events.length > 0) || (m.score && (m.score.home > 0 || m.score.away > 0))));
    if (targetMatches.length === 0 && dtMatchState && ((dtMatchState.events && dtMatchState.events.length > 0) || (dtMatchState.score && (dtMatchState.score.home > 0 || dtMatchState.score.away > 0)))) {
      targetMatches = [dtMatchState];
    }
  } else if (dtMatchesStore[selectedKey]) {
    targetMatches = [dtMatchesStore[selectedKey]];
  } else if (dtMatchState) {
    targetMatches = [dtMatchState];
  }

  // Estructura de cuartos 1 a 4 + total
  const initTeamData = () => ({
    entries: 0,
    corners: 0,
    cornerGoals: 0,
    cornerEff: 0,
    strokes: 0,
    strokeGoals: 0,
    strokeEff: 0,
    fieldGoals: 0,
    goals: 0,
    conversion: 0,
    green: 0,
    yellow: 0,
    red: 0
  });

  const quarters = {
    1: { home: initTeamData(), away: initTeamData() },
    2: { home: initTeamData(), away: initTeamData() },
    3: { home: initTeamData(), away: initTeamData() },
    4: { home: initTeamData(), away: initTeamData() },
    total: { home: initTeamData(), away: initTeamData() }
  };

  let totalEventsCount = 0;
  let matchesWithDataCount = 0;

  targetMatches.forEach(m => {
    recalculateMatchStats(m);
    const evts = m.events || [];
    totalEventsCount += evts.length;
    if (evts.length > 0) matchesWithDataCount++;

    for (let q = 1; q <= 4; q++) {
      const qData = m.quarters && m.quarters[q] ? m.quarters[q] : createDefaultQuarterStats();

      ['home', 'away'].forEach(team => {
        const src = qData[team] || {};
        const dest = quarters[q][team];
        const tot = quarters.total[team];

        const entries = src.entries || 0;
        const corners = src.corners || 0;
        const cornerGoals = src.cornerGoals || 0;
        const strokes = src.strokes || 0;
        const strokeGoals = src.strokeGoals || 0;
        const fieldGoals = src.fieldGoals || 0;
        const goals = src.goals || (cornerGoals + strokeGoals + fieldGoals);
        const green = src.green || 0;
        const yellow = src.yellow || 0;
        const red = src.red || 0;

        dest.entries += entries;
        dest.corners += corners;
        dest.cornerGoals += cornerGoals;
        dest.strokes += strokes;
        dest.strokeGoals += strokeGoals;
        dest.fieldGoals += fieldGoals;
        dest.goals += goals;
        dest.green += green;
        dest.yellow += yellow;
        dest.red += red;

        tot.entries += entries;
        tot.corners += corners;
        tot.cornerGoals += cornerGoals;
        tot.strokes += strokes;
        tot.strokeGoals += strokeGoals;
        tot.fieldGoals += fieldGoals;
        tot.goals += goals;
        tot.green += green;
        tot.yellow += yellow;
        tot.red += red;
      });
    }
  });

  // Calcular porcentajes y efectividades
  [1, 2, 3, 4, 'total'].forEach(qKey => {
    ['home', 'away'].forEach(team => {
      const data = quarters[qKey][team];
      data.cornerEff = data.corners > 0 ? Math.round((data.cornerGoals / data.corners) * 100) : 0;
      data.strokeEff = data.strokes > 0 ? Math.round((data.strokeGoals / data.strokes) * 100) : 0;
      data.conversion = data.entries > 0 ? Math.round((data.goals / data.entries) * 100) : 0;
    });
  });

  // Insights tácticos
  let bestQByGoals = { q: 1, val: -1 };
  let bestQByEntries = { q: 1, val: -1 };
  let bestQByDiff = { q: 1, val: -999 };
  let hardestQDef = { q: 1, val: -1 };

  for (let q = 1; q <= 4; q++) {
    const hGoals = quarters[q].home.goals;
    const hEntries = quarters[q].home.entries;
    const diff = hGoals - quarters[q].away.goals;
    const aEntries = quarters[q].away.entries;

    if (hGoals > bestQByGoals.val) {
      bestQByGoals = { q, val: hGoals, entries: hEntries };
    }
    if (hEntries > bestQByEntries.val) {
      bestQByEntries = { q, val: hEntries, goals: hGoals };
    }
    if (diff > bestQByDiff.val) {
      bestQByDiff = { q, val: diff };
    }
    if (aEntries > hardestQDef.val) {
      hardestQDef = { q, val: aEntries, goals: quarters[q].away.goals };
    }
  }

  return {
    selectedKey,
    matchesCount: targetMatches.length,
    matchesWithDataCount,
    totalEventsCount,
    quarters,
    bestQByGoals,
    bestQByEntries,
    bestQByDiff,
    hardestQDef
  };
}

// Cálculo agregado de métricas de Tendencias de Temporada (1T vs 2T, campaña, goleadoras, timeline)
function getSeasonTrendsData(selectedKey = 'all') {
  // Sincronizar partido activo actual en memoria con el almacén multi-partido
  if (typeof dtMatchState !== 'undefined' && dtMatchState && typeof dtCurrentMatchKey !== 'undefined' && dtCurrentMatchKey) {
    if (typeof dtMatchesStore === 'undefined' || !dtMatchesStore) dtMatchesStore = {};
    dtMatchesStore[dtCurrentMatchKey] = dtMatchState;
  }

  let matchesList = [];
  const matchKeys = Object.keys(dtMatchesStore || {});

  if (selectedKey === 'all') {
    if (matchKeys.length > 0) {
      matchKeys.forEach(k => {
        const m = dtMatchesStore[k];
        if (m && ((m.events && m.events.length > 0) || (m.score && (m.score.home > 0 || m.score.away > 0)))) {
          recalculateMatchStats(m);
          matchesList.push(m);
        }
      });
    } else if (dtMatchState && ((dtMatchState.events && dtMatchState.events.length > 0) || (dtMatchState.score && (dtMatchState.score.home > 0 || dtMatchState.score.away > 0)))) {
      recalculateMatchStats(dtMatchState);
      matchesList.push(dtMatchState);
    }
  } else if (dtMatchesStore[selectedKey]) {
    recalculateMatchStats(dtMatchesStore[selectedKey]);
    matchesList = [dtMatchesStore[selectedKey]];
  } else if (dtMatchState) {
    recalculateMatchStats(dtMatchState);
    matchesList = [dtMatchState];
  }

  // Ordenar cronológicamente por número de fecha
  matchesList.sort((a, b) => {
    const numA = parseInt((a.round || '').replace(/\D+/g, ''), 10) || 0;
    const numB = parseInt((b.round || '').replace(/\D+/g, ''), 10) || 0;
    return numA - numB;
  });

  let wins = 0, draws = 0, losses = 0;
  let totalGF = 0, totalGC = 0;
  let totalEntriesHome = 0, totalEntriesAway = 0;
  let totalCornersHome = 0, cornerGoalsHome = 0;
  let totalCornersAway = 0, cornerGoalsAway = 0;
  let totalStrokesHome = 0, strokeGoalsHome = 0;
  let totalStrokesAway = 0, strokeGoalsAway = 0;

  // 1T vs 2T
  const halves = {
    first: {
      entriesHome: 0, entriesAway: 0,
      goalsHome: 0, goalsAway: 0,
      cornersHome: 0, cornerGoalsHome: 0,
      cornersAway: 0, cornerGoalsAway: 0,
      cardsHome: { green: 0, yellow: 0, red: 0 }
    },
    second: {
      entriesHome: 0, entriesAway: 0,
      goalsHome: 0, goalsAway: 0,
      cornersHome: 0, cornerGoalsHome: 0,
      cornersAway: 0, cornerGoalsAway: 0,
      cardsHome: { green: 0, yellow: 0, red: 0 }
    }
  };

  const scorersMap = {};
  const cardsMap = {};
  const cornersWonMap = {};
  const matchChronology = [];

  matchesList.forEach(m => {
    const hGoals = (m.score && typeof m.score.home === 'number') ? m.score.home : 0;
    const aGoals = (m.score && typeof m.score.away === 'number') ? m.score.away : 0;
    totalGF += hGoals;
    totalGC += aGoals;

    let res = 'draw';
    if (hGoals > aGoals) { wins++; res = 'win'; }
    else if (hGoals < aGoals) { losses++; res = 'loss'; }
    else { draws++; res = 'draw'; }

    let matchEntriesH = 0, matchEntriesA = 0;
    let matchCornersH = 0, matchCornerGoalsH = 0;

    for (let q = 1; q <= 4; q++) {
      const qData = (m.quarters && m.quarters[q]) ? m.quarters[q] : createDefaultQuarterStats();
      const h = qData.home || {};
      const a = qData.away || {};

      totalEntriesHome += (h.entries || 0);
      totalEntriesAway += (a.entries || 0);
      matchEntriesH += (h.entries || 0);
      matchEntriesA += (a.entries || 0);

      totalCornersHome += (h.corners || 0);
      cornerGoalsHome += (h.cornerGoals || 0);
      matchCornersH += (h.corners || 0);
      matchCornerGoalsH += (h.cornerGoals || 0);

      totalCornersAway += (a.corners || 0);
      cornerGoalsAway += (a.cornerGoals || 0);

      totalStrokesHome += (h.strokes || 0);
      strokeGoalsHome += (h.strokeGoals || 0);
      totalStrokesAway += (a.strokes || 0);
      strokeGoalsAway += (a.strokeGoals || 0);

      const halfKey = (q <= 2) ? 'first' : 'second';
      const half = halves[halfKey];

      half.entriesHome += (h.entries || 0);
      half.entriesAway += (a.entries || 0);
      half.goalsHome += (h.goals || 0);
      half.goalsAway += (a.goals || 0);
      half.cornersHome += (h.corners || 0);
      half.cornerGoalsHome += (h.cornerGoals || 0);
      half.cornersAway += (a.corners || 0);
      half.cornerGoalsAway += (a.cornerGoals || 0);
      half.cardsHome.green += (h.green || 0);
      half.cardsHome.yellow += (h.yellow || 0);
      half.cardsHome.red += (h.red || 0);
    }

    // Eventos individuales
    (m.events || []).forEach(evt => {
      const team = evt.team === 'away' ? 'away' : 'home';
      const type = evt.type || deduceEventType(evt);
      const isGoal = evt.endedInGoal === true || type === 'fieldGoal';
      const playerName = (evt.player || '').trim();

      if (team === 'home') {
        if (isGoal) {
          const key = playerName || 'Sin especificar';
          if (!scorersMap[key]) {
            scorersMap[key] = { name: key, total: 0, field: 0, corner: 0, stroke: 0 };
          }
          scorersMap[key].total++;
          if (type === 'corner') scorersMap[key].corner++;
          else if (type === 'stroke') scorersMap[key].stroke++;
          else scorersMap[key].field++;
        }

        if (type === 'corner') {
          // Extraer la jugadora que provocó o ejecutó el córner
          let wonByPlayer = (evt.wonBy || '').trim();
          if (!wonByPlayer && evt.label) {
            const mWon = evt.label.match(/Provocó:\s*([^)\].]+)/i);
            if (mWon) wonByPlayer = mWon[1].trim();
          }
          if (!wonByPlayer && playerName) {
            wonByPlayer = playerName;
          }

          if (wonByPlayer) {
            if (!cornersWonMap[wonByPlayer]) {
              cornersWonMap[wonByPlayer] = { name: wonByPlayer, total: 0, resultedInGoal: 0 };
            }
            cornersWonMap[wonByPlayer].total++;
            if (isGoal) {
              cornersWonMap[wonByPlayer].resultedInGoal++;
            }
          }
        }

        if (type === 'cardGreen' || type === 'cardYellow' || type === 'cardRed') {
          const key = playerName || 'Jugadora no especificada';
          if (!cardsMap[key]) {
            cardsMap[key] = { name: key, green: 0, yellow: 0, red: 0, penaltyMinutes: 0 };
          }
          if (type === 'cardGreen') {
            cardsMap[key].green++;
            cardsMap[key].penaltyMinutes += 2;
          } else if (type === 'cardYellow') {
            cardsMap[key].yellow++;
            cardsMap[key].penaltyMinutes += 5;
          } else if (type === 'cardRed') {
            cardsMap[key].red++;
            cardsMap[key].penaltyMinutes += 60;
          }
        }
      }
    });

    const mKey = m.key || (m.round ? getMatchKey('primera', m.round) : '');
    matchChronology.push({
      key: mKey,
      round: m.round || 'Fecha',
      rival: m.rivalName || 'Rival',
      date: m.date || '',
      homeScore: hGoals,
      awayScore: aGoals,
      result: res,
      entriesHome: matchEntriesH,
      entriesAway: matchEntriesA,
      cornersHome: matchCornersH,
      cornerGoalsHome: matchCornerGoalsH,
      eventCount: (m.events || []).length
    });
  });

  const playedCount = matchesList.length;
  const points = wins * 3 + draws * 1;
  const maxPossiblePoints = playedCount > 0 ? playedCount * 3 : 0;
  const pointsEff = maxPossiblePoints > 0 ? Math.round((points / maxPossiblePoints) * 100) : 0;

  const cornerEffHome = totalCornersHome > 0 ? Math.round((cornerGoalsHome / totalCornersHome) * 100) : 0;
  const cornerDefHome = totalCornersAway > 0 ? Math.round(((totalCornersAway - cornerGoalsAway) / totalCornersAway) * 100) : 100;
  const conversionHome = totalEntriesHome > 0 ? Math.round((totalGF / totalEntriesHome) * 100) : 0;

  const scorersList = Object.values(scorersMap).sort((a, b) => b.total - a.total);
  const cardsList = Object.values(cardsMap).sort((a, b) => b.penaltyMinutes - a.penaltyMinutes);
  const cornersWonList = Object.values(cornersWonMap).sort((a, b) => b.total - a.total);

  return {
    selectedKey,
    playedCount,
    wins,
    draws,
    losses,
    points,
    pointsEff,
    totalGF,
    totalGC,
    goalDiff: totalGF - totalGC,
    avgGF: playedCount > 0 ? (totalGF / playedCount).toFixed(1) : '0',
    avgGC: playedCount > 0 ? (totalGC / playedCount).toFixed(1) : '0',
    totalEntriesHome,
    totalEntriesAway,
    avgEntriesHome: playedCount > 0 ? (totalEntriesHome / playedCount).toFixed(1) : '0',
    avgEntriesAway: playedCount > 0 ? (totalEntriesAway / playedCount).toFixed(1) : '0',
    totalCornersHome,
    cornerGoalsHome,
    cornerEffHome,
    totalCornersAway,
    cornerGoalsAway,
    cornerDefHome,
    conversionHome,
    halves,
    scorersList,
    cardsList,
    cornersWonList,
    matchChronology
  };
}

// Diagnósticos tácticos automáticos del DT basados en datos
function generateSeasonTacticalDiagnosis(trends) {
  const h1 = trends.halves.first;
  const h2 = trends.halves.second;
  const insights = [];

  const totalGoals = trends.totalGF;
  if (totalGoals > 0) {
    const h1GoalsPct = Math.round((h1.goalsHome / totalGoals) * 100);
    const h2GoalsPct = Math.round((h2.goalsHome / totalGoals) * 100);

    if (h2GoalsPct >= 60) {
      insights.push({
        type: 'positive',
        icon: '🔥',
        title: 'Potencia en Segundos Tiempos',
        desc: `El ${h2GoalsPct}% de los goles de Regatas se convierten en el 2° Tiempo (3°C y 4°C). Gran lectura y definición tras el entretiempo.`
      });
    } else if (h1GoalsPct >= 60) {
      insights.push({
        type: 'positive',
        icon: '⚡',
        title: 'Golpes de Entrada Tempranos',
        desc: `El ${h1GoalsPct}% de los goles se marcaron en el 1° Tiempo. Regatas sale con intensidad alta y golpea rápido en los partidos.`
      });
    } else {
      insights.push({
        type: 'neutral',
        icon: '⚖️',
        title: 'Producción Ofensiva Constante',
        desc: `Distribución balanceada de goles entre la 1ra mitad (${h1.goalsHome}) y la 2da mitad (${h2.goalsHome}). Ritmo parejo a lo largo de los 60 minutos.`
      });
    }
  }

  const totalConceded = trends.totalGC;
  if (totalConceded > 0) {
    const h2ConcededPct = Math.round((h2.goalsAway / totalConceded) * 100);
    if (h2ConcededPct >= 65) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Atención al Cierre de los Partidos',
        desc: `El ${h2ConcededPct}% de los goles rivales se reciben en el 2° Tiempo. Conviene ajustar rotaciones o mantener el bloque defensivo ante el desgaste físico final.`
      });
    } else if (h2ConcededPct <= 35) {
      insights.push({
        type: 'positive',
        icon: '🛡️',
        title: 'Cierres Defensivos Sólidos',
        desc: `Apenas el ${h2ConcededPct}% de los goles en contra ocurren en la segunda mitad. Gran resistencia y cierre de líneas en los tramos decisivos.`
      });
    }
  }

  if (trends.totalCornersHome >= 2) {
    if (trends.cornerEffHome >= 20) {
      insights.push({
        type: 'positive',
        icon: '🎯',
        title: 'Arma Ofensiva: Córner Corto',
        desc: `Alta efectividad del ${trends.cornerEffHome}% en jugadas preparadas de corto (${trends.cornerGoalsHome} goles en ${trends.totalCornersHome} CC). Clave para abrir partidos cerrados.`
      });
    } else {
      insights.push({
        type: 'warning',
        icon: '💡',
        title: 'Oportunidad de Mejora en Cortos',
        desc: `Efectividad del ${trends.cornerEffHome}% en córner corto a favor (${trends.cornerGoalsHome} gol en ${trends.totalCornersHome} CC). Se generan ocasiones pero falta capitalizar la arrastrada o desvío.`
      });
    }
  }

  if (trends.cornersWonList && trends.cornersWonList.length > 0) {
    const topGeneradora = trends.cornersWonList[0];
    if (topGeneradora.total >= 2) {
      insights.push({
        type: 'positive',
        icon: '🏑',
        title: `Desequilibrio Individual: ${topGeneradora.name}`,
        desc: `Es la jugadora que más córners cortos generó en el equipo (${topGeneradora.total} CC provocados${topGeneradora.resultedInGoal > 0 ? `, ${topGeneradora.resultedInGoal} terminaron en gol` : ''}). Gran capacidad individual para forzar faltas en el área rival.`
      });
    }
  }

  if (trends.totalCornersAway >= 2) {
    if (trends.cornerDefHome >= 80) {
      insights.push({
        type: 'positive',
        icon: '🧤',
        title: 'Gran Muralla en Cortos Defensivos',
        desc: `Se neutralizó el ${trends.cornerDefHome}% de los córners cortos rivales concedidos (${trends.totalCornersAway - trends.cornerGoalsAway} defendidos de ${trends.totalCornersAway}).`
      });
    }
  }

  if (trends.totalEntriesHome > 0 && trends.totalEntriesAway > 0) {
    const diff = trends.totalEntriesHome - trends.totalEntriesAway;
    if (diff > 0) {
      insights.push({
        type: 'positive',
        icon: '📈',
        title: 'Dominio Territorial Acumulado',
        desc: `Promedio de ${trends.avgEntriesHome} ingresos al área rival por partido (+${diff} sobre rivales). Regatas impone condiciones en campo contrario.`
      });
    }
  }

  return insights;
}

// Renderizado principal del Dashboard de Estadísticas
function renderAnalyticsDashboard(selectedKey = 'all') {
  setupStatsTabs();

  // 1. Renderizar Pestaña de Tendencias de Temporada
  const seasonTrends = getSeasonTrendsData(selectedKey);
  renderSeasonTrends(seasonTrends);

  // 2. Renderizar Pestaña de Desglose por Cuartos
  const stats = getAggregatedQuarterStats(selectedKey);
  const q = stats.quarters;
  const totH = q.total.home;
  const totA = q.total.away;

  // 1. Tarjetas de KPIs Clave
  const kpiGrid = document.getElementById('statsKpiGrid');
  if (kpiGrid) {
    const goalDiff = totH.goals - totA.goals;
    const goalDiffSign = goalDiff > 0 ? `+${goalDiff}` : `${goalDiff}`;
    const entryDiff = totH.entries - totA.entries;
    const entryDiffSign = entryDiff > 0 ? `+${entryDiff}` : `${entryDiff}`;

    kpiGrid.innerHTML = `
      <div class="stats-kpi-card">
        <div class="stats-kpi-header">
          <span class="stats-kpi-icon">⚽</span>
          <span class="stats-kpi-title">GOLES & DIFERENCIAL</span>
        </div>
        <div class="stats-kpi-val">${totH.goals} - ${totA.goals} <small style="font-size:0.75rem; color:${goalDiff >= 0 ? '#34d399':'#f87171'};">(${goalDiffSign})</small></div>
        <div class="stats-kpi-sub">Conversión: ${totH.conversion}% de goles por ingreso</div>
      </div>

      <div class="stats-kpi-card">
        <div class="stats-kpi-header">
          <span class="stats-kpi-icon">📥</span>
          <span class="stats-kpi-title">INGRESOS AL ÁREA</span>
        </div>
        <div class="stats-kpi-val">${totH.entries} vs ${totA.entries}</div>
        <div class="stats-kpi-sub">Balance territorial: ${entryDiffSign} a favor</div>
      </div>

      <div class="stats-kpi-card">
        <div class="stats-kpi-header">
          <span class="stats-kpi-icon">🏑</span>
          <span class="stats-kpi-title">CÓRNERS CORTOS</span>
        </div>
        <div class="stats-kpi-val">${totH.cornerGoals}/${totH.corners} <small style="font-size:0.75rem; color:#38bdf8;">(${totH.cornerEff}%)</small></div>
        <div class="stats-kpi-sub">Rival concedió: ${totA.cornerGoals}/${totA.corners} (${totA.cornerEff}%)</div>
      </div>

      <div class="stats-kpi-card">
        <div class="stats-kpi-header">
          <span class="stats-kpi-icon">⚡</span>
          <span class="stats-kpi-title">MEJOR CUARTO</span>
        </div>
        <div class="stats-kpi-val">${stats.bestQByEntries.q}° Cuarto</div>
        <div class="stats-kpi-sub">${stats.bestQByEntries.val} ingresos y ${stats.bestQByGoals.val} goles marcados</div>
      </div>
    `;
  }

  // 2. Gráfico de Barras Comparativas por Cuarto
  const barsContainer = document.getElementById('statsBarsContainer');
  if (barsContainer) {
    let barsHtml = '';
    for (let c = 1; c <= 4; c++) {
      const qH = q[c].home;
      const qA = q[c].away;
      const totalEntries = qH.entries + qA.entries;
      let homePct = totalEntries > 0 ? Math.round((qH.entries / totalEntries) * 100) : 50;
      let awayPct = 100 - homePct;

      const qGoalDiff = qH.goals - qA.goals;
      let badgeHtml = '';
      if (qGoalDiff > 0) {
        badgeHtml = `<span class="stats-quarter-badge stats-badge-win">Ganado +${qGoalDiff} (${qH.goals}-${qA.goals})</span>`;
      } else if (qGoalDiff === 0) {
        badgeHtml = `<span class="stats-quarter-badge stats-badge-draw">Empatado (${qH.goals}-${qA.goals})</span>`;
      } else {
        badgeHtml = `<span class="stats-quarter-badge stats-badge-loss">Abajo ${qGoalDiff} (${qH.goals}-${qA.goals})</span>`;
      }

      barsHtml += `
        <div class="stats-quarter-bar-row">
          <div class="stats-quarter-bar-head">
            <span class="stats-quarter-name">${c}° Cuarto</span>
            ${badgeHtml}
          </div>
          <div class="stats-dual-bar-track">
            <div class="stats-bar-home" style="width: ${homePct}%;" title="Regatas: ${qH.entries} ingresos (${homePct}%)"></div>
            <div class="stats-bar-away" style="width: ${awayPct}%;" title="Rival: ${qA.entries} ingresos (${awayPct}%)"></div>
          </div>
          <div class="stats-bar-legend">
            <span class="stats-legend-home">🔵 Regatas: ${qH.entries} ing. • ${qH.goals} gol${qH.goals === 1 ? '' : 'es'} (${qH.corners} CC)</span>
            <span class="stats-legend-away">🔴 Rival: ${qA.entries} ing. • ${qA.goals} gol${qA.goals === 1 ? '' : 'es'} (${qA.corners} CC)</span>
          </div>
        </div>
      `;
    }
    barsContainer.innerHTML = barsHtml;
  }

  // 3. Matriz Comparativa Completa por Cuartos
  const matrixWrap = document.getElementById('statsMatrixWrap');
  if (matrixWrap) {
    const q1H = q[1].home, q2H = q[2].home, q3H = q[3].home, q4H = q[4].home, totH = q.total.home;
    const q1A = q[1].away, q2A = q[2].away, q3A = q[3].away, q4A = q[4].away, totA = q.total.away;

    matrixWrap.innerHTML = `
      <table class="stats-matrix-table">
        <thead>
          <tr>
            <th>MÉTRICA / INCIDENCIA</th>
            <th>1° C</th>
            <th>2° C</th>
            <th>3° C</th>
            <th>4° C</th>
            <th class="total-col">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <!-- SECCIÓN: REGATAS ANDINO B (A FAVOR) -->
          <tr class="stats-sec-home">
            <td colspan="6">🔵 REGATAS ANDINO B (A FAVOR)</td>
          </tr>
          <tr>
            <td>📥 Ingresos al Área</td>
            <td>${q1H.entries}</td>
            <td>${q2H.entries}</td>
            <td>${q3H.entries}</td>
            <td>${q4H.entries}</td>
            <td class="total-col">${totH.entries}</td>
          </tr>
          <tr>
            <td>🏑 Córners Cortos Obtenidos</td>
            <td>${q1H.corners}</td>
            <td>${q2H.corners}</td>
            <td>${q3H.corners}</td>
            <td>${q4H.corners}</td>
            <td class="total-col">${totH.corners}</td>
          </tr>
          <tr>
            <td>🥅 Goles de Córner Corto</td>
            <td>${q1H.cornerGoals}</td>
            <td>${q2H.cornerGoals}</td>
            <td>${q3H.cornerGoals}</td>
            <td>${q4H.cornerGoals}</td>
            <td class="total-col">${totH.cornerGoals}</td>
          </tr>
          <tr>
            <td>🎯 Efectividad Córner (%)</td>
            <td>${q1H.cornerEff}%</td>
            <td>${q2H.cornerEff}%</td>
            <td>${q3H.cornerEff}%</td>
            <td>${q4H.cornerEff}%</td>
            <td class="total-col">${totH.cornerEff}%</td>
          </tr>
          <tr>
            <td>🎯 Penales Obtenidos</td>
            <td>${q1H.strokes}</td>
            <td>${q2H.strokes}</td>
            <td>${q3H.strokes}</td>
            <td>${q4H.strokes}</td>
            <td class="total-col">${totH.strokes}</td>
          </tr>
          <tr>
            <td>🥅 Goles de Penal</td>
            <td>${q1H.strokeGoals}</td>
            <td>${q2H.strokeGoals}</td>
            <td>${q3H.strokeGoals}</td>
            <td>${q4H.strokeGoals}</td>
            <td class="total-col">${totH.strokeGoals}</td>
          </tr>
          <tr>
            <td>⚽ Goles de Jugada</td>
            <td>${q1H.fieldGoals}</td>
            <td>${q2H.fieldGoals}</td>
            <td>${q3H.fieldGoals}</td>
            <td>${q4H.fieldGoals}</td>
            <td class="total-col">${totH.fieldGoals}</td>
          </tr>
          <tr class="stats-row-highlight">
            <td>🏆 GOLES TOTALES REGATAS</td>
            <td><strong>${q1H.goals}</strong></td>
            <td><strong>${q2H.goals}</strong></td>
            <td><strong>${q3H.goals}</strong></td>
            <td><strong>${q4H.goals}</strong></td>
            <td class="total-col"><strong>${totH.goals}</strong></td>
          </tr>
          <tr>
            <td>📈 Tasa Conversión (Gol/Ingreso)</td>
            <td>${q1H.conversion}%</td>
            <td>${q2H.conversion}%</td>
            <td>${q3H.conversion}%</td>
            <td>${q4H.conversion}%</td>
            <td class="total-col">${totH.conversion}%</td>
          </tr>
          <tr>
            <td>🟩 Tarjetas Verdes (2 min)</td>
            <td>${q1H.green}</td>
            <td>${q2H.green}</td>
            <td>${q3H.green}</td>
            <td>${q4H.green}</td>
            <td class="total-col">${totH.green}</td>
          </tr>
          <tr>
            <td>🟨 Tarjetas Amarillas (5 min)</td>
            <td>${q1H.yellow}</td>
            <td>${q2H.yellow}</td>
            <td>${q3H.yellow}</td>
            <td>${q4H.yellow}</td>
            <td class="total-col">${totH.yellow}</td>
          </tr>
          <tr>
            <td>🟥 Tarjetas Rojas (Expulsión)</td>
            <td>${q1H.red}</td>
            <td>${q2H.red}</td>
            <td>${q3H.red}</td>
            <td>${q4H.red}</td>
            <td class="total-col">${totH.red}</td>
          </tr>

          <!-- SECCIÓN: RIVAL (EN CONTRA) -->
          <tr class="stats-sec-away">
            <td colspan="6">🔴 RIVAL (EN CONTRA)</td>
          </tr>
          <tr>
            <td>📥 Ingresos al Área Rival</td>
            <td>${q1A.entries}</td>
            <td>${q2A.entries}</td>
            <td>${q3A.entries}</td>
            <td>${q4A.entries}</td>
            <td class="total-col">${totA.entries}</td>
          </tr>
          <tr>
            <td>🏑 Córners Cortos Concedidos</td>
            <td>${q1A.corners}</td>
            <td>${q2A.corners}</td>
            <td>${q3A.corners}</td>
            <td>${q4A.corners}</td>
            <td class="total-col">${totA.corners}</td>
          </tr>
          <tr>
            <td>🥅 Goles de Córner Rival</td>
            <td>${q1A.cornerGoals}</td>
            <td>${q2A.cornerGoals}</td>
            <td>${q3A.cornerGoals}</td>
            <td>${q4A.cornerGoals}</td>
            <td class="total-col">${totA.cornerGoals}</td>
          </tr>
          <tr>
            <td>🎯 Penales Concedidos Rival</td>
            <td>${q1A.strokes}</td>
            <td>${q2A.strokes}</td>
            <td>${q3A.strokes}</td>
            <td>${q4A.strokes}</td>
            <td class="total-col">${totA.strokes}</td>
          </tr>
          <tr>
            <td>⚽ Goles de Jugada Rival</td>
            <td>${q1A.fieldGoals}</td>
            <td>${q2A.fieldGoals}</td>
            <td>${q3A.fieldGoals}</td>
            <td>${q4A.fieldGoals}</td>
            <td class="total-col">${totA.fieldGoals}</td>
          </tr>
          <tr class="stats-row-highlight">
            <td>🛑 GOLES TOTALES RIVAL</td>
            <td><strong>${q1A.goals}</strong></td>
            <td><strong>${q2A.goals}</strong></td>
            <td><strong>${q3A.goals}</strong></td>
            <td><strong>${q4A.goals}</strong></td>
            <td class="total-col"><strong>${totA.goals}</strong></td>
          </tr>
          <tr>
            <td>🟨 Tarjetas Totales Rival</td>
            <td>${q1A.green + q1A.yellow + q1A.red}</td>
            <td>${q2A.green + q2A.yellow + q2A.red}</td>
            <td>${q3A.green + q3A.yellow + q3A.red}</td>
            <td>${q4A.green + q4A.yellow + q4A.red}</td>
            <td class="total-col">${totA.green + totA.yellow + totA.red}</td>
          </tr>

          <!-- SECCIÓN: BALANCE TÁCTICO & DIFERENCIAL -->
          <tr class="stats-sec-balance">
            <td colspan="6">⚖️ BALANCE & DIFERENCIAL TÁCTICO</td>
          </tr>
          <tr class="stats-row-highlight">
            <td>⚖️ Diferencial de Goles (+ / -)</td>
            <td style="color:${(q1H.goals - q1A.goals) >= 0 ? '#34d399':'#f87171'}">${(q1H.goals - q1A.goals) > 0 ? '+':''}${q1H.goals - q1A.goals}</td>
            <td style="color:${(q2H.goals - q2A.goals) >= 0 ? '#34d399':'#f87171'}">${(q2H.goals - q2A.goals) > 0 ? '+':''}${q2H.goals - q2A.goals}</td>
            <td style="color:${(q3H.goals - q3A.goals) >= 0 ? '#34d399':'#f87171'}">${(q3H.goals - q3A.goals) > 0 ? '+':''}${q3H.goals - q3A.goals}</td>
            <td style="color:${(q4H.goals - q4A.goals) >= 0 ? '#34d399':'#f87171'}">${(q4H.goals - q4A.goals) > 0 ? '+':''}${q4H.goals - q4A.goals}</td>
            <td class="total-col" style="color:${(totH.goals - totA.goals) >= 0 ? '#34d399':'#f87171'}"><strong>${(totH.goals - totA.goals) > 0 ? '+':''}${totH.goals - totA.goals}</strong></td>
          </tr>
          <tr>
            <td>📊 Balance Ingresos al Área (+ / -)</td>
            <td style="color:${(q1H.entries - q1A.entries) >= 0 ? '#34d399':'#f87171'}">${(q1H.entries - q1A.entries) > 0 ? '+':''}${q1H.entries - q1A.entries}</td>
            <td style="color:${(q2H.entries - q2A.entries) >= 0 ? '#34d399':'#f87171'}">${(q2H.entries - q2A.entries) > 0 ? '+':''}${q2H.entries - q2A.entries}</td>
            <td style="color:${(q3H.entries - q3A.entries) >= 0 ? '#34d399':'#f87171'}">${(q3H.entries - q3A.entries) > 0 ? '+':''}${q3H.entries - q3A.entries}</td>
            <td style="color:${(q4H.entries - q4A.entries) >= 0 ? '#34d399':'#f87171'}">${(q4H.entries - q4A.entries) > 0 ? '+':''}${q4H.entries - q4A.entries}</td>
            <td class="total-col" style="color:${(totH.entries - totA.entries) >= 0 ? '#34d399':'#f87171'}">${(totH.entries - totA.entries) > 0 ? '+':''}${totH.entries - totA.entries}</td>
          </tr>
          <tr>
            <td>🏑 Balance Córners Cortos (+ / -)</td>
            <td style="color:${(q1H.corners - q1A.corners) >= 0 ? '#34d399':'#f87171'}">${(q1H.corners - q1A.corners) > 0 ? '+':''}${q1H.corners - q1A.corners}</td>
            <td style="color:${(q2H.corners - q2A.corners) >= 0 ? '#34d399':'#f87171'}">${(q2H.corners - q2A.corners) > 0 ? '+':''}${q2H.corners - q2A.corners}</td>
            <td style="color:${(q3H.corners - q3A.corners) >= 0 ? '#34d399':'#f87171'}">${(q3H.corners - q3A.corners) > 0 ? '+':''}${q3H.corners - q3A.corners}</td>
            <td style="color:${(q4H.corners - q4A.corners) >= 0 ? '#34d399':'#f87171'}">${(q4H.corners - q4A.corners) > 0 ? '+':''}${q4H.corners - q4A.corners}</td>
            <td class="total-col" style="color:${(totH.corners - totA.corners) >= 0 ? '#34d399':'#f87171'}">${(totH.corners - totA.corners) > 0 ? '+':''}${totH.corners - totA.corners}</td>
          </tr>
        </tbody>
      </table>

      <!-- RENDIMIENTO INDIVIDUAL (GOLEADORAS, GENERADORAS DE CORTO Y TARJETAS) -->
      <section class="stats-halves-card" style="margin-top: 14px;">
        <div class="stats-card-header">
          <span class="stats-card-icon">⭐</span>
          <div>
            <h3 class="stats-card-title">RENDIMIENTO INDIVIDUAL (${selectedKey === 'all' ? 'ACUMULADO GENERAL' : 'PARTIDO SELECCIONADO'})</h3>
            <p style="font-size: 0.72rem; color: #9bb1d6; margin: 2px 0 0 0;">Goleadoras, jugadoras que provocaron córners cortos y sanciones</p>
          </div>
        </div>

        <div class="stats-players-grid">
          <!-- TOP GOLEADORAS -->
          <div class="stats-players-card">
            <div class="stats-players-card-title">
              <span>⚽ GOLEADORAS</span>
              <span style="font-size: 0.68rem; color: #34d399;">${seasonTrends.totalGF} Goles</span>
            </div>
            ${seasonTrends.scorersList.length > 0 ? `
              <table class="stats-players-mini-table">
                <thead>
                  <tr>
                    <th>Jugadora</th>
                    <th style="text-align: center;">Jugada</th>
                    <th style="text-align: center;">Corto</th>
                    <th style="text-align: center;">Penal</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${seasonTrends.scorersList.map(s => `
                    <tr>
                      <td><strong>${escapeHtml(s.name)}</strong></td>
                      <td style="text-align: center; color: #9bb1d6;">${s.field}</td>
                      <td style="text-align: center; color: #9bb1d6;">${s.corner}</td>
                      <td style="text-align: center; color: #9bb1d6;">${s.stroke}</td>
                      <td>${s.total} gol${s.total === 1 ? '' : 'es'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div class="stats-empty-hint">Sin goles asignados en esta muestra.</div>
            `}
          </div>

          <!-- TOP GENERADORAS DE CORTO -->
          <div class="stats-players-card" style="border-top: 3px solid #c084fc;">
            <div class="stats-players-card-title">
              <span style="color: #c084fc;">🏑 GENERADORAS DE CÓRNER CORTO</span>
              <span style="font-size: 0.68rem; color: #c084fc; font-weight: 800;">
                ${seasonTrends.cornersWonList && seasonTrends.cornersWonList.length > 0 
                  ? `${seasonTrends.cornersWonList.reduce((acc, c) => acc + c.total, 0)} Provocados` 
                  : 'Jugadas Fijas'}
              </span>
            </div>
            ${seasonTrends.cornersWonList && seasonTrends.cornersWonList.length > 0 ? `
              <table class="stats-players-mini-table">
                <thead>
                  <tr>
                    <th style="width: 22px;">#</th>
                    <th>Jugadora</th>
                    <th style="text-align: center;">Cortos</th>
                    <th style="text-align: center;">Con Gol</th>
                    <th>Efectividad</th>
                  </tr>
                </thead>
                <tbody>
                  ${seasonTrends.cornersWonList.map((c, idx) => {
                    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}.`));
                    const effPct = c.total > 0 ? Math.round((c.resultedInGoal / c.total) * 100) : 0;
                    return `
                      <tr>
                        <td style="color: var(--text-muted); font-size: 0.72rem; font-weight: 800;">${medal}</td>
                        <td><strong>${escapeHtml(c.name)}</strong></td>
                        <td style="text-align: center; color: #c084fc; font-weight: 900; font-size: 0.82rem;">${c.total}</td>
                        <td style="text-align: center; color: #34d399; font-weight: 700;">${c.resultedInGoal}</td>
                        <td style="color: #38bdf8; font-weight: 800;">${effPct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : `
              <div class="stats-empty-hint">
                <span style="font-size: 1.1rem; display: block; margin-bottom: 4px;">🏑</span>
                Sin jugadoras asignadas en cortos en esta muestra.<br>
                <span style="font-size: 0.68rem; color: #9bb1d6;">Al registrar un córner en la botonera DT podés elegir quién lo provocó.</span>
              </div>
            `}
          </div>

          <!-- TARJETAS Y DISCIPLINA -->
          <div class="stats-players-card">
            <div class="stats-players-card-title">
              <span>🟨 TARJETAS & DISCIPLINA</span>
              <span style="font-size: 0.68rem; color: #fbbf24;">Sanciones</span>
            </div>
            ${seasonTrends.cardsList.length > 0 ? `
              <table class="stats-players-mini-table">
                <thead>
                  <tr>
                    <th>Jugadora</th>
                    <th style="text-align: center;">🟩 2m</th>
                    <th style="text-align: center;">🟨 5m</th>
                    <th style="text-align: center;">🟥 Exp</th>
                    <th>Minutos Fuera</th>
                  </tr>
                </thead>
                <tbody>
                  ${seasonTrends.cardsList.map(c => `
                    <tr>
                      <td><strong>${escapeHtml(c.name)}</strong></td>
                      <td style="text-align: center; color: #34d399;">${c.green}</td>
                      <td style="text-align: center; color: #fbbf24;">${c.yellow}</td>
                      <td style="text-align: center; color: #f87171;">${c.red}</td>
                      <td style="color: #f87171;">${c.penaltyMinutes} min</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div class="stats-empty-hint" style="color: #34d399;">¡Plantel impecable! Sin tarjetas registradas.</div>
            `}
          </div>
        </div>
      </section>
    `;
  }

  // Sincronizar visibilidad de subpestaña activa
  switchStatsSubTab(statsActiveSubTab);
}

// Renderizado de la Vista de Tendencias de Temporada
function renderSeasonTrends(trends) {
  const container = document.getElementById('statsTabTrendsContent');
  if (!container) return;

  if (trends.playedCount === 0) {
    container.innerHTML = `
      <div class="stats-campaign-banner" style="text-align: center; padding: 32px 18px;">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">📈</div>
        <h3 style="color: #ffffff; font-size: 1.1rem; font-weight: 800; margin-bottom: 6px;">Sin Partidos Registrados Aún</h3>
        <p style="font-size: 0.8rem; color: #9bb1d6; max-width: 440px; margin: 0 auto 16px auto; line-height: 1.4;">
          Aún no se han guardado incidencias de partidos en la Botonera DT. Iniciá un partido en la botonera o sincronizá con Google Sheets para cargar las fechas del torneo.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button type="button" class="btn-primary" onclick="showView('dt')" style="max-width: 200px;">
            <span>⏱️</span> Ir a Botonera DT
          </button>
          <button type="button" class="btn-stats-sync-cloud" onclick="syncAllMatchesFromCloud()">
            <span>🔄</span> Sincronizar Google Sheets
          </button>
        </div>
      </div>
    `;
    return;
  }

  const h1 = trends.halves.first;
  const h2 = trends.halves.second;

  const totalGoals = trends.totalGF;
  const h1GoalsPct = totalGoals > 0 ? Math.round((h1.goalsHome / totalGoals) * 100) : 50;
  const h2GoalsPct = 100 - h1GoalsPct;

  const totalConceded = trends.totalGC;
  const h1ConcededPct = totalConceded > 0 ? Math.round((h1.goalsAway / totalConceded) * 100) : 50;
  const h2ConcededPct = 100 - h1ConcededPct;

  const totalEntries = trends.totalEntriesHome;
  const h1EntriesPct = totalEntries > 0 ? Math.round((h1.entriesHome / totalEntries) * 100) : 50;
  const h2EntriesPct = 100 - h1EntriesPct;

  const insights = generateSeasonTacticalDiagnosis(trends);

  const goalDiffSign = trends.goalDiff > 0 ? `+${trends.goalDiff}` : `${trends.goalDiff}`;
  const entryDiff = trends.totalEntriesHome - trends.totalEntriesAway;
  const entryDiffSign = entryDiff > 0 ? `+${entryDiff}` : `${entryDiff}`;

  let html = `
    <!-- BANNER DE CAMPAÑA & RÉCORD GLOBAL -->
    <section class="stats-campaign-banner">
      <div class="stats-campaign-header">
        <div>
          <span class="stats-filter-label" style="display:block; margin-bottom: 2px;">Campaña Acumulada</span>
          <h3 style="font-size: 1.15rem; font-weight: 900; color: #ffffff; margin: 0;">BALANCE GENERAL DE TEMPORADA</h3>
        </div>
        <div class="stats-campaign-record-badge">
          <span>🏆</span> ${trends.playedCount} PJ • ${trends.wins}V ${trends.draws}E ${trends.losses}D (${trends.points} PTS)
        </div>
      </div>

      <div class="stats-campaign-grid">
        <div class="stats-campaign-kpi">
          <span class="stats-campaign-kpi-label">Efectividad de Puntos</span>
          <span class="stats-campaign-kpi-val" style="color: #34d399;">${trends.pointsEff}%</span>
          <span class="stats-campaign-kpi-sub">${trends.points} de ${trends.playedCount * 3} pts posibles</span>
        </div>
        <div class="stats-campaign-kpi">
          <span class="stats-campaign-kpi-label">Goles F / C (Diferencial)</span>
          <span class="stats-campaign-kpi-val">${trends.totalGF} - ${trends.totalGC} <small style="font-size:0.75rem; color:${trends.goalDiff >= 0 ? '#34d399':'#f87171'};">(${goalDiffSign})</small></span>
          <span class="stats-campaign-kpi-sub">Promedio: ${trends.avgGF} a favor / ${trends.avgGC} contra</span>
        </div>
        <div class="stats-campaign-kpi">
          <span class="stats-campaign-kpi-label">Volumen Territorial</span>
          <span class="stats-campaign-kpi-val">${trends.totalEntriesHome} vs ${trends.totalEntriesAway}</span>
          <span class="stats-campaign-kpi-sub">Balance: ${entryDiffSign} ingresos a favor</span>
        </div>
        <div class="stats-campaign-kpi">
          <span class="stats-campaign-kpi-label">Tasa de Conversión</span>
          <span class="stats-campaign-kpi-val" style="color: #38bdf8;">${trends.conversionHome}%</span>
          <span class="stats-campaign-kpi-sub">Goles por cada 100 ingresos al área</span>
        </div>
      </div>
    </section>

    <!-- TERMÓMETRO TÁCTICO: 1ER TIEMPO vs 2DO TIEMPO -->
    <section class="stats-halves-card">
      <div class="stats-card-header">
        <span class="stats-card-icon">⚖️</span>
        <div>
          <h3 class="stats-card-title">TERMÓMETRO: 1° TIEMPO vs 2° TIEMPO</h3>
          <p style="font-size: 0.72rem; color: #9bb1d6; margin: 2px 0 0 0;">Comparativa de rendimiento entre la primera mitad (1°C + 2°C) y la segunda mitad (3°C + 4°C)</p>
        </div>
      </div>

      <!-- Barras comparativas 1T vs 2T -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div class="stats-quarter-bar-row">
          <div class="stats-quarter-bar-head">
            <span class="stats-quarter-name">⚽ Goles Marcados por Regatas</span>
            <span class="stats-quarter-badge stats-badge-win">1T: ${h1GoalsPct}% | 2T: ${h2GoalsPct}%</span>
          </div>
          <div class="stats-dual-bar-track">
            <div class="stats-bar-home" style="width: ${h1GoalsPct}%;" title="1T: ${h1.goalsHome} goles"></div>
            <div class="stats-bar-away" style="width: ${h2GoalsPct}%; background: linear-gradient(90deg, #38bdf8, #818cf8);" title="2T: ${h2.goalsHome} goles"></div>
          </div>
          <div class="stats-bar-legend">
            <span class="stats-legend-home">🔵 1° Tiempo (1°C y 2°C): ${h1.goalsHome} goles</span>
            <span class="stats-legend-away" style="color: #a5b4fc;">🟣 2° Tiempo (3°C y 4°C): ${h2.goalsHome} goles</span>
          </div>
        </div>

        <div class="stats-quarter-bar-row">
          <div class="stats-quarter-bar-head">
            <span class="stats-quarter-name">🛑 Goles Recibidos (Vulnerabilidad)</span>
            <span class="stats-quarter-badge stats-badge-loss">1T: ${h1ConcededPct}% | 2T: ${h2ConcededPct}%</span>
          </div>
          <div class="stats-dual-bar-track">
            <div class="stats-bar-home" style="width: ${h1ConcededPct}%; background: linear-gradient(90deg, #f59e0b, #fbbf24);" title="1T: ${h1.goalsAway} goles"></div>
            <div class="stats-bar-away" style="width: ${h2ConcededPct}%; background: linear-gradient(90deg, #ef4444, #f87171);" title="2T: ${h2.goalsAway} goles"></div>
          </div>
          <div class="stats-bar-legend">
            <span class="stats-legend-home" style="color: #fbbf24;">🟠 1° Tiempo: ${h1.goalsAway} goles recibidos</span>
            <span class="stats-legend-away">🔴 2° Tiempo: ${h2.goalsAway} goles recibidos</span>
          </div>
        </div>

        <div class="stats-quarter-bar-row">
          <div class="stats-quarter-bar-head">
            <span class="stats-quarter-name">📥 Ingresos al Área Rival (Volumen)</span>
            <span class="stats-quarter-badge stats-badge-draw">1T: ${h1EntriesPct}% | 2T: ${h2EntriesPct}%</span>
          </div>
          <div class="stats-dual-bar-track">
            <div class="stats-bar-home" style="width: ${h1EntriesPct}%;" title="1T: ${h1.entriesHome} ingresos"></div>
            <div class="stats-bar-away" style="width: ${h2EntriesPct}%; background: linear-gradient(90deg, #06b6d4, #22d3ee);" title="2T: ${h2.entriesHome} ingresos"></div>
          </div>
          <div class="stats-bar-legend">
            <span class="stats-legend-home">🔵 1° Tiempo: ${h1.entriesHome} ingresos</span>
            <span class="stats-legend-away" style="color: #67e8f9;">🔷 2° Tiempo: ${h2.entriesHome} ingresos</span>
          </div>
        </div>
      </div>

      <!-- Cuadros Comparativos Lado a Lado -->
      <div class="stats-halves-grid">
        <div class="stats-half-col">
          <div class="stats-half-col-title">
            <span>⏱️ 1° Tiempo (1°C + 2°C)</span>
          </div>
          <div class="stats-half-metric-row">
            <span>Goles a Favor:</span>
            <strong style="color: #34d399;">${h1.goalsHome}</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Goles en Contra:</span>
            <strong style="color: #f87171;">${h1.goalsAway}</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Ingresos Área (Reg / Riv):</span>
            <strong>${h1.entriesHome} / ${h1.entriesAway}</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Córners Cortos a Favor:</span>
            <strong>${h1.cornersHome} (${h1.cornerGoalsHome}g)</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Tarjetas (Verdes / Amarillas):</span>
            <strong>${h1.cardsHome.green}V / ${h1.cardsHome.yellow}A</strong>
          </div>
        </div>

        <div class="stats-half-col">
          <div class="stats-half-col-title">
            <span style="color: #818cf8;">⏱️ 2° Tiempo (3°C + 4°C)</span>
          </div>
          <div class="stats-half-metric-row">
            <span>Goles a Favor:</span>
            <strong style="color: #34d399;">${h2.goalsHome}</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Goles en Contra:</span>
            <strong style="color: #f87171;">${h2.goalsAway}</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Ingresos Área (Reg / Riv):</span>
            <strong>${h2.entriesHome} / ${h2.entriesAway}</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Córners Cortos a Favor:</span>
            <strong>${h2.cornersHome} (${h2.cornerGoalsHome}g)</strong>
          </div>
          <div class="stats-half-metric-row">
            <span>Tarjetas (Verdes / Amarillas):</span>
            <strong>${h2.cardsHome.green}V / ${h2.cardsHome.yellow}A</strong>
          </div>
        </div>
      </div>

      <!-- Diagnósticos Tácticos Automáticos del DT -->
      ${insights.length > 0 ? `
        <div style="margin-top: 4px;">
          <span class="stats-filter-label" style="display: block; margin-bottom: 6px;">💡 Conclusiones Tácticas del CT</span>
          <div class="stats-insights-list">
            ${insights.map(item => `
              <div class="stats-insight-item ${item.type}">
                <span class="stats-insight-icon">${item.icon}</span>
                <div class="stats-insight-text">
                  <strong>${item.title}</strong>
                  ${item.desc}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>

    <!-- EFICIENCIA DE CÓRNER CORTO (ATAQUE vs DEFENSA) -->
    <section class="stats-halves-card">
      <div class="stats-card-header">
        <span class="stats-card-icon">🏑</span>
        <div>
          <h3 class="stats-card-title">EFICIENCIA CRÍTICA EN CÓRNERS CORTOS</h3>
          <p style="font-size: 0.72rem; color: #9bb1d6; margin: 2px 0 0 0;">Conversión en jugadas preparadas de ataque y solidez en defensa fija</p>
        </div>
      </div>

      <div class="stats-corners-summary-grid">
        <div class="stats-corners-box">
          <div class="stats-corners-box-title" style="color: #38bdf8;">
            <span>🎯</span> ATAQUE (A FAVOR)
          </div>
          <div class="stats-corners-box-val" style="color: #38bdf8;">
            ${trends.cornerEffHome}%
          </div>
          <div class="stats-corners-box-sub">
            <strong>${trends.cornerGoalsHome} goles</strong> en ${trends.totalCornersHome} cortos obtenidos
          </div>
          <div class="stats-corners-box-sub" style="margin-top: 4px; color: #c8d8f0;">
            ${trends.cornerGoalsHome > 0 ? `Se anota 1 gol cada ${(trends.totalCornersHome / trends.cornerGoalsHome).toFixed(1)} cortos` : 'Sin goles de córner corto aún'}
          </div>
        </div>

        <div class="stats-corners-box">
          <div class="stats-corners-box-title" style="color: #34d399;">
            <span>🛡️</span> DEFENSA (EN CONTRA)
          </div>
          <div class="stats-corners-box-val" style="color: #34d399;">
            ${trends.cornerDefHome}%
          </div>
          <div class="stats-corners-box-sub">
            <strong>Efectividad defendiendo</strong> cortos rivales
          </div>
          <div class="stats-corners-box-sub" style="margin-top: 4px; color: #c8d8f0;">
            Solo ${trends.cornerGoalsAway} goles sufridos de ${trends.totalCornersAway} cortos concedidos
          </div>
        </div>

        <div class="stats-corners-box" style="border-left: 3px solid #c084fc;">
          <div class="stats-corners-box-title" style="color: #c084fc;">
            <span>⭐</span> MÁXIMA GENERADORA
          </div>
          <div class="stats-corners-box-val" style="color: #c084fc; font-size: 1.12rem;">
            ${trends.cornersWonList && trends.cornersWonList.length > 0 ? escapeHtml(trends.cornersWonList[0].name) : '-'}
          </div>
          <div class="stats-corners-box-sub">
            ${trends.cornersWonList && trends.cornersWonList.length > 0 
              ? `<strong>${trends.cornersWonList[0].total} cortos ganados</strong> (${trends.cornersWonList[0].resultedInGoal} con gol)`
              : 'Sin jugadoras registradas en cortos aún'}
          </div>
          <div class="stats-corners-box-sub" style="margin-top: 4px; color: #c8d8f0;">
            ${trends.cornersWonList && trends.cornersWonList.length > 0
              ? `${trends.cornersWonList.reduce((acc, c) => acc + c.total, 0)} jugadas fijas con jugadora asignada`
              : 'Se registran desde la botonera táctica DT'}
          </div>
        </div>
      </div>
    </section>

    <!-- EVOLUCIÓN PARTIDO A PARTIDO (TIMELINE DE FECHAS) -->
    <section class="stats-halves-card">
      <div class="stats-card-header">
        <span class="stats-card-icon">📅</span>
        <div>
          <h3 class="stats-card-title">EVOLUCIÓN PARTIDO A PARTIDO</h3>
          <p style="font-size: 0.72rem; color: #9bb1d6; margin: 2px 0 0 0;">Historial cronológico de fechas con diferencial territorial y efectividad</p>
        </div>
      </div>

      <div class="stats-match-timeline">
        ${trends.matchChronology.map(m => {
          const resClass = m.result === 'win' ? 'stats-res-win' : (m.result === 'draw' ? 'stats-res-draw' : 'stats-res-loss');
          const resLetter = m.result === 'win' ? 'V' : (m.result === 'draw' ? 'E' : 'D');
          const entryDiffVal = m.entriesHome - m.entriesAway;
          const entryDiffText = entryDiffVal > 0 ? `+${entryDiffVal}` : `${entryDiffVal}`;

          return `
            <div class="stats-timeline-row">
              <div class="stats-timeline-info">
                <span class="stats-res-pill ${resClass}">${resLetter}</span>
                <div class="stats-timeline-details">
                  <div class="stats-timeline-title">
                    ${escapeHtml(m.round)} vs ${escapeHtml(m.rival)}
                    <span style="color: #ffffff; font-weight: 900; margin-left: 6px;">${m.homeScore} - ${m.awayScore}</span>
                  </div>
                  <div class="stats-timeline-meta">
                    <span>📥 Ingresos: ${m.entriesHome} vs ${m.entriesAway} (${entryDiffText})</span>
                    <span>🏑 CC: ${m.cornersHome} (${m.cornerGoalsHome}g)</span>
                    ${m.date ? `<span>📅 ${escapeHtml(m.date)}</span>` : ''}
                  </div>
                </div>
              </div>
              <button type="button" class="btn-timeline-inspect" onclick="inspectMatchQuarters('${m.key}')" title="Ver análisis de cuartos de este partido">
                Ver Cuartos ➔
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- GOLEADORAS Y DISCIPLINA DEL PLANTEL -->
    <section class="stats-halves-card">
      <div class="stats-card-header">
        <span class="stats-card-icon">⭐</span>
        <div>
          <h3 class="stats-card-title">RENDIMIENTO INDIVIDUAL DEL PLANTEL</h3>
          <p style="font-size: 0.72rem; color: #9bb1d6; margin: 2px 0 0 0;">Tabla de goleadoras y registro disciplinario extraídos de las incidencias</p>
        </div>
      </div>

      <div class="stats-players-grid">
        <!-- TOP GOLEADORAS -->
        <div class="stats-players-card">
          <div class="stats-players-card-title">
            <span>⚽ TOP GOLEADORAS</span>
            <span style="font-size: 0.68rem; color: #34d399;">${trends.totalGF} Goles</span>
          </div>

          ${trends.scorersList.length > 0 ? `
            <table class="stats-players-mini-table">
              <thead>
                <tr>
                  <th>Jugadora</th>
                  <th style="text-align: center;">Jugada</th>
                  <th style="text-align: center;">Corto</th>
                  <th style="text-align: center;">Penal</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${trends.scorersList.map(s => `
                  <tr>
                    <td><strong>${escapeHtml(s.name)}</strong></td>
                    <td style="text-align: center; color: #9bb1d6;">${s.field}</td>
                    <td style="text-align: center; color: #9bb1d6;">${s.corner}</td>
                    <td style="text-align: center; color: #9bb1d6;">${s.stroke}</td>
                    <td>${s.total} gol${s.total === 1 ? '' : 'es'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="stats-empty-hint">No hay goles asignados a jugadoras todavía.</div>
          `}
        </div>

        <!-- TOP GENERADORAS DE CÓRNER CORTO -->
        <div class="stats-players-card" style="border-top: 3px solid #c084fc;">
          <div class="stats-players-card-title">
            <span style="color: #c084fc;">🏑 TOP GENERADORAS DE CORTO</span>
            <span style="font-size: 0.68rem; color: #c084fc; font-weight: 800;">
              ${trends.cornersWonList && trends.cornersWonList.length > 0 
                ? `${trends.cornersWonList.reduce((acc, c) => acc + c.total, 0)} Provocados` 
                : 'Jugadas Fijas'}
            </span>
          </div>

          ${trends.cornersWonList && trends.cornersWonList.length > 0 ? `
            <table class="stats-players-mini-table">
              <thead>
                <tr>
                  <th style="width: 22px;">#</th>
                  <th>Jugadora</th>
                  <th style="text-align: center;">Cortos</th>
                  <th style="text-align: center;">Con Gol</th>
                  <th>Efectividad</th>
                </tr>
              </thead>
              <tbody>
                ${trends.cornersWonList.map((c, idx) => {
                  const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}.`));
                  const effPct = c.total > 0 ? Math.round((c.resultedInGoal / c.total) * 100) : 0;
                  return `
                    <tr>
                      <td style="color: var(--text-muted); font-size: 0.72rem; font-weight: 800;">${medal}</td>
                      <td><strong>${escapeHtml(c.name)}</strong></td>
                      <td style="text-align: center; color: #c084fc; font-weight: 900; font-size: 0.82rem;">${c.total}</td>
                      <td style="text-align: center; color: #34d399; font-weight: 700;">${c.resultedInGoal}</td>
                      <td style="color: #38bdf8; font-weight: 800;">${effPct}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : `
            <div class="stats-empty-hint">
              <span style="font-size: 1.1rem; display: block; margin-bottom: 4px;">🏑</span>
              Aún no hay jugadoras asignadas en córners cortos.<br>
              <span style="font-size: 0.68rem; color: #9bb1d6;">Al registrar un córner en la botonera DT podés marcar quién lo provocó.</span>
            </div>
          `}
        </div>

        <!-- DISCIPLINA & TARJETAS -->
        <div class="stats-players-card">
          <div class="stats-players-card-title">
            <span>🟨 TARJETAS & DISCIPLINA</span>
            <span style="font-size: 0.68rem; color: #fbbf24;">Fair Play</span>
          </div>

          ${trends.cardsList.length > 0 ? `
            <table class="stats-players-mini-table">
              <thead>
                <tr>
                  <th>Jugadora</th>
                  <th style="text-align: center;">🟩 2m</th>
                  <th style="text-align: center;">🟨 5m</th>
                  <th style="text-align: center;">🟥 Exp</th>
                  <th>Minutos Fuera</th>
                </tr>
              </thead>
              <tbody>
                ${trends.cardsList.map(c => `
                  <tr>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td style="text-align: center; color: #34d399;">${c.green}</td>
                    <td style="text-align: center; color: #fbbf24;">${c.yellow}</td>
                    <td style="text-align: center; color: #f87171;">${c.red}</td>
                    <td style="color: #f87171;">${c.penaltyMinutes} min</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="stats-empty-hint" style="color: #34d399;">¡Plantel impecable! Sin tarjetas registradas aún.</div>
          `}
        </div>
      </div>
    </section>
  `;

  container.innerHTML = html;
}

// Sincronización de todos los partidos e incidencias desde Google Sheets
async function syncAllMatchesFromCloud(options = {}) {
  const isSilent = Boolean(options && options.silent === true);
  const webhookUrl = getDtWebhookUrl();
  if (!webhookUrl) {
    if (!isSilent) showToast('⚠️ No hay URL de Google Sheets configurada.');
    return;
  }

  const btnSync = document.getElementById('btnSyncAllMatchesCloud');
  const originalText = btnSync ? btnSync.innerHTML : '';
  if (btnSync && !isSilent) {
    btnSync.disabled = true;
    btnSync.innerHTML = '<span>⏳</span> Sincronizando partidos desde Google Sheets...';
  }

  if (!isSilent) {
    showToast('🔄 Descargando incidencias de todas las fechas...');
  }

  try {
    // 1. Consultar lista de hojas disponibles en el libro de Sheets
    const res = await fetch(webhookUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let sheetsToFetch = [];
    if (data && Array.isArray(data.sheets) && data.sheets.length > 0) {
      sheetsToFetch = data.sheets;
    } else {
      if (!tournamentData) loadTournamentData();
      const divMatches = (tournamentData && tournamentData.primera && tournamentData.primera.matches) || [];
      const divPending = (tournamentData && tournamentData.primera && tournamentData.primera.pendingMatches) || [];
      const allM = [...divMatches, ...divPending];
      sheetsToFetch = Array.from(new Set(allM.map(m => getDtMatchSheetName({ round: m.round, rivalName: m.rival })).filter(Boolean)));
    }

    let updatedCount = 0;
    for (const sheetName of sheetsToFetch) {
      try {
        const sheetUrl = `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}sheet=${encodeURIComponent(sheetName)}`;
        const sheetRes = await fetch(sheetUrl);
        if (sheetRes.ok) {
          const sheetData = await sheetRes.json();
          if (sheetData && sheetData.status === 'ok' && Array.isArray(sheetData.events)) {
            const parts = sheetName.split(' - ');
            const round = parts[0] ? parts[0].trim() : 'Fecha';
            const rival = parts[1] ? parts[1].trim() : 'Rival';
            const matchKey = getMatchKey('primera', round);

            const match = ensureMatchStateExists(matchKey, { round, rivalName: rival });
            const normalizedCloud = sheetData.events.map(normalizeCloudEvent).filter(Boolean);
            match.events = normalizedCloud;
            recalculateMatchStats(match);
            updatedCount++;
          }
        }
      } catch (err) {
        console.warn(`Error al consultar hoja ${sheetName}:`, err);
      }
    }

    if (dtMatchesStore[dtCurrentMatchKey]) {
      dtMatchState = dtMatchesStore[dtCurrentMatchKey];
    }

    saveDtMatchesStore();
    populateStatsMatchFilter();
    renderAnalyticsDashboard(statsCurrentSelectedFilter);
    updateStatsLastSyncBadge();
    if (!isSilent) {
      showToast(`✅ Sincronización exitosa: ${updatedCount} fecha(s) actualizada(s).`);
    }
  } catch (e) {
    console.error('Error general sincronizando partidos de Sheets:', e);
    if (!isSilent) {
      showToast('⚠️ Error al conectar con Google Sheets.');
    }
  } finally {
    if (btnSync && !isSilent) {
      btnSync.disabled = false;
      btnSync.innerHTML = originalText || '<span>🔄</span> Sincronizar Google Sheets';
    }
  }
}

// Compartir resumen táctico por WhatsApp
function shareStatsWhatsApp() {
  const filterSelect = document.getElementById('selectStatsMatchFilter');
  const selectedLabel = filterSelect && filterSelect.options[filterSelect.selectedIndex] 
    ? filterSelect.options[filterSelect.selectedIndex].text 
    : 'Todos los Partidos';

  if (statsActiveSubTab === 'trends') {
    const trends = getSeasonTrendsData(statsCurrentSelectedFilter);
    const h1 = trends.halves.first;
    const h2 = trends.halves.second;
    const topScorersStr = trends.scorersList.length > 0
      ? trends.scorersList.slice(0, 3).map((s, i) => `${i + 1}. ${s.name}: ${s.total} gol${s.total === 1 ? '' : 'es'}`).join('\n')
      : 'Sin goles individuales registrados';

    const goalDiffStr = trends.goalDiff > 0 ? `+${trends.goalDiff}` : `${trends.goalDiff}`;

    const lines = [
      `📈 *REGATAS ANDINO B - TENDENCIAS DE TEMPORADA*`,
      `📊 *Muestra:* ${selectedLabel}`,
      `🏆 *Campaña:* ${trends.playedCount} PJ • ${trends.wins}V ${trends.draws}E ${trends.losses}D (${trends.points} pts • ${trends.pointsEff}% efectividad)`,
      `⚽ *Goles:* ${trends.totalGF} a favor / ${trends.totalGC} en contra (Dif: ${goalDiffStr})`,
      `📥 *Ingresos al Área:* ${trends.avgEntriesHome} prom. a favor vs ${trends.avgEntriesAway} rivales`,
      ``,
      `⚖️ *DIAGNÓSTICO 1° TIEMPO vs 2° TIEMPO:*`,
      `*1° Tiempo (1°C + 2°C):* ${h1.goalsHome} goles a favor • ${h1.goalsAway} recibidos • ${h1.entriesHome} ingresos`,
      `*2° Tiempo (3°C + 4°C):* ${h2.goalsHome} goles a favor • ${h2.goalsAway} recibidos • ${h2.entriesHome} ingresos`,
      ``,
      `🎯 *CÓRNERS CORTOS:*`,
      `*Ataque:* ${trends.cornerGoalsHome} goles en ${trends.totalCornersHome} CC (${trends.cornerEffHome}% efectividad)`,
      `*Defensa:* ${trends.cornerDefHome}% defendidos con éxito (${trends.cornerGoalsAway} goles sufridos en ${trends.totalCornersAway} CC)`,
      ...(trends.cornersWonList && trends.cornersWonList.length > 0 ? [
        `*Provocados por:* ${trends.cornersWonList.slice(0, 3).map(c => `${c.name} (${c.total})`).join(', ')}`
      ] : []),
      ``,
      `⭐ *TOP GOLEADORAS:*`,
      topScorersStr,
      ``,
      `_Generado desde la App Oficial de Citaciones y Botonera DT de Regatas Andino B_`
    ];

    const fullText = lines.join('\n');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(waUrl, '_blank');
    return;
  }

  // Desglose por cuartos
  const stats = getAggregatedQuarterStats(statsCurrentSelectedFilter);
  const q = stats.quarters;
  const totH = q.total.home;
  const totA = q.total.away;

  const goalDiff = totH.goals - totA.goals;
  const goalDiffStr = goalDiff > 0 ? `+${goalDiff}` : `${goalDiff}`;

  const lines = [
    `🏑 *REGATAS ANDINO B - ANÁLISIS TÁCTICO POR CUARTOS*`,
    `📊 *Muestra:* ${selectedLabel}`,
    `📅 Partidos analizados: ${stats.matchesCount} (${stats.totalEventsCount} incidencias registradas)`,
    ``,
    `🏆 *TOTAL ACUMULADO:*`,
    `⚽ *Marcador:* Regatas ${totH.goals} - ${totA.goals} Rival (Diferencial: ${goalDiffStr})`,
    `📥 *Ingresos al Área:* ${totH.entries} Regatas vs ${totA.entries} Rivales`,
    `🏑 *Córners Cortos:* ${totH.corners} obtenidos (${totH.cornerGoals} goles • ${totH.cornerEff}% efectividad)`,
    `🎯 *Penales:* ${totH.strokes} (${totH.strokeGoals} goles)`,
    `📈 *Tasa Conversión:* ${totH.conversion}% de ingresos terminaron en gol`,
    `🟨 *Tarjetas Regatas:* 🟩 ${totH.green} • 🟨 ${totH.yellow} • 🟥 ${totH.red}`,
    ``,
    `📋 *DESGLOSE CUARTO POR CUARTO:*`,
    `*1°C:* Regatas ${q[1].home.goals}-${q[1].away.goals} | Ing: ${q[1].home.entries} vs ${q[1].away.entries} | CC: ${q[1].home.corners} (${q[1].home.cornerGoals}g)`,
    `*2°C:* Regatas ${q[2].home.goals}-${q[2].away.goals} | Ing: ${q[2].home.entries} vs ${q[2].away.entries} | CC: ${q[2].home.corners} (${q[2].home.cornerGoals}g)`,
    `*3°C:* Regatas ${q[3].home.goals}-${q[3].away.goals} | Ing: ${q[3].home.entries} vs ${q[3].away.entries} | CC: ${q[3].home.corners} (${q[3].home.cornerGoals}g)`,
    `*4°C:* Regatas ${q[4].home.goals}-${q[4].away.goals} | Ing: ${q[4].home.entries} vs ${q[4].away.entries} | CC: ${q[4].home.corners} (${q[4].home.cornerGoals}g)`,
    ``,
    `⚡ *Insight Clave:* Mejor cuarto ofensivo: ${stats.bestQByEntries.q}° Cuarto (${stats.bestQByEntries.val} ingresos y ${stats.bestQByGoals.val} goles)`,
    ``,
    `_Generado desde la App Oficial de Citaciones y Botonera DT de Regatas Andino B_`
  ];

  const fullText = lines.join('\n');
  const waUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
  window.open(waUrl, '_blank');
}

// ============================================================================


// ============================================================================
// GENERADOR DE IMAGEN TÁCTICA / ESTADÍSTICA (CANVAS HD)
// ============================================================================
async function exportStatsVisualCard() {
  const filterSelect = document.getElementById('selectStatsMatchFilter');
  const selectedLabel = filterSelect && filterSelect.options[filterSelect.selectedIndex] 
    ? filterSelect.options[filterSelect.selectedIndex].text 
    : 'Todos los Partidos';

  showToast('🎨 Generando reporte táctico visual...');

  const canvas = document.createElement('canvas');
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  function roundRect(x, y, w, h, r, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Fondo Degradado Deep Night Blue oficial
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#02081f');
  bgGrad.addColorStop(0.5, '#031238');
  bgGrad.addColorStop(1, '#051d54');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Acentos de luz sutil en esquinas
  const cyanRadial = ctx.createRadialGradient(W * 0.2, H * 0.15, 20, W * 0.2, H * 0.15, 500);
  cyanRadial.addColorStop(0, 'rgba(0, 162, 255, 0.14)');
  cyanRadial.addColorStop(1, 'rgba(0, 162, 255, 0)');
  ctx.fillStyle = cyanRadial;
  ctx.fillRect(0, 0, W, H);

  const magentaRadial = ctx.createRadialGradient(W * 0.85, H * 0.85, 20, W * 0.85, H * 0.85, 500);
  magentaRadial.addColorStop(0, 'rgba(37, 99, 235, 0.12)');
  magentaRadial.addColorStop(1, 'rgba(37, 99, 235, 0)');
  ctx.fillStyle = magentaRadial;
  ctx.fillRect(0, 0, W, H);

  // Marco exterior
  ctx.strokeStyle = 'rgba(0, 162, 255, 0.35)';
  ctx.lineWidth = 4;
  roundRect(24, 24, W - 48, H - 48, 28, false, true);

  // Cargar imagen de escudo
  await new Promise(resolve => {
    const crestImg = new Image();
    crestImg.crossOrigin = 'anonymous';
    crestImg.onload = () => {
      try {
        ctx.save();
        ctx.beginPath();
        ctx.arc(110, 105, 46, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#00a2ff';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(crestImg, 64, 59, 92, 92);
        ctx.restore();
      } catch (e) {}
      resolve();
    };
    crestImg.onerror = () => resolve();
    crestImg.src = 'escudo-regatas-andino.png';
  });

  // Textos Cabecera
  ctx.fillStyle = '#00a2ff';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CLUB REGATAS ANDINO', 180, 85);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px system-ui, -apple-system, sans-serif';
  ctx.fillText('PLANTEL SUPERIOR DAMAS B', 180, 126);

  // Badge Reporte Táctico
  const badgeText = statsActiveSubTab === 'trends' ? 'TENDENCIAS DE TEMPORADA' : 'DESGLOSE POR CUARTOS';
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 24;
  ctx.fillStyle = 'rgba(0, 162, 255, 0.2)';
  ctx.strokeStyle = '#00a2ff';
  ctx.lineWidth = 1.5;
  roundRect(W - 60 - badgeW, 68, badgeW, 30, 8, true, true);
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, W - 60 - (badgeW / 2), 88);

  // Muestra seleccionada
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  roundRect(60, 175, W - 120, 52, 12, true, true);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('📊 MUESTRA:', 85, 207);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 17px system-ui, -apple-system, sans-serif';
  ctx.fillText(selectedLabel.toUpperCase(), 200, 207);

  if (statsActiveSubTab === 'trends') {
    // -------------------------------------------------------------
    // CONTENIDO: TENDENCIAS DE TEMPORADA
    // -------------------------------------------------------------
    const trends = getSeasonTrendsData(statsCurrentSelectedFilter);
    const h1 = trends.halves.first;
    const h2 = trends.halves.second;
    const goalDiffStr = trends.goalDiff > 0 ? `+${trends.goalDiff}` : `${trends.goalDiff}`;

    // 4 KPI Cards Grid (2x2)
    const cardY = 250;
    const cardW = (W - 120 - 24) / 2;
    const cardH = 145;

    const kpis = [
      {
        title: '🏆 RÉCORD Y PUNTOS',
        val: `${trends.wins}V  ${trends.draws}E  ${trends.losses}D`,
        sub: `${trends.points} pts • ${trends.pointsEff}% efectividad (${trends.playedCount} PJ)`,
        accent: '#38bdf8'
      },
      {
        title: '⚽ GOLES (TOTAL TEMPORADA)',
        val: `${trends.totalGF} GF  vs  ${trends.totalGC} GC`,
        sub: `Diferencial de gol: ${goalDiffStr}`,
        accent: '#34d399'
      },
      {
        title: '🎯 INGRESOS AL ÁREA',
        val: `${trends.avgEntriesHome}  vs  ${trends.avgEntriesAway}`,
        sub: 'Promedio Regatas vs Rivales por partido',
        accent: '#fbbf24'
      },
      {
        title: '🏑 CÓRNERS CORTOS',
        val: `${trends.cornerEffHome}%  /  ${trends.cornerDefHome}%`,
        sub: `Ataque (${trends.cornerGoalsHome}/${trends.totalCornersHome} CC) • Defensa (${trends.cornerGoalsAway} recibidos)`,
        accent: '#a78bfa'
      }
    ];

    kpis.forEach((kpi, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const kx = 60 + col * (cardW + 24);
      const ky = cardY + row * (cardH + 20);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(kx, ky, cardW, cardH, 16, true, true);

      // Línea superior de acento
      ctx.fillStyle = kpi.accent;
      ctx.fillRect(kx + 20, ky + 4, cardW - 40, 3);

      ctx.textAlign = 'left';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillText(kpi.title, kx + 24, ky + 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillText(kpi.val, kx + 24, ky + 82);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(kpi.sub, kx + 24, ky + 118);
    });

    // Diagnóstico 1T vs 2T Box
    const halvesY = 585;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(60, halvesY, W - 120, 215, 18, true, true);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#00a2ff';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillText('⏱️ DIAGNÓSTICO COMPARATIVO: 1° TIEMPO vs 2° TIEMPO', 90, halvesY + 42);

    // Columna 1T
    const hBoxW = (W - 120 - 70) / 2;
    ctx.fillStyle = 'rgba(0, 162, 255, 0.08)';
    ctx.strokeStyle = 'rgba(0, 162, 255, 0.25)';
    roundRect(90, halvesY + 62, hBoxW, 125, 12, true, true);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('1° TIEMPO (1°C + 2°C)', 110, halvesY + 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`⚽ Goles: ${h1.goalsHome} a favor  /  ${h1.goalsAway} en contra`, 110, halvesY + 130);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`🎯 Ingresos al Área: ${h1.entriesHome} Regatas vs ${h1.entriesAway} rivales`, 110, halvesY + 160);

    // Columna 2T
    const h2X = 90 + hBoxW + 30;
    ctx.fillStyle = 'rgba(52, 211, 153, 0.08)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)';
    roundRect(h2X, halvesY + 62, hBoxW, 125, 12, true, true);

    ctx.fillStyle = '#34d399';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('2° TIEMPO (3°C + 4°C)', h2X + 20, halvesY + 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`⚽ Goles: ${h2.goalsHome} a favor  /  ${h2.goalsAway} en contra`, h2X + 20, halvesY + 130);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`🎯 Ingresos al Área: ${h2.entriesHome} Regatas vs ${h2.entriesAway} rivales`, h2X + 20, halvesY + 160);

    // Top Goleadoras Box
    const topY = 825;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(60, topY, W - 120, 160, 18, true, true);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillText('⭐ TOP GOLEADORAS DEL EQUIPO', 90, topY + 44);

    if (trends.scorersList && trends.scorersList.length > 0) {
      const topStr = trends.scorersList.slice(0, 4).map((s, i) => `${i + 1}. ${s.name} (${s.total} gol${s.total === 1 ? '' : 'es'})`).join('    •    ');
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText(topStr, 90, topY + 86);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText('No se registran goleadoras individuales en esta muestra', 90, topY + 86);
    }

    if (trends.cornersWonList && trends.cornersWonList.length > 0) {
      ctx.fillStyle = '#c084fc';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText('🏑 GENERADORAS DE CORTO:', 90, topY + 128);

      const topCStr = trends.cornersWonList.slice(0, 3).map((c, i) => `${i + 1}. ${c.name} (${c.total} CC)`).join('   •   ');
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText(topCStr, 345, topY + 128);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText('Datos sincronizados directamente desde la botonera táctica oficial.', 90, topY + 128);
    }

  } else {
    // -------------------------------------------------------------
    // CONTENIDO: DESGLOSE POR CUARTOS
    // -------------------------------------------------------------
    const stats = getAggregatedQuarterStats(statsCurrentSelectedFilter);
    const q = stats.quarters;
    const totH = q.total.home;
    const totA = q.total.away;

    // Resumen General Scorecard
    const scoreY = 250;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(60, scoreY, W - 120, 110, 18, true, true);

    const miniMetrics = [
      { l: 'MARCADOR', v: `${totH.goals} - ${totA.goals}`, c: '#ffffff' },
      { l: 'INGRESOS TOTALES', v: `${totH.entries} vs ${totA.entries}`, c: '#38bdf8' },
      { l: 'CÓRNERS CORTOS', v: `${totH.corners} (${totH.cornerGoals}g)`, c: '#34d399' },
      { l: 'CONVERSIÓN ÁREA', v: `${totH.conversion}%`, c: '#fbbf24' }
    ];

    const colW = (W - 120) / 4;
    miniMetrics.forEach((m, i) => {
      const mx = 60 + i * colW + (colW / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillText(m.l, mx, scoreY + 40);

      ctx.fillStyle = m.c;
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.fillText(m.v, mx, scoreY + 82);
    });

    // Tabla Cuarto por Cuarto
    const tableY = 385;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(60, tableY, W - 120, 395, 18, true, true);

    // Cabecera de la tabla
    ctx.fillStyle = 'rgba(0, 162, 255, 0.12)';
    roundRect(60, tableY, W - 120, 52, 18, true, false);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText('MÉTRICA / INCIDENCIA', 90, tableY + 33);

    const cols = [570, 680, 790, 900, 990];
    const colLabels = ['1°C', '2°C', '3°C', '4°C', 'TOTAL'];
    ctx.textAlign = 'center';
    cols.forEach((cx, cIdx) => {
      ctx.fillStyle = cIdx === 4 ? '#34d399' : '#ffffff';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText(colLabels[cIdx], cx, tableY + 33);
    });

    // Filas de la tabla
    const rows = [
      {
        label: '⚽ Goles (Regatas vs Rival)',
        qVals: [1, 2, 3, 4].map(idx => `${q[idx].home.goals} - ${q[idx].away.goals}`),
        totVal: `${totH.goals} - ${totA.goals}`,
        highlight: true
      },
      {
        label: '🎯 Ingresos al Área (Reg vs Riv)',
        qVals: [1, 2, 3, 4].map(idx => `${q[idx].home.entries} vs ${q[idx].away.entries}`),
        totVal: `${totH.entries} vs ${totA.entries}`
      },
      {
        label: '🏑 Córners Cortos (Reg vs Riv)',
        qVals: [1, 2, 3, 4].map(idx => `${q[idx].home.corners} vs ${q[idx].away.corners}`),
        totVal: `${totH.corners} vs ${totA.corners}`
      },
      {
        label: '🥅 Goles de Córner Corto',
        qVals: [1, 2, 3, 4].map(idx => `${q[idx].home.cornerGoals}`),
        totVal: `${totH.cornerGoals}`
      },
      {
        label: '🏑 Penales / Strokes Registrados',
        qVals: [1, 2, 3, 4].map(idx => `${q[idx].home.strokes}`),
        totVal: `${totH.strokes}`
      },
      {
        label: '🟨 Tarjetas Regatas (V-A-R)',
        qVals: [1, 2, 3, 4].map(idx => `${q[idx].home.green}-${q[idx].home.yellow}-${q[idx].home.red}`),
        totVal: `${totH.green}-${totH.yellow}-${totH.red}`
      }
    ];

    rows.forEach((row, rIdx) => {
      const ry = tableY + 52 + (rIdx * 56);
      if (rIdx % 2 === 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.fillRect(60, ry, W - 120, 56);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = row.highlight ? '#38bdf8' : '#ffffff';
      ctx.font = row.highlight ? '900 16px system-ui, sans-serif' : '600 15px system-ui, sans-serif';
      ctx.fillText(row.label, 90, ry + 35);

      ctx.textAlign = 'center';
      cols.forEach((cx, cIdx) => {
        const val = cIdx === 4 ? row.totVal : row.qVals[cIdx];
        ctx.fillStyle = cIdx === 4 ? '#34d399' : (row.highlight ? '#ffffff' : '#94a3b8');
        ctx.font = cIdx === 4 ? '900 16px system-ui, sans-serif' : '600 15px system-ui, sans-serif';
        ctx.fillText(val, cx, ry + 35);
      });
    });

    // Insight Clave Box
    const insightY = 810;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(60, insightY, W - 120, 175, 18, true, true);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#34d399';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillText('💡 INSIGHT TÁCTICO DESTACADO', 90, insightY + 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(`Mejor cuarto ofensivo: ${stats.bestQByEntries.q}° Cuarto con ${stats.bestQByEntries.val} ingresos y ${stats.bestQByGoals.val} goles.`, 90, insightY + 88);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`Muestra analizada: ${stats.matchesCount} partido(s) • ${stats.totalEventsCount} incidencias oficiales cargadas.`, 90, insightY + 128);
  }

  // 6. Pie de Página Institucional
  const footerY = 1010;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(60, footerY);
  ctx.lineTo(W - 60, footerY);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Club Regatas Andino • Hockey Damas B', 60, footerY + 38);

  ctx.fillStyle = '#00a2ff';
  ctx.font = 'italic 700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('« Juntas somos más »', W / 2, footerY + 38);

  const nowStr = new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(nowStr, W - 60, footerY + 38);

  // 7. Descargar o Compartir imagen
  canvas.toBlob(async (blob) => {
    if (!blob) {
      showToast('⚠️ Error al generar la imagen estadística.');
      return;
    }
    const cleanSub = statsActiveSubTab === 'trends' ? 'tendencias' : 'cuartos';
    const cleanFilter = selectedLabel.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const fileName = `regatas-${cleanSub}-${cleanFilter}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Reporte Estadístico - Regatas Andino B`,
          text: `Reporte oficial de estadísticas tácticas: Regatas Andino B (${selectedLabel})`
        });
        showToast('📲 ¡Reporte compartido con éxito!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📸 ¡Reporte táctico descargado!');
  }, 'image/png');
}

window.exportStatsVisualCard = exportStatsVisualCard;

// ============================================================================
// MÓDULO: 12_pwa.js
// ============================================================================

// PWA: SERVICE WORKER & INSTALACIÓN EN PANTALLA DE INICIO
// ============================================================================

let deferredInstallPrompt = null;

function setupPwa() {
  // 1. Registro del Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado exitosamente:', reg.scope);
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('[PWA] Error registrando Service Worker:', err);
        });
    });

    // Al desbloquear el celular o volver a la app desde otra pantalla
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) reg.update().catch(() => {});
        }).catch(() => {});
      }
    });
  }

  // 2. Captura del evento beforeinstallprompt (Android / Chrome / Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Evento beforeinstallprompt capturado');

    const badge = document.getElementById('drawerBadgePwa');
    if (badge) badge.textContent = 'Instalar';
  });

  // 3. Detección de instalación completada
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('🏆 ¡App de Regatas instalada en tu pantalla de inicio!');
    const badge = document.getElementById('drawerBadgePwa');
    if (badge) badge.textContent = 'Instalada';
  });

  // 4. Modal de instrucciones iOS
  const btnCloseIos = document.getElementById('btnCloseIosInstall');
  if (btnCloseIos) {
    btnCloseIos.addEventListener('click', closeIosInstallModal);
  }
  const modalIos = document.getElementById('modalIosInstall');
  if (modalIos) {
    modalIos.addEventListener('click', (e) => {
      if (e.target === modalIos) closeIosInstallModal();
    });
  }
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function isAppStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function triggerPwaInstall() {
  if (isAppStandalone()) {
    showToast('✅ Ya estás usando la App instalada de Regatas Andino');
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('📲 Instalando App de Regatas...');
      }
      deferredInstallPrompt = null;
    });
    return;
  }

  if (isIosDevice()) {
    openIosInstallModal();
    return;
  }

  showToast('ℹ️ Para instalar: tocá los 3 puntos ⋮ en tu navegador y seleccioná "Instalar aplicación"');
}

function openIosInstallModal() {
  const modal = document.getElementById('modalIosInstall');
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    const bottomNavDock = document.getElementById('bottomNavDock');
    if (bottomNavDock) bottomNavDock.style.display = 'none';
  }
}

function closeIosInstallModal() {
  const modal = document.getElementById('modalIosInstall');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    const bottomNavDock = document.getElementById('bottomNavDock');
    if (bottomNavDock) {
      const isSpecialView = typeof currentActiveView !== 'undefined' && (currentActiveView === 'dt' || currentActiveView === 'estadisticas');
      bottomNavDock.style.display = isSpecialView ? 'none' : 'flex';
    }
  }
}

window.triggerPwaInstall = triggerPwaInstall;
window.openIosInstallModal = openIosInstallModal;
window.closeIosInstallModal = closeIosInstallModal;

// ============================================================================
// MÓDULO: 13_init.js
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const tenantReady = await window.__tenantReady;
  if (!tenantReady) return;
  const config = getTenantConfig();
  PHYSICAL_SPREADSHEET_ID = config.physicalSpreadsheetId || PHYSICAL_SPREADSHEET_ID;
  DT_SPREADSHEET_ID = config.dtSpreadsheetId || DT_SPREADSHEET_ID;
  DT_SPREADSHEET_URL = config.dtSpreadsheetUrl || DT_SPREADSHEET_URL;
  STORAGE_KEY = tenantStorageKey('citaciones_v6');
  TOURNAMENT_STORAGE_KEY = tenantStorageKey('torneo_v4');
  PHYSICAL_STORAGE_KEY = tenantStorageKey('fisico_v1');
  CT_AUTH_STORAGE_KEY = tenantStorageKey('ct_session_v4');
  CITACION_LAST_SYNC_KEY = tenantStorageKey('citacion_last_sync_ts');
  if (config.spreadsheetId) DEFAULT_MATCH_DATA.spreadsheetId = config.spreadsheetId;
  DEFAULT_MATCH_DATA.clubName = config.name;
  DEFAULT_MATCH_DATA.teamName = config.teamName;
  DEFAULT_MATCH_DATA.logoUrl = config.logoUrl;

  loadData();
  loadTournamentData();
  render();
  renderTournamentView();
  setupCategorySwitch();
  setupTournamentCategorySwitch();
  setupViewSwitching();
  setupEvents();
  setupCitacionSyncUI();
  setupPhysicalSection();
  initDtModule();
  initSunMode();
  updateCtUiState();
  setupPwa();

  // Sincronizaciones iniciales
  syncWithGoogleSheets(); // Citaciones
  loadPhysicalEvaluations(); // Físico
  syncTournamentData(); // Torneo AMH

  // Polling inteligente respetando visibilidad de pantalla (ahorro de batería en celulares)
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      updateCtUiState();
      syncWithGoogleSheets();
      if (typeof currentActiveView !== 'undefined') {
        if (currentActiveView === 'fisico') loadPhysicalEvaluations();
        if (currentActiveView === 'torneo') syncTournamentData();
      }
    }
  }, 25000);

  // Al volver a la app o desbloquear el celular
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateCtUiState();
      syncWithGoogleSheets();
      if (typeof currentActiveView !== 'undefined') {
        if (currentActiveView === 'fisico') loadPhysicalEvaluations();
        if (currentActiveView === 'torneo') syncTournamentData();
      }
    }
  });

  window.addEventListener('focus', () => {
    updateCtUiState();
    syncWithGoogleSheets();
    if (typeof currentActiveView !== 'undefined') {
      if (currentActiveView === 'fisico') loadPhysicalEvaluations();
      if (currentActiveView === 'torneo') syncTournamentData();
    }
  });
});

// ============================================================================
// MÓDULO: 14_amh_precarga.js
// ============================================================================

// ============================================================================
// MÓDULO 14: PRECARGA OFICIAL DE EQUIPOS EN SISTEMA AMH (ORACLE APEX)
// Exclusivo para Cuerpo Técnico - Seguro: Solo inscribe tildados, nunca cierra.
// ============================================================================

let currentAmhCategory = 'primera'; // 'primera' | 'intermedia'
let cachedAmhMatches = { primera: [], intermedia: [] };
let isAmhPrecargaInProgress = false;

function setupAmhPrecargaEvents() {
  const drawerBtn = document.getElementById('drawerBtnPrecargaAmh');
  const modal = document.getElementById('modalAmhPrecarga');
  const btnClose = document.getElementById('btnCloseAmhPrecarga');
  const btnCloseBottom = document.getElementById('btnCloseAmhPrecargaBottom');
  const btnRefreshMatches = document.getElementById('btnRefreshAmhMatches');
  const btnExecute = document.getElementById('btnExecuteAmhPrecarga');
  const tabPrimera = document.getElementById('tabAmhPrimera');
  const tabInter = document.getElementById('tabAmhIntermedia');
  const btnSelectAll = document.getElementById('btnAmhSelectAll');
  const btnDeselectAll = document.getElementById('btnAmhDeselectAll');
  const btnFromSheets = document.getElementById('btnOpenPrecargaFromSheets');

  if (btnFromSheets) {
    btnFromSheets.addEventListener('click', () => {
      closeSheetsAuthModal();
      openAmhPrecargaModal();
    });
  }

  if (drawerBtn) {
    drawerBtn.addEventListener('click', () => {
      closeNavDrawer();
      if (!isCtAuthenticated()) {
        openSheetsAuthModal();
      } else {
        openAmhPrecargaModal();
      }
    });
  }

  if (btnClose) btnClose.addEventListener('click', closeAmhPrecargaModal);
  if (btnCloseBottom) btnCloseBottom.addEventListener('click', closeAmhPrecargaModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal && !isAmhPrecargaInProgress) {
        closeAmhPrecargaModal();
      }
    });
  }

  if (tabPrimera) {
    tabPrimera.addEventListener('click', () => switchAmhPrecargaCategory('primera'));
  }
  if (tabInter) {
    tabInter.addEventListener('click', () => switchAmhPrecargaCategory('intermedia'));
  }

  if (btnRefreshMatches) {
    btnRefreshMatches.addEventListener('click', () => loadAmhMatchesForCategory(currentAmhCategory, true));
  }

  if (btnExecute) {
    btnExecute.addEventListener('click', handleExecuteAmhPrecarga);
  }

  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => setAllAmhPlayerCheckboxes(true));
  }
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => setAllAmhPlayerCheckboxes(false));
  }
}

function openAmhPrecargaModal() {
  const modal = document.getElementById('modalAmhPrecarga');
  if (!modal) return;

  // Intentar sincronizar citadas en vivo con Google Sheets antes de abrir
  if (typeof syncWithGoogleSheets === 'function') {
    syncWithGoogleSheets(false).catch(() => {});
  }

  // Sincronizar con la categoría activa en la web si es posible
  const currentCat = (typeof currentCategory !== 'undefined' && currentCategory === 'intermedia') 
    ? 'intermedia' 
    : 'primera';
  
  switchAmhPrecargaCategory(currentCat);
  modal.classList.add('active');
  document.body.classList.add('amh-modal-open');
  document.body.style.overflow = 'hidden';
  const bottomNavDock = document.getElementById('bottomNavDock');
  if (bottomNavDock) bottomNavDock.style.display = 'none';
}

function closeAmhPrecargaModal() {
  if (isAmhPrecargaInProgress) {
    if (!confirm('La precarga en la AMH se está ejecutando. ¿Deseás cerrar la ventana? El proceso continuará en segundo plano.')) {
      return;
    }
  }
  const modal = document.getElementById('modalAmhPrecarga');
  if (modal) modal.classList.remove('active');
  document.body.classList.remove('amh-modal-open');
  document.body.style.overflow = '';
  const bottomNavDock = document.getElementById('bottomNavDock');
  if (bottomNavDock) {
    const isSpecialView = typeof currentActiveView !== 'undefined' && (currentActiveView === 'dt' || currentActiveView === 'estadisticas');
    bottomNavDock.style.display = isSpecialView ? 'none' : 'flex';
  }
}

function switchAmhPrecargaCategory(cat) {
  currentAmhCategory = cat;
  const tabPrimera = document.getElementById('tabAmhPrimera');
  const tabInter = document.getElementById('tabAmhIntermedia');

  if (tabPrimera) tabPrimera.classList.toggle('active', cat === 'primera');
  if (tabInter) tabInter.classList.toggle('active', cat === 'intermedia');

  // Actualizar lista de jugadoras citadas
  renderAmhCitedPlayers(cat);

  // Cargar partidos disponibles en la AMH
  loadAmhMatchesForCategory(cat);

  // Resetear estados de resultado
  resetAmhPrecargaStatus();
}

/**
 * Obtiene las jugadoras citadas priorizando los datos en vivo sincronizados con Google Sheets
 */
function getCitedPlayersForCategory(cat) {
  try {
    // 1. Prioridad: matchData en memoria (actualizado por sincronización con Google Sheets)
    if (typeof matchData !== 'undefined' && matchData && matchData[cat] && Array.isArray(matchData[cat].players) && matchData[cat].players.length > 0) {
      return matchData[cat].players;
    }
    // 2. Segunda opción: localStorage persistente
    const storageKey = typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'regatas_match_data';
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed[cat] && Array.isArray(parsed[cat].players) && parsed[cat].players.length > 0) {
        return parsed[cat].players;
      }
    }
    // 3. Fallback: DEFAULT_MATCH_DATA
    if (typeof DEFAULT_MATCH_DATA !== 'undefined' && DEFAULT_MATCH_DATA[cat] && DEFAULT_MATCH_DATA[cat].players) {
      return DEFAULT_MATCH_DATA[cat].players;
    }
  } catch (e) {
    console.warn('[AMH] Error al leer jugadoras citadas:', e);
  }
  return [];
}

function getRivalNameForCategory(cat) {
  try {
    if (typeof matchData !== 'undefined' && matchData && matchData.rival) {
      return matchData.rival;
    }
    const storageKey = typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'regatas_match_data';
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.rival) return parsed.rival;
    }
    if (typeof DEFAULT_MATCH_DATA !== 'undefined' && DEFAULT_MATCH_DATA.rival) {
      return DEFAULT_MATCH_DATA.rival;
    }
  } catch (e) {}
  return '';
}

function updateAmhSelectionCount() {
  const container = document.getElementById('amhCitedList');
  const countEl = document.getElementById('amhCitedCount');
  if (!container || !countEl) return;

  const total = container.querySelectorAll('.amh-player-cb').length;
  const checked = container.querySelectorAll('.amh-player-cb:checked').length;
  countEl.textContent = `${checked} de ${total} seleccionadas`;
}

function setAllAmhPlayerCheckboxes(checked) {
  const cbs = document.querySelectorAll('.amh-player-cb');
  cbs.forEach(cb => { cb.checked = checked; });
  updateAmhSelectionCount();
}

function renderAmhCitedPlayers(cat) {
  const container = document.getElementById('amhCitedList');
  const countEl = document.getElementById('amhCitedCount');
  const rivalEl = document.getElementById('amhRivalBadge');
  const players = getCitedPlayersForCategory(cat);
  const rival = getRivalNameForCategory(cat);

  if (rivalEl) rivalEl.textContent = rival ? `Rival: ${rival}` : 'Rival próximo';

  if (!container) return;

  if (players.length === 0) {
    if (countEl) countEl.textContent = '0 citadas';
    container.innerHTML = '<span class="amh-no-players">No hay jugadoras citadas cargadas para esta categoría.</span>';
    return;
  }

  container.innerHTML = players.map((p, idx) => `
    <label class="amh-player-cb-label">
      <input type="checkbox" class="amh-player-cb" value="${p}" checked>
      <span class="amh-tag-num">${idx + 1}</span>
      <span class="amh-tag-name">${p}</span>
    </label>
  `).join('');

  // Event listener para actualizar conteo ante cada cambio
  container.querySelectorAll('.amh-player-cb').forEach(cb => {
    cb.addEventListener('change', updateAmhSelectionCount);
  });

  updateAmhSelectionCount();
}

async function loadAmhMatchesForCategory(cat, forceRefresh = false) {
  const select = document.getElementById('selectAmhPartido');
  const refreshBtn = document.getElementById('btnRefreshAmhMatches');
  if (!select) return;

  const divId = cat === 'intermedia' ? '2' : '1';

  if (!forceRefresh && cachedAmhMatches[cat] && cachedAmhMatches[cat].length > 0) {
    populateAmhMatchesSelect(cachedAmhMatches[cat]);
    return;
  }

  select.innerHTML = '<option value="">Cargando partidos desde AMH...</option>';
  select.disabled = true;
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const res = await fetch(`/api/torneo/precarga?matches=1&division=${divId}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.matches) && data.matches.length > 0) {
      cachedAmhMatches[cat] = data.matches;
      populateAmhMatchesSelect(data.matches);
    } else {
      select.innerHTML = '<option value="">No se encontraron partidos en AMH</option>';
    }
  } catch (err) {
    console.warn('[AMH] Error al cargar partidos:', err);
    select.innerHTML = '<option value="">Error al conectar con servidor AMH (usar detección automática)</option>';
  } finally {
    select.disabled = false;
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

function populateAmhMatchesSelect(matches) {
  const select = document.getElementById('selectAmhPartido');
  if (!select) return;

  const rival = getRivalNameForCategory(currentAmhCategory).toUpperCase();

  select.innerHTML = '<option value="">-- Autodetectar por rival del próximo partido --</option>';

  let autoSelected = false;

  matches.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.text;

    // Si coincide con el rival, preseleccionarlo
    const cleanText = (m.text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanRival = (rival || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!autoSelected && cleanRival && cleanText.includes(cleanRival)) {
      opt.selected = true;
      autoSelected = true;
    }

    select.appendChild(opt);
  });
}

function resetAmhPrecargaStatus() {
  const statusBox = document.getElementById('amhStatusBox');
  const resultBox = document.getElementById('amhResultBox');
  const errorBox = document.getElementById('amhErrorBox');
  const btnExecute = document.getElementById('btnExecuteAmhPrecarga');

  if (statusBox) statusBox.style.display = 'none';
  if (resultBox) resultBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (btnExecute) {
    btnExecute.disabled = false;
    btnExecute.innerHTML = '<span>🚀</span> Hacer Precarga en AMH (Inscribir tildadas)';
  }
  isAmhPrecargaInProgress = false;
}

async function handleExecuteAmhPrecarga() {
  if (isAmhPrecargaInProgress) return;

  const cat = currentAmhCategory;
  const select = document.getElementById('selectAmhPartido');
  const partidoId = select ? select.value : '';
  const rival = getRivalNameForCategory(cat);

  // Obtener exclusivamente las jugadoras tildadas en el modal
  const checkedBoxes = Array.from(document.querySelectorAll('.amh-player-cb:checked'));
  const selectedPlayers = checkedBoxes.map(cb => cb.value.trim()).filter(Boolean);

  if (selectedPlayers.length === 0) {
    alert('Por favor, seleccioná al menos una jugadora para precargar.');
    return;
  }

  const catName = cat === 'intermedia' ? 'Intermedia' : '1ra División';
  const confirmMsg = `¿Confirmás ejecutar la precarga en AMH para ${catName}?\n\n` +
    `• Jugadoras a inscribir: ${selectedPlayers.length}\n` +
    `• Torneo: Clausura Damas B\n` +
    `• Bloque: B\n\n` +
    `⚠️ MODO SEGURO: El sistema SOLO inscribirá a las jugadoras tildadas. NUNCA cerrará la precarga. Podrás entrar a la AMH luego para cerrarla manualmente.`;

  if (!confirm(confirmMsg)) return;

  // Activar estado de progreso
  isAmhPrecargaInProgress = true;
  const btnExecute = document.getElementById('btnExecuteAmhPrecarga');
  const statusBox = document.getElementById('amhStatusBox');
  const statusText = document.getElementById('amhStatusText');
  const resultBox = document.getElementById('amhResultBox');
  const errorBox = document.getElementById('amhErrorBox');

  if (btnExecute) {
    btnExecute.disabled = true;
    btnExecute.innerHTML = '<span class="amh-spinner"></span> Ejecutando precarga en AMH...';
  }
  if (resultBox) resultBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (statusBox) {
    statusBox.style.display = 'flex';
    if (statusText) {
      statusText.textContent = `Inscribiendo ${selectedPlayers.length} jugadoras en AMH... Esperá unos segundos.`;
    }
  }

  try {
    const response = await fetch('/api/torneo/precarga', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        division: cat === 'intermedia' ? '2' : '1',
        partidoId: partidoId || null,
        rival: rival || null,
        players: selectedPlayers
      })
    });

    const data = await response.json();

    if (data.success && data.result) {
      showAmhSuccessResult(data.result);
      if (typeof showToast === 'function') {
        showToast(`✅ Precarga AMH: ${data.result.inscribedCount} jugadoras inscriptas`);
      }
    } else {
      throw new Error(data.error || 'Error desconocido durante la precarga.');
    }
  } catch (err) {
    console.error('[AMH Precarga Error]:', err);
    showAmhErrorResult(err.message);
  } finally {
    isAmhPrecargaInProgress = false;
    if (statusBox) statusBox.style.display = 'none';
    if (btnExecute) {
      btnExecute.disabled = false;
      btnExecute.innerHTML = '<span>🚀</span> Hacer Precarga en AMH (Inscribir tildadas)';
    }
  }
}

function showAmhSuccessResult(result) {
  const resultBox = document.getElementById('amhResultBox');
  if (!resultBox) return;

  const matchesHtml = (result.matches || []).map(m => `
    <li class="amh-match-item">
      <span class="amh-check-icon">✓</span>
      <div class="amh-match-names">
        <strong>${m.cited}</strong>
        <span class="amh-sub-official">${m.amhName} (DNI ${m.dni})</span>
      </div>
      <span class="amh-match-score">${m.score}%</span>
    </li>
  `).join('');

  let unmatchedHtml = '';
  if (result.unmatched && result.unmatched.length > 0) {
    unmatchedHtml = `
      <div class="amh-unmatched-card">
        <span class="amh-warn-title">⚠️ Jugadoras seleccionadas no encontradas en el padrón AMH (${result.unmatched.length}):</span>
        <div class="amh-unmatched-tags">
          ${result.unmatched.map(u => `<span class="amh-unmatched-tag">${u}</span>`).join('')}
        </div>
        <small>Verificá si están inscriptas bajo otro nombre o en otra categoría en el sistema AMH.</small>
      </div>
    `;
  }

  resultBox.innerHTML = `
    <div class="amh-success-card">
      <div class="amh-success-header">
        <span class="amh-success-icon">🎉</span>
        <div>
          <h3 class="amh-success-title">¡Precarga realizada con éxito!</h3>
          <p class="amh-success-sub">Se inscribieron <strong>${result.inscribedCount} de ${result.totalCited} jugadoras</strong> para <strong>${result.division}</strong>.</p>
        </div>
      </div>

      <div class="amh-match-info-pill">
        <span>🏟️ Partido:</span> <strong>${result.partido || 'Programado'}</strong>
      </div>

      <div class="amh-security-notice">
        <span>🛡️</span>
        <p><strong>Recordatorio:</strong> La precarga <strong>NO ha sido cerrada</strong>. Podés ingresar al sistema de la AMH para revisar la planilla y cerrar la precarga cuando vos lo decidas.</p>
      </div>

      <details class="amh-details-toggle">
        <summary>Ver detalle de ${result.inscribedCount} jugadoras inscriptas</summary>
        <ul class="amh-matches-list">
          ${matchesHtml}
        </ul>
      </details>

      ${unmatchedHtml}

      <div class="amh-direct-link-box">
        <a href="http://15.235.75.172:8080/ords/r/amh/clubes/login_desktop" target="_blank" rel="noopener noreferrer" class="amh-btn-external">
          Abrir Sistema AMH para Revisar y Cerrar ↗
        </a>
      </div>
    </div>
  `;

  resultBox.style.display = 'block';
}

function showAmhErrorResult(errorMsg) {
  const errorBox = document.getElementById('amhErrorBox');
  if (!errorBox) return;

  errorBox.innerHTML = `
    <div class="amh-error-card">
      <div class="amh-error-header">
        <span class="amh-error-icon">❌</span>
        <div>
          <h4 class="amh-error-title">No se pudo completar la precarga</h4>
          <p class="amh-error-sub">${errorMsg}</p>
        </div>
      </div>
      <div class="amh-error-tips">
        <strong>Recomendaciones:</strong>
        <ul>
          <li>Asegurate de que el servidor local esté activo (ejecutando <code>abrir_web.bat</code>).</li>
          <li>Verificá que el archivo <code>.env</code> tenga las credenciales correctas de la AMH.</li>
          <li>Comprobá que el servidor de la AMH esté online y accesible.</li>
        </ul>
      </div>
      <div class="amh-error-actions">
        <a href="http://15.235.75.172:8080/ords/r/amh/clubes/login_desktop" target="_blank" rel="noopener noreferrer" class="amh-btn-external-small">
          Ir manualmente a la AMH ↗
        </a>
      </div>
    </div>
  `;

  errorBox.style.display = 'block';
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  setupAmhPrecargaEvents();
});

// ============================================================================
// MÓDULO: 15_pull_refresh.js
// ============================================================================

/**
 * Gesto Pull to Refresh Nativo para Móviles y PWA
 * Club Regatas Andino - Web Citaciones
 */

(function initPullToRefresh() {
  const PTR_THRESHOLD = 64; // Distancia en px para activar la recarga
  const PTR_MAX_PULL = 95; // Máximo desplazamiento visual
  const PTR_RESISTANCE = 0.42; // Factor de elasticidad / resistencia

  let ptrStartY = 0;
  let ptrStartX = 0;
  let ptrIsPulling = false;
  let ptrIsRefreshing = false;
  let ptrHapticFired = false;

  function getScrollTop() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function isBlocked() {
    if (ptrIsRefreshing) return true;

    // Si hay un modal abierto o el menú drawer está activo
    if (document.body.classList.contains('modal-open')) return true;
    const drawer = document.getElementById('navDrawer');
    if (drawer && drawer.classList.contains('active')) return true;

    // En la Botonera DT activa no interrumpir el partido con tirones accidentales
    if (typeof currentActiveView !== 'undefined' && currentActiveView === 'dt') return true;

    return false;
  }

  function onTouchStart(e) {
    if (isBlocked() || !e.touches || e.touches.length !== 1) return;

    if (getScrollTop() <= 2) {
      ptrStartY = e.touches[0].clientY;
      ptrStartX = e.touches[0].clientX;
      ptrIsPulling = false;
      ptrHapticFired = false;
    } else {
      ptrStartY = 0;
    }
  }

  function onTouchMove(e) {
    if (ptrStartY === 0 || isBlocked() || !e.touches || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - ptrStartY;
    const deltaX = currentX - ptrStartX;

    // Si el usuario se desplaza más horizontalmente que verticalmente (ej. swipe lateral), cancelar
    if (Math.abs(deltaX) > Math.abs(deltaY) && !ptrIsPulling) {
      ptrStartY = 0;
      return;
    }

    // Si ya no está arriba de todo, cancelar
    if (getScrollTop() > 2) {
      if (ptrIsPulling) resetIndicator();
      ptrStartY = 0;
      return;
    }

    if (deltaY > 6) {
      if (e.cancelable) e.preventDefault();
      ptrIsPulling = true;

      const indicator = document.getElementById('pullRefreshIndicator');
      const label = document.getElementById('pullRefreshLabel');
      if (!indicator) return;

      const pullDistance = Math.min(deltaY * PTR_RESISTANCE, PTR_MAX_PULL);
      indicator.style.transform = `translate(-50%, ${pullDistance - 50}px)`;
      indicator.classList.add('visible');

      if (pullDistance >= PTR_THRESHOLD) {
        if (!indicator.classList.contains('ready')) {
          indicator.classList.add('ready');
          if (label) label.textContent = 'Soltá para actualizar';
          if (!ptrHapticFired) {
            if (navigator.vibrate) navigator.vibrate(15);
            ptrHapticFired = true;
          }
        }
      } else {
        if (indicator.classList.contains('ready')) {
          indicator.classList.remove('ready');
          if (label) label.textContent = 'Deslizá para actualizar';
          ptrHapticFired = false;
        }
      }
    }
  }

  async function onTouchEnd() {
    if (!ptrIsPulling || isBlocked()) {
      ptrStartY = 0;
      ptrIsPulling = false;
      return;
    }

    ptrIsPulling = false;
    ptrStartY = 0;

    const indicator = document.getElementById('pullRefreshIndicator');
    const label = document.getElementById('pullRefreshLabel');
    if (!indicator) return;

    if (indicator.classList.contains('ready')) {
      ptrIsRefreshing = true;
      indicator.classList.remove('ready');
      indicator.classList.add('refreshing');
      if (label) label.textContent = 'Actualizando...';

      // Disparar sincronización según la pantalla activa
      try {
        if (typeof currentActiveView !== 'undefined') {
          if (currentActiveView === 'torneo') {
            if (typeof syncTournamentData === 'function') await syncTournamentData(true);
          } else if (currentActiveView === 'fisico') {
            if (typeof loadPhysicalEvaluations === 'function') await loadPhysicalEvaluations(true);
          } else if (currentActiveView === 'estadisticas') {
            if (typeof syncAllMatchesFromCloud === 'function') await syncAllMatchesFromCloud();
          } else {
            if (typeof syncWithGoogleSheets === 'function') await syncWithGoogleSheets(true);
          }
        } else {
          if (typeof syncWithGoogleSheets === 'function') await syncWithGoogleSheets(true);
        }
      } catch (err) {
        console.warn('[PullRefresh] Error durante sincronización:', err);
      }

      // Estado de éxito
      indicator.classList.remove('refreshing');
      indicator.classList.add('success');
      if (label) label.textContent = '¡Al día!';
      if (navigator.vibrate) navigator.vibrate([10, 40, 10]);

      setTimeout(() => {
        resetIndicator();
        ptrIsRefreshing = false;
      }, 500);

    } else {
      resetIndicator();
    }
  }

  function resetIndicator() {
    const indicator = document.getElementById('pullRefreshIndicator');
    const label = document.getElementById('pullRefreshLabel');
    if (!indicator) return;

    indicator.style.transform = '';
    indicator.classList.remove('visible', 'ready', 'refreshing', 'success');
    if (label) label.textContent = 'Deslizá para actualizar';
    ptrHapticFired = false;
  }

  // Registrar listeners globales con { passive: false } en touchmove para poder llamar preventDefault
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', resetIndicator, { passive: true });
})();

