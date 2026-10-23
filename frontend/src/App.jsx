import { useEffect, useState } from 'react';
import TrackerPanel from './components/TrackerPanel';
import TournamentPanel from './components/TournamentPanel';
import EstadisticasPanel from './components/EstadisticasPanel';
import PrecargaModal from './components/PrecargaModal';
import SunModeToggle from './components/SunModeToggle';

const emptyClub = {
  slug: '',
  name: '',
  shortName: '',
  sport: 'Hockey',
  teamName: 'PLANTEL SUPERIOR',
  logoUrl: '',
  spreadsheetId: '',
  physicalSpreadsheetId: '',
  dtSpreadsheetId: '',
  dtSpreadsheetUrl: '',
  staffPassword: '',
  staffSecret: '',
  tournamentName: '',
  tournamentBaseUrl: '',
  tournamentId: '',
  tournamentClubId: '',
  tournamentDivision: '1'
};

function parseSheet(table) {
  const players = [];
  const meta = {};
  (table?.rows || []).forEach(row => {
    if (!row.c) return;
    const cited = row.c[5]?.v?.toString().trim();
    if (cited && cited.toLowerCase() !== 'jugadoras citadas') players.push(cited);
    const label = row.c[7]?.v?.toString().trim().toLowerCase();
    const value = (row.c[8]?.f || row.c[8]?.v || '').toString().trim();
    if (label && value) meta[label] = value;
  });
  return { players, meta };
}

