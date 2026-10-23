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
