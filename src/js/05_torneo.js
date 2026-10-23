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
