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
