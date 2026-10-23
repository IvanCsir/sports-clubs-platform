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