function parsePhysicalTable(table) {
  const players = [];
  const value = cell => (cell?.f ?? cell?.v ?? '').toString().trim();
  const number = cell => {
    const raw = value(cell).replace(',', '.').replace(/[^\d.-]/g, '');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  (table?.rows || []).forEach((row, index) => {
    const name = value(row.c?.[2]);
    if (!name || name.toLowerCase().includes('apellido') || name.length <= 1) return;
    const division = value(row.c?.[0]) || 'PS';
    const branch = value(row.c?.[1]) || 'B';
    const filterTag = division.toLowerCase().includes('5ta') || division.toLowerCase().includes('quinta')
      ? '5ta' : branch.toLowerCase().includes('inter') ? 'Inter' : '1ra';
    const tests = {};
    PHYSICAL_TESTS.forEach(test => {
      const evals = test.cols.map((column, round) => {
        const item = number(row.c?.[column]);
        return item === null ? null : { round: round + 1, value: item };
      }).filter(Boolean);
      if (evals.length) {
        const first = evals[0].value;
        const last = evals[evals.length - 1].value;
        const diff = evals.length > 1 ? Number((last - first).toFixed(test.decimals)) : null;
        tests[test.key] = { evals, diff, improved: diff === null ? null : test.higherIsBetter ? diff > 0 : diff < 0 };
      }
    });
    players.push({ id: `physical-${index}`, name, division, branch, filterTag, tests });
  });
  return players;
}

const PHYSICAL_TESTS = [
  { key: 'broadJump', name: 'Broad Jump', type: 'Salto horizontal', unit: 'm', higherIsBetter: true, icon: '🏃‍♀️', decimals: 2, cols: [3, 4, 5] },
  { key: 'cmj', name: 'CMJ', type: 'Salto vertical', unit: 'cm', higherIsBetter: true, icon: '⚡', decimals: 1, cols: [6, 7, 8] },
  { key: 'agility', name: 'Test 5-10-5', type: 'Agilidad', unit: 'seg', higherIsBetter: false, icon: '⏱️', decimals: 2, cols: [9, 10, 11] },
  { key: 'sprint', name: 'Velocidad 40 mts', type: 'Velocidad', unit: 'seg', higherIsBetter: false, icon: '💨', decimals: 2, cols: [12, 13, 14] },
  { key: 'yoyo', name: 'Yo-Yo Test', type: 'Resistencia', unit: 'm', higherIsBetter: true, icon: '🫁', decimals: 0, cols: [15, 16, 17] },
  { key: 'bench', name: 'Press de banca', type: 'Fuerza superior', unit: 'kg', higherIsBetter: true, icon: '🏋️‍♀️', decimals: 1, cols: [18, 19, 20] },
  { key: 'deadlift', name: 'Peso muerto', type: 'Cadena posterior', unit: 'kg', higherIsBetter: true, icon: '🏋️', decimals: 1, cols: [21, 22, 23] },
  { key: 'squat', name: 'Sentadilla', type: 'Fuerza inferior', unit: 'kg', higherIsBetter: true, icon: '🦵', decimals: 1, cols: [24, 25, 26] },
  { key: 'platform', name: 'Plataforma', type: 'Potencia', unit: '', higherIsBetter: true, icon: '🎯', decimals: 1, cols: [27, 28, 29] }
];

function ClubWorkspace({ club, onBack }) {
  const [category, setCategory] = useState('primera');
  const [view, setView] = useState('citaciones'); // 'citaciones' | 'fisico' | 'dt' | 'stats' | 'torneo'
  const [data, setData] = useState({ primera: null, intermedia: null });
  const [physicalPlayers, setPhysicalPlayers] = useState([]);
  const [physicalMode, setPhysicalMode] = useState('players');
  const [physicalFilter, setPhysicalFilter] = useState('all');
  const [physicalSearch, setPhysicalSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [status, setStatus] = useState('Cargando planillas...');
  const [showPrecargaModal, setShowPrecargaModal] = useState(false);

  // Estado compartido para Botonera DT y Estadísticas
  const storageKey = `club_tracker_${club.slug}`;
  const authKey = `club_tracker_auth_${club.slug}`;
  const [events, setEvents] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return saved.events || [];
    } catch (_) {
      return [];
    }
  });

  const [matches, setMatches] = useState([]);
  const [nextAmhMatch, setNextAmhMatch] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState('');

  // Recargar eventos al cambiar de club
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      setEvents(saved.events || []);
    } catch (_) {
      setEvents([]);
    }
  }, [club.slug, storageKey]);

  // Sincronizar persistencia de eventos
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localStorage.setItem(storageKey, JSON.stringify({ ...saved, events }));
    } catch (_) {}
  }, [events, storageKey]);

  // Cargar fixture para Botonera y Estadísticas
  async function loadMatches(div = (category === 'intermedia' ? '2' : '1')) {
    try {
      const response = await fetch(`/api/torneo/matches?club=${encodeURIComponent(club.slug)}&division=${div}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el fixture.');
      setMatches(payload.matches || payload.pendingMatches || []);
      setNextAmhMatch(payload.nextMatch || (payload.pendingMatches && payload.pendingMatches[0]) || null);
    } catch (_) {}
  }

  // Verificar sesión persistida de cuerpo técnico y fixture
  useEffect(() => {
    loadMatches(category === 'intermedia' ? '2' : '1');
    try {
      const savedToken = localStorage.getItem(authKey);
      if (savedToken) {
        fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, { headers: { Authorization: `Bearer ${savedToken}` } })
          .then(res => res.json())
          .then(payload => {
            if (payload.valid) {
              setToken(savedToken);
              setAuthenticated(true);
            } else {
              localStorage.removeItem(authKey);
            }
          })
          .catch(() => localStorage.removeItem(authKey));
      }
    } catch (_) {}
  }, [club.slug, category]);

  async function loadSheets() {
    if (!club.spreadsheetId) {
      setStatus('Este club todavía no tiene configurada la planilla de citaciones.');
      return;
    }
    try {
      const loadTab = async tab => {
        const response = await fetch(`/api/sheets?club=${encodeURIComponent(club.slug)}&sheet=${encodeURIComponent(tab)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `Planilla ${tab}: HTTP ${response.status}`);
        return parseSheet(payload.table);
      };
      const [primera, intermedia] = await Promise.all([loadTab('primera'), loadTab('intermedia')]);
      setData({ primera, intermedia });
      setStatus(`Actualizado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loadPhysical() {
    setStatus('Cargando evaluaciones físicas...');
    try {
      const response = await fetch(`/api/sheets/physical?club=${encodeURIComponent(club.slug)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Evaluaciones físicas: HTTP ${response.status}`);
      setPhysicalPlayers(parsePhysicalTable(payload.table));
      setStatus(`Evaluaciones actualizadas ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadSheets();
  }, [club.spreadsheetId]);

  const current = data[category] || { players: [], meta: {} };
  const meta = current.meta;
  const visiblePlayers = physicalPlayers.filter(player => {
    const matchesCategory = physicalFilter === 'all' || player.filterTag === physicalFilter;
    const query = physicalSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return matchesCategory && (!query || player.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(query));
  });

  const averages = PHYSICAL_TESTS.map(test => {
    const values = visiblePlayers.map(player => player.tests[test.key]?.evals.at(-1)?.value).filter(value => value !== undefined);
    const rounds = [1, 2, 3].map(round => {
      const roundValues = visiblePlayers.map(player => player.tests[test.key]?.evals.find(item => item.round === round)?.value).filter(value => value !== undefined);
      return roundValues.length ? Number((roundValues.reduce((sum, value) => sum + value, 0) / roundValues.length).toFixed(test.decimals)) : null;
    });
    return { ...test, latest: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(test.decimals)) : null, rounds };
  });

  const selected = physicalPlayers.find(player => player.id === selectedPlayer);

  return (
    <main className="portal">
      <section className="workspace">
        <button className="secondary back-button" onClick={onBack}>← Volver a clubes</button>
        <header className="workspace-header">
          <img src={club.logoUrl || '/escudo-regatas-andino.png'} alt="" />
          <div>
            <span className="kicker">{club.shortName}</span>
            <h1>{club.teamName}</h1>
            <p>{club.sport}</p>
          </div>
          <div className="workspace-header-actions">
            <SunModeToggle />
            {authenticated && (
              <button
                type="button"
                className="secondary precarga-trigger-btn"
                onClick={() => setShowPrecargaModal(true)}
                title="Inscribir tildadas en el sistema oficial de AMH"
              >
                🏑 Precarga AMH
              </button>
            )}
          </div>
        </header>

        <nav className="workspace-nav">
          <button className={view === 'citaciones' ? 'active' : ''} onClick={() => setView('citaciones')}>Citaciones</button>
          <button className={view === 'fisico' ? 'active' : ''} onClick={() => { setView('fisico'); if (!physicalPlayers.length) loadPhysical(); }}>Evaluaciones físicas</button>
          <button className={view === 'dt' ? 'active' : ''} onClick={() => setView('dt')}>Botonera DT</button>
          <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')}>Estadísticas</button>
          <button className={view === 'torneo' ? 'active' : ''} onClick={() => setView('torneo')}>Torneos</button>
        </nav>

        {view === 'citaciones' && (
          <div className="category-tabs">
            <button className={category === 'primera' ? 'active' : ''} onClick={() => setCategory('primera')}>1ra División</button>
            <button className={category === 'intermedia' ? 'active' : ''} onClick={() => setCategory('intermedia')}>Intermedia</button>
          </div>
        )}

        {!['dt', 'stats'].includes(view) && (
          <div className="sync-status">
            {status}
            <button className="refresh" onClick={view === 'fisico' ? loadPhysical : loadSheets}>Actualizar</button>
          </div>
        )}

        {view === 'dt' ? (
          <TrackerPanel
            club={club}
            events={events}
            setEvents={setEvents}
            matches={matches}
            loadMatches={loadMatches}
            authenticated={authenticated}
            token={token}
            onOpenPrecarga={() => setShowPrecargaModal(true)}
            onAuthenticate={t => {
              setToken(t);
              setAuthenticated(true);
              localStorage.setItem(authKey, t);
            }}
          />
        ) : view === 'stats' ? (
          <EstadisticasPanel
            club={club}
            events={events}
            matches={matches}
            authenticated={authenticated}
            onAuthenticate={t => {
              setToken(t);
              setAuthenticated(true);
              localStorage.setItem(authKey, t);
            }}
          />
        ) : view === 'torneo' ? (
          <TournamentPanel club={club} />
        ) : view === 'fisico' ? (
          <section className="physical-card">
            <h2>Evaluaciones físicas</h2>
            <div className="physical-hero">
              <span className="kicker">⚡ RENDIMIENTO ATLÉTICO</span>
              <p>Buscá una jugadora para ver sus mediciones y evolución.</p>
            </div>
            <input
              className="physical-search"
              value={physicalSearch}
              onChange={event => setPhysicalSearch(event.target.value)}
              placeholder="🔍 Escribí tu nombre o apellido..."
            />
            <div className="physical-filters">
              {[['all', 'Todas'], ['1ra', '1ra División'], ['Inter', 'Intermedia'], ['5ta', '5ta División']].map(([key, label]) => (
                <button
                  key={key}
                  className={physicalFilter === key ? 'active' : ''}
                  onClick={() => {
                    setPhysicalFilter(key);
                    setSelectedPlayer(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="physical-modes">
              {[['players', '👤 Jugadoras'], ['averages', '📊 Medias'], ['top10', '🏆 Top 10']].map(([key, label]) => (
                <button
                  key={key}
                  className={physicalMode === key ? 'active' : ''}
                  onClick={() => setPhysicalMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {physicalMode === 'players' && (
              <div className="physical-player-layout">
                <div className="physical-player-list">
                  {visiblePlayers.length ? (
                    visiblePlayers
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(player => (
                        <button
                          className={`physical-player ${selectedPlayer === player.id ? 'selected' : ''}`}
                          key={player.id}
                          onClick={() => setSelectedPlayer(player.id)}
                        >
                          <strong>{player.name}</strong>
                          <span>{player.filterTag === 'Inter' ? 'Intermedia' : player.filterTag === '5ta' ? '5ta División' : '1ra División'}</span>
                        </button>
                      ))
                  ) : (
                    <p className="empty-state">No se encontraron jugadoras.</p>
                  )}
                </div>
                {selected ? (
                  <div className="physical-profile">
                    <div className="physical-profile-header">
                      <div>
                        <span className="kicker">FICHA ATLÉTICA</span>
                        <h3>{selected.name}</h3>
                        <span>{selected.filterTag === 'Inter' ? 'Intermedia' : selected.filterTag === '5ta' ? '5ta División' : '1ra División'}</span>
                      </div>
                      <button className="secondary" onClick={() => setSelectedPlayer(null)}>Cambiar</button>
                    </div>
                    <div className="test-cards">
                      {PHYSICAL_TESTS.map(test => {
                        const result = selected.tests[test.key];
                        const latest = result?.evals.at(-1);
                        return (
                          <article className="test-card" key={test.key}>
                            <div>
                              <span className="test-icon">{test.icon}</span>
                              <strong>{test.name}</strong>
                              <small>{test.type}</small>
                            </div>
                            <b>{latest ? `${latest.value} ${test.unit}` : 'Sin registros'}</b>
                            <div className="test-rounds">
                              {[1, 2, 3].map(round => (
                                <span key={round}>{round}°: {result?.evals.find(item => item.round === round)?.value ?? '—'}</span>
                              ))}
                            </div>
                            {result?.diff != null && (
                              <em className={result.improved ? 'positive' : 'negative'}>
                                {result.improved ? '↗' : '↘'} {result.diff > 0 ? '+' : ''}{result.diff} {test.unit}
                              </em>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">Seleccioná una jugadora para ver su ficha.</p>
                )}
              </div>
            )}
            {physicalMode === 'averages' && (
              <div className="average-grid">
                {averages.map(test => (
                  <article className="average-card" key={test.key}>
                    <div className="average-heading">
                      <span className="test-icon">{test.icon}</span>
                      <div>
                        <strong>{test.name}</strong>
                        <small>{test.type}</small>
                      </div>
                      <b>{test.latest === null ? '—' : `${test.latest} ${test.unit}`}</b>
                    </div>
                    <div className="test-rounds">
                      {test.rounds.map((value, index) => (
                        <span key={index}>{index + 1}° eval: {value === null ? '—' : `${value} ${test.unit}`}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {physicalMode === 'top10' && (
              <div className="top10-grid-react">
                {PHYSICAL_TESTS.map(test => {
                  const ranked = visiblePlayers
                    .map(player => ({ player, value: player.tests[test.key]?.evals.at(-1)?.value }))
                    .filter(item => item.value !== undefined)
                    .sort((a, b) => (test.higherIsBetter ? b.value - a.value : a.value - b.value))
                    .slice(0, 10);
                  return (
                    <article className="top10-card" key={test.key}>
                      <h3>{test.icon} {test.name}</h3>
                      {ranked.length ? (
                        ranked.map((item, index) => (
                          <button
                            key={item.player.id}
                            onClick={() => {
                              setPhysicalMode('players');
                              setSelectedPlayer(item.player.id);
                            }}
                          >
                            <span>#{index + 1}</span>
                            <strong>{item.player.name}</strong>
                            <b>{item.value} {test.unit}</b>
                          </button>
                        ))
                      ) : (
                        <p className="empty-state">Sin registros.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="match-card">
              <span className="kicker">{nextAmhMatch?.round || meta['fecha n°'] || meta['fecha'] || 'PRÓXIMO PARTIDO'}</span>
              <h2>{nextAmhMatch ? `vs ${nextAmhMatch.rival}` : (meta.rival || 'Rival pendiente')}</h2>
              <div className="match-details">
                <span>📅 {nextAmhMatch?.fecha || meta.dia || meta['día'] || 'Fecha pendiente'}</span>
                <span>⏱️ {meta['horario partido'] || meta.partido || (nextAmhMatch ? 'Horario oficial AMH' : 'Horario pendiente')}</span>
                <span>📍 {nextAmhMatch ? (nextAmhMatch.homeAway === 'Local' ? `${club.shortName || club.name} (Local)` : `${nextAmhMatch.rival} (Visitante)`) : (meta.cancha || 'Cancha pendiente')}</span>
              </div>
            </section>
            <section className="players-section">
              <h2>Jugadoras citadas <span>{current.players.length}</span></h2>
              {current.players.length ? (
                <div className="players-grid">
                  {current.players.map((player, index) => (
                    <div className="player-pill" key={`${player}-${index}`}>{player}</div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No hay jugadoras citadas en la hoja {category}.</p>
              )}
            </section>
          </>
        )}

        <a className="legacy-link" href={`http://localhost:3000/?club=${encodeURIComponent(club.slug)}`}>
          Abrir módulo legacy completo
        </a>
      </section>

      {/* Modal de Precarga AMH */}
      {showPrecargaModal && (
        <PrecargaModal
          club={club}
          citedPlayers={data}
          authenticated={authenticated}
          onAuthenticate={t => {
            setToken(t);
            setAuthenticated(true);
            localStorage.setItem(authKey, t);
          }}
          onClose={() => setShowPrecargaModal(false)}
        />
      )}
    </main>
  );
}

async function api(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la operación.');
  return payload;
}

function App() {
  const [clubs, setClubs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyClub);
  const [adminToken, setAdminToken] = useState(sessionStorage.getItem('club_admin_token') || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [amhCatalog, setAmhCatalog] = useState(null);
  const [amhLoading, setAmhLoading] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspaceClub, setWorkspaceClub] = useState(null);

  async function loadClubs() {
    setLoading(true);
    try {
      const data = await api('/api/config');
      const availableClubs = data.clubs || [];
      setClubs(availableClubs);
      const requestedSlug = new URLSearchParams(window.location.search).get('club');
      const requestedClub = availableClubs.find(club => club.slug === requestedSlug);
      if (requestedClub) setWorkspaceClub(requestedClub);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClubs();
  }, []);

  function openCreate() {
    setSelected(null);
    setForm(emptyClub);
    setShowForm(true);
    setMessage('');
  }

  function openWorkspace(club) {
    setWorkspaceClub(club);
    window.history.pushState({}, '', `/?club=${encodeURIComponent(club.slug)}`);
  }

  function openEdit(club) {
    setSelected(club);
    setForm({
      ...emptyClub,
      ...club,
      tournamentName: club.tournament?.name || '',
      tournamentBaseUrl: club.tournament?.baseUrl || '',
      tournamentId: club.tournament?.tournamentId || '',
      tournamentClubId: club.tournament?.clubId || '',
      tournamentDivision: club.tournament?.division || '1'
    });
    setShowForm(true);
    setMessage('');
  }

  async function loadAmhCatalog() {
    setAmhLoading(true);
    try {
      const baseUrl = form.tournamentBaseUrl || 'http://15.235.75.172:8080';
      const data = await api(`/api/amh/catalog?baseUrl=${encodeURIComponent(baseUrl)}`);
      setAmhCatalog(data);
      setMessage('Catálogo AMH cargado. Elegí el torneo y el equipo.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAmhLoading(false);
    }
  }

  function updateTournamentField(event) {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'tournamentSelect'
        ? {
            tournamentName: amhCatalog?.tournaments.find(item => item.value === value)?.label || '',
            tournamentId: value
          }
        : {}),
      ...(name === 'tournamentClubSelect' ? { tournamentClubId: value } : {})
    }));
  }

  async function loginAdmin(event) {
    event.preventDefault();
    try {
      const data = await api('/api/admin/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password: adminPassword })
      });
      sessionStorage.setItem('club_admin_token', data.token);
      setAdminToken(data.token);
      setAdminPassword('');
      setMessage('Administrador autenticado.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveClub(event) {
    event.preventDefault();
    if (logoReading) {
      setMessage('Esperá a que termine de cargar el escudo.');
      return;
    }
    if (!adminToken) {
      setMessage('Iniciá sesión como administrador antes de guardar.');
      return;
    }
    const body = {
      slug: selected?.slug,
      club: {
        slug: form.slug,
        name: form.name,
        shortName: form.shortName,
        sport: form.sport,
        teamName: form.teamName,
        logoUrl: form.logoUrl,
        spreadsheetId: form.spreadsheetId,
        physicalSpreadsheetId: form.physicalSpreadsheetId,
        dtSpreadsheetId: form.dtSpreadsheetId,
        dtSpreadsheetUrl: form.dtSpreadsheetUrl,
        tournament: {
          name: form.tournamentName,
          baseUrl: form.tournamentBaseUrl,
          tournamentId: form.tournamentId,
          clubId: form.tournamentClubId,
          division: form.tournamentDivision || '1'
        },
        auth: { password: form.staffPassword, secret: form.staffSecret }
      }
    };
    try {
      const saved = await api('/api/admin/clubs', {
        method: selected ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(body)
      });
      setClubs(current => current.map(club => (club.slug === saved.club.slug ? saved.club : club)));
      setMessage(selected ? 'Perfil actualizado.' : 'Club creado.');
      setShowForm(false);
      await loadClubs();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('La foto o escudo debe ser una imagen válida (PNG, JPG, WEBP, SVG).');
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage('La imagen no puede superar 1 MB.');
      return;
    }
    setLogoReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setForm(current => ({ ...current, logoUrl: String(reader.result) }));
      setLogoReading(false);
      setMessage('Foto o escudo cargado. Guardá los cambios para persistirlo.');
    };
    reader.onerror = () => {
      setLogoReading(false);
      setMessage('No se pudo leer el archivo del escudo.');
    };
    reader.readAsDataURL(file);
  }

  if (workspaceClub) {
    return (
      <ClubWorkspace
        club={workspaceClub}
        onBack={() => {
          setWorkspaceClub(null);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  return (
    <main className="portal">
      <section className="shell">
        <span className="kicker">SPORTS CLUBS PLATFORM</span>
        <h1>Elegí tu club</h1>
        <p className="intro">Un espacio para administrar equipos, citaciones, evaluaciones y torneos.</p>
        {message && <div className="message">{message}</div>}
        <div className="toolbar">
          {!adminToken ? (
            <form className="admin-login" onSubmit={loginAdmin}>
              <input
                type="password"
                placeholder="Contraseña de administrador"
                value={adminPassword}
                onChange={event => setAdminPassword(event.target.value)}
              />
              <button>Ingresar</button>
            </form>
          ) : (
            <button
              className="secondary"
              onClick={() => {
                sessionStorage.removeItem('club_admin_token');
                setAdminToken('');
              }}
            >
              Cerrar sesión admin
            </button>
          )}
          <button onClick={openCreate}>+ Agregar club</button>
        </div>
        {loading ? (
          <p>Cargando clubes...</p>
        ) : (
          <div className="club-list">
            {clubs.map(club => (
              <article className="club-card" key={club.slug}>
                <a
                  href={`/?club=${encodeURIComponent(club.slug)}`}
                  onClick={event => {
                    event.preventDefault();
                    openWorkspace(club);
                  }}
                >
                  <img src={club.logoUrl || '/escudo-regatas-andino.png'} alt="" />
                  <span>
                    <strong>{club.shortName || club.name}</strong>
                    <small>{club.sport} · {club.teamName}</small>
                  </span>
                  <b>→</b>
                </a>
                {adminToken && (
                  <button className="edit" onClick={() => openEdit(club)}>
                    Editar perfil
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {showForm && (
        <div className="overlay">
          <form className="form-card" onSubmit={saveClub}>
            <button type="button" className="close" onClick={() => setShowForm(false)}>
              ×
            </button>
            <span className="kicker">ADMINISTRACIÓN</span>
            <h2>{selected ? 'Perfil del club' : 'Agregar club'}</h2>
            {[
              'slug',
              'name',
              'shortName',
              'sport',
              'teamName',
              'logoUrl',
              'spreadsheetId',
              'physicalSpreadsheetId',
              'dtSpreadsheetId',
              'dtSpreadsheetUrl',
              'tournamentName',
              'tournamentBaseUrl',
              'tournamentId',
              'tournamentClubId'
            ].map(name => (
              <label key={name}>
                {name}
                <input
                  name={name}
                  value={form[name]}
                  onChange={updateField}
                  required={['slug', 'name', 'shortName', 'sport', 'teamName'].includes(name)}
                  readOnly={selected && name === 'slug'}
                />
              </label>
            ))}
            <label>
              Foto o escudo del club
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} />
            </label>
            {form.logoUrl && (
              <div className="logo-preview">
                <img src={form.logoUrl} alt="Vista previa del club" />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setForm(current => ({ ...current, logoUrl: '' }))}
                >
                  Quitar imagen
                </button>
              </div>
            )}
            <fieldset className="amh-selector">
              <legend>Configurar torneo desde AMH</legend>
              <p>Buscá los datos oficiales sin cargar IDs manualmente.</p>
              <label>
                URL base de AMH
                <input
                  name="tournamentBaseUrl"
                  value={form.tournamentBaseUrl}
                  onChange={updateField}
                  placeholder="http://15.235.75.172:8080"
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={loadAmhCatalog}
                disabled={amhLoading}
              >
                {amhLoading ? 'Buscando en AMH...' : 'Buscar torneos y equipos'}
              </button>
              {amhCatalog && (
                <>
                  <label>
                    Torneo
                    <select
                      name="tournamentSelect"
                      value={form.tournamentId}
                      onChange={updateTournamentField}
                    >
                      <option value="">Seleccioná un torneo</option>
                      {amhCatalog.tournaments.map(item => (
                        <option value={item.value} key={`${item.value}-${item.label}`}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Equipo
                    <select
                      name="tournamentClubSelect"
                      value={form.tournamentClubId}
                      onChange={updateTournamentField}
                    >
                      <option value="">Seleccioná un equipo</option>
                      {amhCatalog.teams.map(item => (
                        <option value={item.value} key={`${item.value}-${item.label}`}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    División AMH
                    <select
                      name="tournamentDivision"
                      value={form.tournamentDivision || '1'}
                      onChange={updateField}
                    >
                      {amhCatalog.divisions.map(item => (
                        <option value={item.value} key={`${item.value}-${item.label}`}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </fieldset>
            {!selected && (
              <>
                <label>
                  Contraseña cuerpo técnico
                  <input
                    name="staffPassword"
                    type="password"
                    value={form.staffPassword}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  Secreto del club
                  <input
                    name="staffSecret"
                    type="password"
                    value={form.staffSecret}
                    onChange={updateField}
                    required
                  />
                </label>
              </>
            )}
            <button type="submit" disabled={logoReading}>
              {logoReading ? 'Cargando escudo...' : selected ? 'Guardar cambios' : 'Crear club'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
