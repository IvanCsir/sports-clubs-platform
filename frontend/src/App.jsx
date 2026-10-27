import { useEffect, useState } from 'react';
import { Activity, CalendarClock, ChevronRight, ClipboardList, Dumbbell, Goal, HeartPulse, MapPin, Megaphone, Timer, Trophy, UsersRound, Wind, Zap, PersonStanding, Target } from 'lucide-react';
import TrackerPanel from './components/TrackerPanel';
import TournamentPanel from './components/TournamentPanel';
import EstadisticasPanel from './components/EstadisticasPanel';
import PrecargaModal from './components/PrecargaModal';
import MatchPreparationPanel from './components/MatchPreparationPanel';
import PlayerMonitoringPanel from './components/PlayerMonitoringPanel';
import OpponentBadge from './components/OpponentBadge';
import SeasonBackupPanel from './components/SeasonBackupPanel';

const emptyClub = {
  slug: '',
  name: '',
  shortName: '',
  sport: 'Hockey',
  teamName: 'PLANTEL SUPERIOR',
  logoUrl: '',
  staffPassword: '',
  staffSecret: '',
  tournamentName: '',
  tournamentBaseUrl: '',
  tournamentId: '',
  tournamentClubId: '',
  tournamentAmhTeamName: '',
  tournamentDivision: '1',
  seasonName: String(new Date().getFullYear())
};

const PHYSICAL_TESTS = [
  { key: 'broadJump', name: 'Broad Jump', type: 'Salto horizontal', category: 'potencia', unit: 'm', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: PersonStanding, decimals: 2, cols: [3, 4, 5] },
  { key: 'cmj', name: 'CMJ', type: 'Salto vertical', category: 'potencia', unit: 'cm', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: Zap, decimals: 1, cols: [6, 7, 8] },
  { key: 'agility', name: 'Test 5-10-5', type: 'Agilidad', category: 'agilidad', unit: 'seg', direction: 'lower', higherIsBetter: false, maxAttempts: 3, icon: Timer, decimals: 2, cols: [9, 10, 11] },
  { key: 'sprint', name: 'Velocidad 40 mts', type: 'Velocidad', category: 'velocidad', unit: 'seg', direction: 'lower', higherIsBetter: false, maxAttempts: 3, icon: Wind, decimals: 2, cols: [12, 13, 14] },
  { key: 'yoyo', name: 'Yo-Yo Test', type: 'Resistencia', category: 'resistencia', unit: 'm', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: HeartPulse, decimals: 0, cols: [15, 16, 17] },
  { key: 'bench', name: 'Press de banca', type: 'Fuerza superior', category: 'fuerza', unit: 'kg', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: Dumbbell, decimals: 1, cols: [18, 19, 20] },
  { key: 'deadlift', name: 'Peso muerto', type: 'Cadena posterior', category: 'fuerza', unit: 'kg', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: Dumbbell, decimals: 1, cols: [21, 22, 23] },
  { key: 'squat', name: 'Sentadilla', type: 'Fuerza inferior', category: 'fuerza', unit: 'kg', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: Activity, decimals: 1, cols: [24, 25, 26] },
  { key: 'platform', name: 'Plataforma', type: 'Potencia', category: 'potencia', unit: '', direction: 'higher', higherIsBetter: true, maxAttempts: 3, icon: Target, decimals: 1, cols: [27, 28, 29] }
];

function hydratePhysicalTests(tests) {
  const fallbackByKey = new Map(PHYSICAL_TESTS.map(test => [test.key, test]));
  return (tests?.length ? tests : PHYSICAL_TESTS).map(test => ({
    ...fallbackByKey.get(test.key),
    ...test,
    type: test.type || test.category || fallbackByKey.get(test.key)?.type || 'Personalizada',
    icon: fallbackByKey.get(test.key)?.icon || Activity,
    maxAttempts: Number(test.maxAttempts || fallbackByKey.get(test.key)?.maxAttempts || 3),
    decimals: Number(test.decimals ?? fallbackByKey.get(test.key)?.decimals ?? 2)
  }));
}

function normalizeMatchValue(value) {
  return String(value || '').trim().toLocaleLowerCase('es-AR').replace(/\s+/g, ' ');
}

function callupMatchesFixture(meta, fixture) {
  if (!fixture) return false;
  const storedRound = meta['fecha n°'] || meta['fecha n'] || meta.fecha || '';
  const storedDate = meta.dia || meta['día'] || meta.date || '';
  const identityComparisons = [
    [fixture.round, storedRound],
    [fixture.rival, meta.rival]
  ].filter(([fixtureValue, storedValue]) => fixtureValue && storedValue);
  if (identityComparisons.length === 2) {
    return identityComparisons.every(([fixtureValue, storedValue]) =>
      normalizeMatchValue(fixtureValue) === normalizeMatchValue(storedValue)
    );
  }
  const comparisons = [...identityComparisons, [fixture.fecha, storedDate]]
    .filter(([fixtureValue, storedValue]) => fixtureValue && storedValue);
  return comparisons.length >= 2 && comparisons.every(([fixtureValue, storedValue]) =>
    normalizeMatchValue(fixtureValue) === normalizeMatchValue(storedValue)
  );
}

function dateOrdinal(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / 86400000);
}

function parseCallupDate(value) {
  const text = String(value || '').trim();
  const localDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (localDate) return dateOrdinal(Number(localDate[3]), Number(localDate[2]), Number(localDate[1]));
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) return dateOrdinal(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
  return null;
}

function isCallupExpired(meta) {
  const matchDate = parseCallupDate(meta?.dia || meta?.['día'] || meta?.date);
  if (matchDate === null) return false;
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const today = Object.fromEntries(todayParts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const todayOrdinal = dateOrdinal(today.year, today.month, today.day);
  return todayOrdinal !== null && todayOrdinal - matchDate > 1;
}

function ClubWorkspace({ club, onBack, showAdminBack }) {
  const [category, setCategory] = useState('primera');
  const [view, setView] = useState('inicio');
  const [data, setData] = useState({ primera: null, intermedia: null });
  const [physicalPlayers, setPhysicalPlayers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playerDraft, setPlayerDraft] = useState({ name: '', category: 'primera' });
  const [playerError, setPlayerError] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [playerEditDraft, setPlayerEditDraft] = useState({ name: '', categories: [] });
  const [playerEditError, setPlayerEditError] = useState('');
  const [physicalMode, setPhysicalMode] = useState('players');
  const [physicalFilter, setPhysicalFilter] = useState('all');
  const [physicalSearch, setPhysicalSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [editingCallup, setEditingCallup] = useState(false);
  const [callupDraft, setCallupDraft] = useState('');
  const [callupMetaDraft, setCallupMetaDraft] = useState({});
  const [callupError, setCallupError] = useState('');
  const [editingPhysical, setEditingPhysical] = useState(false);
  const [physicalDraft, setPhysicalDraft] = useState({ name: '', category: 'primera', evaluatedOn: '', values: {} });
  const [physicalSaveError, setPhysicalSaveError] = useState('');
  const [physicalTests, setPhysicalTests] = useState(PHYSICAL_TESTS);
  const [editingTestCatalog, setEditingTestCatalog] = useState(false);
  const [testDraft, setTestDraft] = useState({ name: '', category: 'fuerza', unit: '', direction: 'neutral', decimals: 2, maxAttempts: 3 });
  const [testCatalogError, setTestCatalogError] = useState('');
  const [status, setStatus] = useState('Cargando información del club...');
  const [showPrecargaModal, setShowPrecargaModal] = useState(false);

  // Estado compartido para Botonera DT y Estadísticas
  const storageKey = `club_tracker_${club.slug}`;
  const authKey = `club_tracker_auth_${club.slug}`;
  const [events, setEvents] = useState([]);
  const [tournamentStats, setTournamentStats] = useState({ tournaments: [], activeKey: '' });
  const [monitoring, setMonitoring] = useState({ wellness: [], loads: [] });

  const [matches, setMatches] = useState([]);
  const [nextAmhMatch, setNextAmhMatch] = useState(null);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [staffLoginPassword, setStaffLoginPassword] = useState('');
  const [staffLoginError, setStaffLoginError] = useState('');

  // Cargar fixture para Botonera y Estadísticas
  async function loadMatches(div = (category === 'intermedia' ? '2' : '1')) {
    setMatchesLoaded(false);
    try {
      const response = await fetch(`/api/torneo/matches?club=${encodeURIComponent(club.slug)}&division=${div}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el fixture.');
      setMatches(payload.matches || payload.pendingMatches || []);
      setNextAmhMatch(payload.nextMatch || (payload.pendingMatches && payload.pendingMatches[0]) || null);
    } catch (_) {
      setNextAmhMatch(null);
    } finally {
      setMatchesLoaded(true);
    }
  }

  async function loadStaffData(sessionToken = token) {
    if (!sessionToken) return;
    const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}&dataset=staff`, {
      headers: { Authorization: `Bearer ${sessionToken}` }, cache: 'no-store'
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los datos del cuerpo técnico.');
    setEvents(payload.events || []);
    setTournamentStats(payload.tournamentStats || { tournaments: [], activeKey: '' });
    setPhysicalPlayers(payload.physicalPlayers || []);
    setPhysicalTests(hydratePhysicalTests(payload.physicalTests));
    setPlayers(payload.players || []);
    setMonitoring(payload.monitoring || { wellness: [], loads: [] });
    if (payload.citations) setData(payload.citations);
  }

  async function authenticateStaff(password) {
    const response = await fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
    });
    const payload = await response.json();
    if (!response.ok || !payload.token) throw new Error(payload.error || 'No se pudo iniciar sesión.');
    await loadStaffData(payload.token);
    setToken(payload.token);
    setAuthenticated(true);
    sessionStorage.setItem(authKey, payload.token);
    return payload.token;
  }

  async function authenticateStaffWithToken(sessionToken) {
    const response = await fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }, cache: 'no-store'
    });
    const payload = await response.json();
    if (!response.ok || !payload.valid) throw new Error('La sesión venció. Ingresá nuevamente.');
    await loadStaffData(sessionToken);
    setToken(sessionToken);
    setAuthenticated(true);
    sessionStorage.setItem(authKey, sessionToken);
    return sessionToken;
  }

  async function submitStaffLogin(event) {
    event.preventDefault();
    setStaffLoginError('');
    try {
      await authenticateStaff(staffLoginPassword);
      setStaffLoginPassword('');
      setShowStaffLogin(false);
      setView('inicio');
    } catch (error) { setStaffLoginError(error.message); }
  }

  function logoutStaff() {
    sessionStorage.removeItem(authKey);
    localStorage.removeItem(authKey);
    setToken('');
    setAuthenticated(false);
    setEvents([]);
    setTournamentStats({ tournaments: [], activeKey: '' });
    setPlayers([]);
    setPhysicalPlayers([]);
    setPhysicalTests(PHYSICAL_TESTS);
    setMonitoring({ wellness: [], loads: [] });
    setSelectedPlayer(null);
    setEditingCallup(false);
    setEditingPhysical(false);
    setShowPrecargaModal(false);
    setView('inicio');
  }

  async function persistTrackerEvent(event, opponent) {
    const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'save-event', match: event.match, matchKey: event.matchKey, opponent, event })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo guardar el evento en la base de datos.');
    setTournamentStats(current => ({
      ...current,
      tournaments: current.tournaments.map(tournament => tournament.key === current.activeKey
        ? { ...tournament, events: [...(tournament.events || []).filter(item => item.id !== event.id), { ...event, opponent }] }
        : tournament)
    }));
  }

  async function removeTrackerEvent(id) {
    const isBatch = Array.isArray(id);
    const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(isBatch ? { ids: id } : { id })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar el evento.');
  }

  function beginCallupEdit() {
    const currentData = current;
    setCallupDraft((currentData.players || []).join('\n'));
    const meta = currentData.meta || {};
    const fixtureMatchesCurrentCallup = callupMatchesFixture(meta, nextAmhMatch);
    setCallupMetaDraft({
      round: nextAmhMatch?.round || meta['fecha n°'] || meta['fecha n'] || meta.fecha || '',
      opponent: nextAmhMatch?.rival || meta.rival || '',
      date: nextAmhMatch?.fecha || meta.dia || meta['día'] || '',
      homeAway: nextAmhMatch?.homeAway || meta.localia || 'Local',
      venue: nextAmhMatch ? (fixtureMatchesCurrentCallup ? (meta.cancha || '') : '') : (meta.cancha || ''),
      callTime: nextAmhMatch
        ? (fixtureMatchesCurrentCallup ? (meta['horario citacion'] || meta['horario citación'] || '') : '')
        : (meta['horario citacion'] || meta['horario citación'] || ''),
      matchTime: nextAmhMatch
        ? (fixtureMatchesCurrentCallup && (meta['horario partido'] || meta.partido)
          ? (meta['horario partido'] || meta.partido)
          : (nextAmhMatch.matchTime || ''))
        : (meta['horario partido'] || meta.partido || '')
    });
    setCallupError('');
    setEditingCallup(true);
  }

  async function submitCallup(event) {
    event.preventDefault();
    setCallupError('');
    try {
      if (!authenticated) throw new Error('Ingresá con la contraseña del cuerpo técnico para elegir y guardar las citadas.');
      const sessionToken = token;
      const players = callupDraft.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          action: 'save-callup', category, teamName: category,
          matchKey: `${category}-${(callupMetaDraft.round || 'actual').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          ...callupMetaDraft, players
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la citación.');
      await loadSheets();
      await loadStaffData(sessionToken);
      setEditingCallup(false);
    } catch (error) { setCallupError(error.message); }
  }

  function toggleCallupPlayer(name, selected) {
    setCallupDraft(current => {
      const selection = new Set(current.split(/\r?\n/).map(item => item.trim()).filter(Boolean));
      if (selected) selection.add(name);
      else selection.delete(name);
      return [...selection].join('\n');
    });
  }

  async function submitPhysicalAssessment(event) {
    event.preventDefault();
    setPhysicalSaveError('');
    const results = Object.entries(physicalDraft.values)
      .map(([key, value]) => {
        const [testKey, attempt] = key.split(':');
        const test = physicalTests.find(item => item.key === testKey);
        return { testKey, attempt: Number(attempt), rawValue: value, value: Number(value), unit: test?.unit || '' };
      }).filter(item => item.rawValue !== '' && Number.isFinite(item.value));
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'save-physical-assessment', ...physicalDraft, results })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la evaluación.');
      await loadStaffData(token);
      setEditingPhysical(false);
      setPhysicalDraft({ name: '', category: 'primera', evaluatedOn: '', values: {} });
    } catch (error) { setPhysicalSaveError(error.message); }
  }

  async function submitPhysicalTestDefinition(event) {
    event.preventDefault();
    setTestCatalogError('');
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'save-physical-test', ...testDraft })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo agregar la prueba.');
      await loadPhysical();
      setTestDraft({ name: '', category: 'fuerza', unit: '', direction: 'neutral', decimals: 2, maxAttempts: 3 });
    } catch (error) { setTestCatalogError(error.message); }
  }

  async function deactivatePhysicalTest(testKey) {
    setTestCatalogError('');
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'deactivate-physical-test', testKey })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo desactivar la prueba.');
      await loadPhysical();
    } catch (error) { setTestCatalogError(error.message); }
  }

  async function reactivatePhysicalTest(testKey) {
    setTestCatalogError('');
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reactivate-physical-test', testKey })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo reactivar la prueba.');
      await loadPhysical();
    } catch (error) { setTestCatalogError(error.message); }
  }

  async function submitPlayer(event) {
    event.preventDefault();
    setPlayerError('');
    try {
      const sessionToken = token;
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'save-player', ...playerDraft })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo agregar la jugadora.');
      await loadStaffData(sessionToken);
      setPlayerDraft({ name: '', category: playerDraft.category });
    } catch (error) { setPlayerError(error.message); }
  }

  function beginPlayerEdit(player) {
    setEditingPlayerId(player.id);
    setPlayerEditDraft({ name: player.name, categories: [...(player.categories || [])] });
    setPlayerEditError('');
  }

  async function submitPlayerEdit(event) {
    event.preventDefault();
    setPlayerEditError('');
    try {
      const sessionToken = token;
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'update-player', id: editingPlayerId, ...playerEditDraft })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo editar la jugadora.');
      await loadStaffData(sessionToken);
      setEditingPlayerId(null);
    } catch (error) { setPlayerEditError(error.message); }
  }

  // Verificar sesión persistida de cuerpo técnico y fixture
  useEffect(() => {
    loadMatches(category === 'intermedia' ? '2' : '1');
    try {
      localStorage.removeItem(authKey);
      const savedToken = sessionStorage.getItem(authKey);
      if (savedToken) {
        fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, { headers: { Authorization: `Bearer ${savedToken}` } })
          .then(res => res.json())
          .then(payload => {
            if (payload.valid) {
              loadStaffData(savedToken).then(() => {
                setToken(savedToken);
                setAuthenticated(true);
              }).catch(() => sessionStorage.removeItem(authKey));
            } else {
              sessionStorage.removeItem(authKey);
            }
          })
          .catch(() => sessionStorage.removeItem(authKey));
      }
    } catch (_) {}
  }, [club.slug, category]);

  async function loadSheets() {
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}&dataset=citations`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las citaciones.');
      setData(payload.citations || { primera: null, intermedia: null });
      setStatus(`Datos actualizados · ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function loadPhysical() {
    setStatus('Cargando evaluaciones físicas...');
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}&dataset=physical`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Evaluaciones físicas: HTTP ${response.status}`);
      setPhysicalPlayers(payload.physicalPlayers || []);
      setPhysicalTests(hydratePhysicalTests(payload.physicalTests));
      setStatus(`Datos actualizados · ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadSheets();
  }, [club.slug]);

  const storedCallup = data[category] || { players: [], meta: {} };
  const storedMeta = storedCallup.meta || {};
  const storedCallupMatchesFixture = callupMatchesFixture(storedMeta, nextAmhMatch);
  const staleCallup = matchesLoaded
    ? (nextAmhMatch ? !storedCallupMatchesFixture : isCallupExpired(storedMeta))
    : (isCallupExpired(storedMeta) && !(nextAmhMatch && storedCallupMatchesFixture));
  const current = staleCallup ? { players: [], meta: {}, matchKey: '' } : storedCallup;
  const sortedActivePlayers = [...players]
    .filter(player => player.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const sortedCalledUpPlayers = [...(current.players || [])]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const meta = current.meta;
  const callupMatchesNextFixture = callupMatchesFixture(meta, nextAmhMatch);
  const displayedCallTime = nextAmhMatch
    ? (callupMatchesNextFixture ? (meta['horario citacion'] || meta['horario citación'] || '') : '')
    : (meta['horario citacion'] || meta['horario citación'] || '');
  const displayedVenue = nextAmhMatch
    ? (callupMatchesNextFixture ? (meta.cancha || '') : '')
    : (meta.cancha || '');
  const displayedMatchTime = nextAmhMatch
    ? (callupMatchesNextFixture && (meta['horario partido'] || meta.partido)
      ? (meta['horario partido'] || meta.partido)
      : (nextAmhMatch.matchTime || ''))
    : (meta['horario partido'] || meta.partido || '');
  const visiblePlayers = physicalPlayers.filter(player => {
    const matchesCategory = physicalFilter === 'all' || player.filterTag === physicalFilter;
    const query = physicalSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return matchesCategory && (!query || player.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(query));
  });

  const averages = physicalTests.filter(test => test.active !== false || visiblePlayers.some(player => player.tests[test.key])) .map(test => {
    const values = visiblePlayers.map(player => player.tests[test.key]?.evals.at(-1)?.value).filter(value => value !== undefined);
    const rounds = Array.from({ length: test.maxAttempts }, (_, index) => index + 1).map(round => {
      const roundValues = visiblePlayers.map(player => player.tests[test.key]?.evals.find(item => item.round === round)?.value).filter(value => value !== undefined);
      return roundValues.length ? Number((roundValues.reduce((sum, value) => sum + value, 0) / roundValues.length).toFixed(test.decimals)) : null;
    });
    return { ...test, latest: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(test.decimals)) : null, rounds };
  });

  const selected = physicalPlayers.find(player => player.id === selectedPlayer);
  const physicalPlayersWithResults = visiblePlayers.filter(player => Object.keys(player.tests || {}).length > 0).length;
  const latestResult = [...matches].reverse().find(match => match.played) || null;
  const workspaceSections = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'citaciones', label: 'Citaciones' },
    { id: 'preparacion', label: 'Plan partido' },
    { id: 'torneo', label: 'Torneos' },
    { id: 'fisico', label: 'Evaluaciones físicas' },
    { id: 'seguimiento', label: 'Seguimiento' },
    ...(authenticated ? [
      { id: 'jugadoras', label: 'Plantel' },
      { id: 'dt', label: 'Botonera DT' },
      { id: 'stats', label: 'Estadísticas' },
      { id: 'respaldo', label: 'Respaldo' }
    ] : [])
  ];
  const selectWorkspaceSection = id => {
    setView(id);
    setMobileMenuOpen(false);
    if (id === 'fisico') loadPhysical();
    if (id === 'seguimiento' && authenticated) loadStaffData(token);
    if (id === 'stats' && authenticated) loadStaffData(token).catch(error => setStatus(error.message));
    if (id === 'dt') {
      setMatches([]);
      loadMatches('1');
    }
  };

  return (
    <main className="portal" style={{ '--club-accent': club.theme?.accent || '#00a2ff', '--club-primary': club.theme?.primary || '#1e88e5' }}>
      <section className="workspace">
        {showAdminBack && <button className="secondary back-button" onClick={() => { logoutStaff(); onBack(); }}>← Volver a administración</button>}
        <header className="workspace-header">
          <img src={club.logoUrl || '/escudo-regatas-andino.png'} alt="" />
          <div>
            <span className="kicker">{club.shortName}</span>
            <h1>{club.teamName}</h1>
            <p>{club.sport} · Temporada {club.season?.name || new Date().getFullYear()}{club.tournament?.name ? ` · ${club.tournament.name}` : ''}</p>
          </div>
          <div className="workspace-header-actions">
            {authenticated ? (
              <button type="button" className="secondary staff-access-header" onClick={logoutStaff}>Salir del cuerpo técnico</button>
            ) : (
              <button type="button" className="secondary staff-access-header" onClick={() => { setStaffLoginError(''); setShowStaffLogin(true); }}>
                Acceso cuerpo técnico
              </button>
            )}
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

        <button
          type="button"
          className="mobile-menu-trigger secondary"
          aria-expanded={mobileMenuOpen}
          aria-controls="workspace-mobile-menu"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span aria-hidden="true">☰</span> Menú <small>{workspaceSections.find(section => section.id === view)?.label}</small>
        </button>
        <nav className="workspace-nav" aria-label="Secciones del club">
          <button className={view === 'inicio' ? 'active' : ''} onClick={() => selectWorkspaceSection('inicio')}>Inicio</button>
          <button className={view === 'citaciones' ? 'active' : ''} onClick={() => selectWorkspaceSection('citaciones')}>Citaciones</button>
          <button className={view === 'preparacion' ? 'active' : ''} onClick={() => selectWorkspaceSection('preparacion')}>Plan partido</button>
          <button className={view === 'torneo' ? 'active' : ''} onClick={() => selectWorkspaceSection('torneo')}>Torneos</button>
          <button className={view === 'fisico' ? 'active' : ''} onClick={() => selectWorkspaceSection('fisico')}>Evaluaciones físicas</button>
          <button className={view === 'seguimiento' ? 'active' : ''} onClick={() => selectWorkspaceSection('seguimiento')}>Seguimiento</button>
          {authenticated && <>
            <span className="workspace-nav-divider" aria-hidden="true" />
            <button className={view === 'jugadoras' ? 'active' : ''} onClick={() => selectWorkspaceSection('jugadoras')}>Plantel</button>
            <button className={view === 'dt' ? 'active' : ''} onClick={() => selectWorkspaceSection('dt')}>Botonera DT</button>
            <button className={view === 'stats' ? 'active' : ''} onClick={() => selectWorkspaceSection('stats')}>Estadísticas</button>
            <button className={view === 'respaldo' ? 'active' : ''} onClick={() => selectWorkspaceSection('respaldo')}>Respaldo</button>
          </>}
        </nav>
        {mobileMenuOpen && (
          <div className="mobile-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
            <nav id="workspace-mobile-menu" className="mobile-menu-drawer" aria-label="Menú del club">
              <div className="mobile-menu-heading">
                <div><span className="kicker">{club.shortName}</span><h2>Secciones</h2></div>
                <button type="button" className="secondary mobile-menu-close" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)}>×</button>
              </div>
              {workspaceSections.map(section => (
                <button
                  type="button"
                  key={section.id}
                  className={`mobile-menu-item${view === section.id ? ' active' : ''}`}
                  aria-current={view === section.id ? 'page' : undefined}
                  onClick={() => selectWorkspaceSection(section.id)}
                >
                  {section.label}<span aria-hidden="true">→</span>
                </button>
              ))}
              <div className="mobile-menu-footer">
                {authenticated ? (
                  <button type="button" className="mobile-staff-access" onClick={() => { setMobileMenuOpen(false); logoutStaff(); }}>
                    Salir del cuerpo técnico
                  </button>
                ) : (
                  <button type="button" className="mobile-staff-access" onClick={() => { setMobileMenuOpen(false); setStaffLoginError(''); setShowStaffLogin(true); }}>
                    Acceso cuerpo técnico
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}

        {['inicio', 'citaciones'].includes(view) && (
          <div className="category-tabs">
            <button className={category === 'primera' ? 'active' : ''} onClick={() => setCategory('primera')}>1ra División</button>
            <button className={category === 'intermedia' ? 'active' : ''} onClick={() => setCategory('intermedia')}>Intermedia</button>
          </div>
        )}

        {['inicio', 'citaciones', 'fisico'].includes(view) && (
          <div className="sync-status">
            <span className="sync-status-message">{status}</span>
            <button className="refresh" onClick={() => {
              if (view === 'fisico') loadPhysical();
              else {
                loadSheets();
                if (view === 'inicio') loadMatches();
              }
            }} aria-label="Actualizar datos"><span aria-hidden="true">↻</span><span>Actualizar</span></button>
          </div>
        )}

        {view === 'inicio' ? (
          <section className="club-home">
            <header className="club-home-heading">
              <div><span className="kicker">PANEL DEL CLUB</span><h2>Hola, {club.shortName || club.name}</h2><p>Resumen de {category === 'primera' ? '1ra División' : 'Intermedia'}</p></div>
            </header>
            <section className="home-next-match">
              <div className="home-match-content">
                <span className="home-match-label"><CalendarClock aria-hidden="true" />{nextAmhMatch?.round || meta['fecha n°'] || meta['fecha'] || 'PRÓXIMO PARTIDO'}</span>
                <div className="home-match-opponent">
                  <div className="home-match-title">
                    <div className="home-match-title-row">
                      <h2>vs {nextAmhMatch?.rival || meta.rival || 'Rival pendiente'}</h2>
                      <OpponentBadge key={nextAmhMatch?.rival || meta.rival || ''} name={nextAmhMatch?.rival || meta.rival || ''} />
                    </div>
                    <p>{nextAmhMatch?.fecha || meta.dia || meta['día'] || 'Fecha pendiente'}</p>
                  </div>
                </div>
                <div className="home-match-facts">
                  {displayedCallTime && <span><Megaphone aria-hidden="true" /> Citación: {displayedCallTime}</span>}
                  <span><Timer aria-hidden="true" /> {displayedMatchTime || 'Horario pendiente de confirmar'}</span>
                  <span><MapPin aria-hidden="true" /> {displayedVenue || (nextAmhMatch ? (nextAmhMatch.homeAway === 'Local' ? `${club.shortName || club.name} (Local)` : `${nextAmhMatch.rival} (Visitante)`) : 'Cancha pendiente')}</span>
                </div>
              </div>
              <button type="button" onClick={() => selectWorkspaceSection('citaciones')}>Ver citación <ChevronRight aria-hidden="true" /></button>
            </section>
            <div className="home-dashboard-grid">
              <button type="button" className="home-dashboard-card" onClick={() => selectWorkspaceSection('citaciones')}>
                <span className="home-card-icon" aria-hidden="true"><ClipboardList /></span>
                <span className="home-card-copy"><strong>Citaciones</strong><small>{current.players.length ? `${current.players.length} jugadoras citadas` : 'Todavía no hay jugadoras citadas'}</small>
                  {current.players.length > 0 && <small className="home-card-preview">{current.players.slice(0, 3).join(' · ')}{current.players.length > 3 ? ` · +${current.players.length - 3}` : ''}</small>}
                </span><ChevronRight className="home-card-chevron" aria-hidden="true" />
              </button>
              <button type="button" className="home-dashboard-card" onClick={() => selectWorkspaceSection('preparacion')}>
                <span className="home-card-icon" aria-hidden="true"><Goal /></span>
                <span className="home-card-copy"><strong>Plan partido</strong><small>Foco semanal, videos y jugadas del equipo</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
              </button>
              <button type="button" className="home-dashboard-card" onClick={() => selectWorkspaceSection('torneo')}>
                <span className="home-card-icon" aria-hidden="true"><Trophy /></span>
                <span className="home-card-copy"><strong>Torneos y resultados</strong><small>{latestResult ? `${latestResult.round}: ${latestResult.score} vs ${latestResult.rival}` : 'Fixture y tabla de posiciones'}</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
              </button>
              <button type="button" className="home-dashboard-card" onClick={() => selectWorkspaceSection('fisico')}>
                <span className="home-card-icon" aria-hidden="true"><Zap /></span>
                <span className="home-card-copy"><strong>Evaluaciones físicas</strong><small>Consultá las mediciones y su evolución</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
              </button>
              {authenticated && <button type="button" className="home-dashboard-card" onClick={() => selectWorkspaceSection('jugadoras')}>
                <span className="home-card-icon" aria-hidden="true"><UsersRound /></span>
                <span className="home-card-copy"><strong>Plantel</strong><small>{players.filter(player => player.active).length} jugadoras activas</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
              </button>}
            </div>
          </section>
        ) : view === 'dt' ? (
          <TrackerPanel
            club={club}
            calledUpPlayers={data.primera?.players || []}
            callupMatchKey={data.primera?.matchKey || ''}
            events={events}
            setEvents={setEvents}
            onPersistEvent={persistTrackerEvent}
            onDeleteEvent={removeTrackerEvent}
            matches={matches}
            nextMatch={nextAmhMatch}
            loadMatches={loadMatches}
            authenticated={authenticated}
            onOpenPrecarga={() => setShowPrecargaModal(true)}
            onAuthenticate={authenticateStaffWithToken}
          />
        ) : view === 'stats' ? (
          <EstadisticasPanel
            club={club}
            events={events}
            tournaments={tournamentStats.tournaments}
            activeTournamentKey={tournamentStats.activeKey}
            matches={matches}
            authenticated={authenticated}
            onAuthenticate={authenticateStaffWithToken}
          />
        ) : view === 'respaldo' && authenticated ? (
          <SeasonBackupPanel club={club} token={token} />
        ) : view === 'torneo' ? (
          <TournamentPanel club={club} />
        ) : view === 'preparacion' ? (
          <MatchPreparationPanel club={club} authenticated={authenticated} token={token} />
        ) : view === 'seguimiento' ? (
          <PlayerMonitoringPanel club={club} authenticated={authenticated} monitoring={monitoring} onRefresh={() => loadStaffData(token)} />
        ) : view === 'jugadoras' ? (
          <section className="physical-card">
            <div className="section-heading">
              <div><h2>Plantel de {club.shortName || club.name}</h2><p>Agregá jugadoras y asignales una categoría.</p></div>
              <span>{players.filter(player => player.active).length} activas</span>
            </div>
            <form className="player-editor" onSubmit={submitPlayer}>
              <label>Nombre y apellido<input value={playerDraft.name} onChange={event => setPlayerDraft(current => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
              <label>Categoría<select value={playerDraft.category} onChange={event => setPlayerDraft(current => ({ ...current, category: event.target.value }))}>
                <option value="primera">1ra División</option><option value="intermedia">Intermedia</option><option value="5ta">5ta División</option>
              </select></label>
              {playerError && <p className="message error">{playerError}</p>}
              <button type="submit">Agregar jugadora</button>
            </form>
            <div className="players-grid">
              {sortedActivePlayers.map(player => (
                <div className="player-pill" key={player.id}>
                  {editingPlayerId === player.id ? (
                    <form className="player-edit-form" onSubmit={submitPlayerEdit}>
                      <label>Nombre y apellido<input value={playerEditDraft.name} onChange={event => setPlayerEditDraft(current => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
                      <fieldset className="player-category-options">
                        <legend>Categorías</legend>
                        {[["primera", "1ra División"], ["intermedia", "Intermedia"], ["5ta", "5ta División"]].map(([value, label]) => (
                          <label key={value}><input type="checkbox" checked={playerEditDraft.categories.includes(value)} onChange={event => setPlayerEditDraft(current => ({ ...current, categories: event.target.checked ? [...current.categories, value] : current.categories.filter(item => item !== value) }))} />{label}</label>
                        ))}
                      </fieldset>
                      {playerEditError && <p className="message error">{playerEditError}</p>}
                      <div className="player-edit-actions"><button type="submit">Guardar cambios</button><button type="button" className="secondary" onClick={() => setEditingPlayerId(null)}>Cancelar</button></div>
                    </form>
                  ) : (
                    <>
                      <strong>{player.name}</strong>
                      <small>{(player.categories || []).map(item => item === 'primera' ? '1ra División' : item === 'intermedia' ? 'Intermedia' : item === '5ta' ? '5ta División' : item).join(' · ') || 'Sin categoría'}</small>
                      <button type="button" className="player-edit-trigger secondary" onClick={() => beginPlayerEdit(player)}>Editar</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {authenticated && players.filter(player => player.active).length === 0 && <p className="empty-state">Todavía no hay jugadoras cargadas en este club.</p>}
          </section>
        ) : view === 'fisico' ? (
          <section className="physical-card">
            <div className="section-heading">
              <h2>Evaluaciones físicas</h2>
              {authenticated && (
                <div className="physical-card-actions">
                  <button className="secondary" type="button" onClick={() => { setEditingTestCatalog(false); setEditingPhysical(value => !value); }}>
                    {editingPhysical ? 'Cerrar carga' : 'Cargar evaluación'}
                  </button>
                  <button className="secondary" type="button" onClick={() => { setEditingPhysical(false); setEditingTestCatalog(value => !value); setTestCatalogError(''); }}>
                    {editingTestCatalog ? 'Cerrar pruebas' : 'Configurar pruebas'}
                  </button>
                </div>
              )}
            </div>
            {editingTestCatalog && authenticated && (
              <section className="physical-editor physical-test-catalog-editor">
                <div>
                  <h3>Pruebas del club</h3>
                  <p>Las pruebas nuevas quedan disponibles para las próximas cargas. Al desactivar una, se conservan los resultados históricos.</p>
                </div>
                <div className="physical-test-catalog-list">
                  {physicalTests.filter(test => test.custom).map(test => (
                    <div key={test.key}>
                      <span><strong>{test.name}{test.active === false ? ' · Inactiva' : ''}</strong><small>{test.category} · {test.unit || 'sin unidad'} · {test.maxAttempts} intentos</small></span>
                      {test.active === false
                        ? <button type="button" className="secondary" onClick={() => reactivatePhysicalTest(test.key)}>Reactivar</button>
                        : <button type="button" className="secondary" onClick={() => deactivatePhysicalTest(test.key)}>Desactivar</button>}
                    </div>
                  ))}
                  {!physicalTests.some(test => test.custom) && <p className="empty-state">Todavía no agregaste pruebas personalizadas.</p>}
                </div>
                <form className="physical-test-definition-form" onSubmit={submitPhysicalTestDefinition}>
                  <h3>Agregar prueba</h3>
                  <div className="callup-meta-grid">
                    <label>Nombre<input value={testDraft.name} maxLength={80} onChange={event => setTestDraft(current => ({ ...current, name: event.target.value }))} required /></label>
                    <label>Área<select value={testDraft.category} onChange={event => setTestDraft(current => ({ ...current, category: event.target.value }))}>
                      <option value="fuerza">Fuerza</option><option value="potencia">Potencia</option><option value="velocidad">Velocidad</option><option value="resistencia">Resistencia</option><option value="agilidad">Agilidad</option><option value="movilidad">Movilidad</option><option value="técnica">Técnica</option><option value="personalizada">Otra</option>
                    </select></label>
                    <label>Unidad<input value={testDraft.unit} maxLength={16} placeholder="seg, cm, kg, repeticiones…" onChange={event => setTestDraft(current => ({ ...current, unit: event.target.value }))} /></label>
                    <label>Cantidad de intentos<select value={testDraft.maxAttempts} onChange={event => setTestDraft(current => ({ ...current, maxAttempts: Number(event.target.value) }))}>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count}</option>)}
                    </select></label>
                    <label>Decimales<select value={testDraft.decimals} onChange={event => setTestDraft(current => ({ ...current, decimals: Number(event.target.value) }))}>
                      {[0, 1, 2, 3].map(count => <option key={count} value={count}>{count}</option>)}
                    </select></label>
                    <label>Para el ranking, conviene<select value={testDraft.direction} onChange={event => setTestDraft(current => ({ ...current, direction: event.target.value }))}>
                      <option value="higher">Un resultado más alto</option><option value="lower">Un resultado más bajo</option><option value="neutral">No ordenar por resultado</option>
                    </select></label>
                  </div>
                  {testCatalogError && <p className="message error">{testCatalogError}</p>}
                  <button type="submit">Agregar prueba al club</button>
                </form>
              </section>
            )}
            {editingPhysical && (
              <form className="physical-editor" onSubmit={submitPhysicalAssessment}>
                <div className="callup-meta-grid">
                  <label>Jugadora<input value={physicalDraft.name} onChange={event => setPhysicalDraft(current => ({ ...current, name: event.target.value }))} required /></label>
                  <label>Categoría<select value={physicalDraft.category} onChange={event => setPhysicalDraft(current => ({ ...current, category: event.target.value }))}>
                    <option value="primera">1ra División</option><option value="intermedia">Intermedia</option><option value="5ta">5ta División</option>
                  </select></label>
                  <label>Fecha de evaluación<input type="date" value={physicalDraft.evaluatedOn} onChange={event => setPhysicalDraft(current => ({ ...current, evaluatedOn: event.target.value }))} /></label>
                </div>
                <div className="physical-entry-grid">
                  {physicalTests.filter(test => test.active !== false).map(test => (
                    <fieldset key={test.key}><legend>{test.name} ({test.unit || 'sin unidad'})</legend>
                      {Array.from({ length: test.maxAttempts }, (_, index) => index + 1).map(attempt => {
                        const key = `${test.key}:${attempt}`;
                        return <label key={key}>{attempt}° intento<input type="number" step="any" value={physicalDraft.values[key] || ''} onChange={event => setPhysicalDraft(current => ({ ...current, values: { ...current.values, [key]: event.target.value } }))} /></label>;
                      })}
                    </fieldset>
                  ))}
                </div>
                {physicalSaveError && <p className="message error">{physicalSaveError}</p>}
                <button type="submit">Guardar mediciones en la base</button>
              </form>
            )}
            <div className="physical-hero">
              <span className="kicker"><Activity aria-hidden="true" /> RENDIMIENTO ATLÉTICO</span>
              <p>Consultá marcas, intentos y promedios del plantel.</p>
            </div>
            <div className="physical-summary" aria-live="polite">
              <div><UsersRound aria-hidden="true" /><span><strong>{visiblePlayers.length}</strong><small>jugadoras</small></span></div>
              <div><Activity aria-hidden="true" /><span><strong>{physicalPlayersWithResults}</strong><small>con resultados</small></span></div>
            </div>
            <input
              className="physical-search"
              value={physicalSearch}
              onChange={event => setPhysicalSearch(event.target.value)}
              aria-label="Buscar jugadora por nombre o apellido"
              placeholder="Buscar jugadora por nombre o apellido..."
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
              {[
                ['players', UsersRound, 'Jugadoras'],
                ['averages', Activity, 'Promedios'],
                ['top10', Trophy, 'Top 10']
              ].map(([key, Icon, label]) => (
                <button
                  key={key}
                  className={physicalMode === key ? 'active' : ''}
                  onClick={() => setPhysicalMode(key)}
                >
                  <Icon aria-hidden="true" /> {label}
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
                        <div className="physical-profile-meta">
                          <span>{selected.filterTag === 'Inter' ? 'Intermedia' : selected.filterTag === '5ta' ? '5ta División' : '1ra División'}</span>
                          {selected.evaluatedOn && <span>Última evaluación · {new Date(`${selected.evaluatedOn}T00:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        </div>
                      </div>
                      <button className="secondary" onClick={() => setSelectedPlayer(null)}>Cambiar</button>
                    </div>
                    <div className="physical-profile-overview">
                      <strong>{Object.keys(selected.tests || {}).length} pruebas con datos</strong>
                      <span>Comparación de marcas por intento</span>
                    </div>
                    <div className="test-cards">
                      {physicalTests.filter(test => test.active !== false || selected.tests[test.key]).map(test => {
                        const result = selected.tests[test.key];
                        const latest = result?.evals.at(-1);
                        const TestIcon = test.icon || Activity;
                        return (
                          <article className="test-card" key={test.key}>
                            <div>
                              <span className="test-icon"><TestIcon /></span>
                              <strong>{test.name}</strong>
                              <small>{test.type}</small>
                            </div>
                            <b>{latest ? `${latest.value} ${test.unit}` : 'Sin registros'}</b>
                            {latest && <small className="test-result-caption">Último intento</small>}
                            <div className="test-rounds">
                              {Array.from({ length: test.maxAttempts }, (_, index) => index + 1).map(round => {
                                const attempt = result?.evals.find(item => item.round === round)?.value;
                                return (
                                  <span key={round}><small>Intento {round}</small><strong>{attempt ?? '—'}</strong></span>
                                );
                              })}
                            </div>
                            {result?.diff != null && (
                              <em className={result.improved ? 'positive' : 'negative'}>
                                {result.improved === null ? '' : result.improved ? '↗ ' : '↘ '}Diferencia entre intentos: {result.diff > 0 ? '+' : ''}{result.diff} {test.unit}
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
                {averages.map(test => {
                  const TestIcon = test.icon || Activity;
                  return (
                  <article className="average-card" key={test.key}>
                    <div className="average-heading">
                      <span className="test-icon"><TestIcon /></span>
                      <div>
                        <strong>{test.name}</strong>
                        <small>{test.type}</small>
                      </div>
                      <b>{test.latest === null ? '—' : `${test.latest} ${test.unit}`}</b>
                    </div>
                    <small className="average-caption">Promedio actual · {visiblePlayers.filter(player => player.tests[test.key]?.evals.at(-1)?.value !== undefined).length} jugadoras</small>
                    <div className="test-rounds">
                      {test.rounds.map((value, index) => (
                        <span key={index}>Intento {index + 1}: {value === null ? '—' : `${value} ${test.unit}`}</span>
                      ))}
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
            {physicalMode === 'top10' && (
              <div className="top10-grid-react">
                {physicalTests.filter(test => test.direction !== 'neutral' && (test.active !== false || visiblePlayers.some(player => player.tests[test.key]))).map(test => {
                  const TestIcon = test.icon || Activity;
                  const ranked = visiblePlayers
                    .map(player => ({ player, value: player.tests[test.key]?.evals.at(-1)?.value }))
                    .filter(item => item.value !== undefined)
                    .sort((a, b) => (test.higherIsBetter ? b.value - a.value : a.value - b.value))
                    .slice(0, 10);
                  return (
                    <article className="top10-card" key={test.key}>
                      <h3><TestIcon /> {test.name}</h3>
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
              <div className="home-match-title-row">
                <h2>vs {nextAmhMatch?.rival || meta.rival || 'Rival pendiente'}</h2>
                <OpponentBadge key={nextAmhMatch?.rival || meta.rival || ''} name={nextAmhMatch?.rival || meta.rival || ''} />
              </div>
              <div className="match-details">
                <span>📅 {nextAmhMatch?.fecha || meta.dia || meta['día'] || 'Fecha pendiente'}</span>
                {displayedCallTime && <span>📣 Citación: {displayedCallTime}</span>}
                <span>⏱️ {displayedMatchTime || 'Horario pendiente de confirmar'}</span>
                <span>📍 {displayedVenue || (nextAmhMatch ? (nextAmhMatch.homeAway === 'Local' ? `${club.shortName || club.name} (Local)` : `${nextAmhMatch.rival} (Visitante)`) : 'Cancha pendiente')}</span>
              </div>
            </section>
            <section className="players-section">
              <div className="section-heading">
                <h2>Jugadoras citadas <span>{current.players.length}</span></h2>
                <div className="callup-actions">
                  {authenticated && <button type="button" className="secondary" onClick={beginCallupEdit}>Editar citación</button>}
                </div>
              </div>
              {editingCallup && (
                <form className="callup-editor" onSubmit={submitCallup}>
                  {nextAmhMatch ? (
                    <div className="callup-fixture-summary">
                      <strong>Partido obtenido de AMH</strong>
                      <span>{callupMetaDraft.round} · vs {callupMetaDraft.opponent}</span>
                      <span>{callupMetaDraft.date || 'Fecha pendiente'} · {callupMetaDraft.homeAway}</span>
                    </div>
                  ) : (
                    <div className="callup-meta-grid">
                      <label>Fecha / ronda<input value={callupMetaDraft.round || ''} onChange={event => setCallupMetaDraft(current => ({ ...current, round: event.target.value }))} /></label>
                      <label>Rival<input value={callupMetaDraft.opponent || ''} onChange={event => setCallupMetaDraft(current => ({ ...current, opponent: event.target.value }))} /></label>
                      <label>Día<input value={callupMetaDraft.date || ''} onChange={event => setCallupMetaDraft(current => ({ ...current, date: event.target.value }))} /></label>
                      <label>Localía<select value={callupMetaDraft.homeAway || 'Local'} onChange={event => setCallupMetaDraft(current => ({ ...current, homeAway: event.target.value }))}><option>Local</option><option>Visitante</option></select></label>
                    </div>
                  )}
                  <div className="callup-meta-grid">
                    <label>Cancha<input value={callupMetaDraft.venue || ''} onChange={event => setCallupMetaDraft(current => ({ ...current, venue: event.target.value }))} /></label>
                    <label>Horario del partido<input value={callupMetaDraft.matchTime || ''} onChange={event => setCallupMetaDraft(current => ({ ...current, matchTime: event.target.value }))} placeholder="Ej.: 16:45" /></label>
                    <label>Horario de citación<input value={callupMetaDraft.callTime || ''} onChange={event => setCallupMetaDraft(current => ({ ...current, callTime: event.target.value }))} placeholder="Ej.: 14:30" /></label>
                  </div>
                  <div className="callup-selection">
                    <div className="callup-selection-heading">
                      <strong>Elegí las jugadoras citadas</strong>
                      <span>{callupDraft.split(/\r?\n/).filter(Boolean).length} seleccionadas</span>
                    </div>
                    {!authenticated ? <p className="empty-state">Ingresá para elegir entre las jugadoras registradas en este club.</p> : (
                      <div className="callup-player-list">
                        {sortedActivePlayers.map(player => (
                          <label className="callup-player-option" key={player.id}>
                            <input type="checkbox" checked={callupDraft.split(/\r?\n/).map(name => name.trim()).includes(player.name)} onChange={event => toggleCallupPlayer(player.name, event.target.checked)} />
                            <span>{player.name}<small className="callup-player-categories">{(player.categories || []).map(item => item === 'primera' ? '1ra' : item === 'intermedia' ? 'Intermedia' : item === '5ta' ? '5ta' : item).join(' · ') || 'Sin categoría de plantel'}</small></span>
                          </label>
                        ))}
                        {!players.some(player => player.active) && (
                          <p className="empty-state">Todavía no hay jugadoras cargadas en el plantel. <button type="button" className="inline-link" onClick={() => { setEditingCallup(false); setView('jugadoras'); }}>Agregar al plantel</button></p>
                        )}
                      </div>
                    )}
                  </div>
                  {callupError && <p className="message error">{callupError}</p>}
                  {authenticated && <button type="submit">Guardar citación en la base de datos</button>}
                  <button type="button" className="secondary" onClick={() => setEditingCallup(false)}>Cancelar</button>
                </form>
              )}
              {sortedCalledUpPlayers.length ? (
                <div className="players-grid">
                  {sortedCalledUpPlayers.map((player, index) => (
                    <div className="player-pill" key={`${player}-${index}`}>{player}</div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Todavía no hay jugadoras citadas para esta categoría.</p>
              )}
            </section>
          </>
        )}

      </section>

      {showStaffLogin && (
        <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowStaffLogin(false); }}>
          <form className="form-card staff-login-card" role="dialog" aria-modal="true" aria-labelledby="staffLoginTitle" onSubmit={submitStaffLogin}>
            <button type="button" className="close" aria-label="Cerrar" onClick={() => setShowStaffLogin(false)}>×</button>
            <span className="kicker">ACCESO PRIVADO</span>
            <h2 id="staffLoginTitle">Cuerpo técnico</h2>
            <p>Ingresá para administrar el plantel, las citaciones y las herramientas del equipo.</p>
            <label>Contraseña del cuerpo técnico
              <input type="password" value={staffLoginPassword} onChange={event => setStaffLoginPassword(event.target.value)} autoComplete="current-password" required autoFocus />
            </label>
            {staffLoginError && <p className="message error" role="alert">{staffLoginError}</p>}
            <button type="submit">Ingresar</button>
          </form>
        </div>
      )}

      {/* Modal de Precarga AMH */}
      {showPrecargaModal && (
        <PrecargaModal
          club={club}
          citedPlayers={data}
          authenticated={authenticated}
          token={token}
          onAuthenticate={authenticateStaffWithToken}
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
  const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';
  const requestedSlug = !isAdminRoute ? new URLSearchParams(window.location.search).get('club') : null;
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
  const [workspaceAdminOrigin, setWorkspaceAdminOrigin] = useState(false);

  useEffect(() => {
    const favicon = document.querySelector('link[rel~="icon"]');
    if (!favicon) return;
    favicon.href = workspaceClub?.logoUrl || '/escudo-regatas-andino.png';
    favicon.type = workspaceClub?.logoUrl?.startsWith('data:image/')
      ? workspaceClub.logoUrl.slice(5, workspaceClub.logoUrl.indexOf(';'))
      : '';
  }, [workspaceClub]);

  async function loadClubs() {
    setLoading(true);
    try {
      if (isAdminRoute) {
        if (!adminToken) {
          setClubs([]);
          return;
        }
        const data = await api('/api/admin/clubs', { headers: { Authorization: `Bearer ${adminToken}` } });
        setClubs(data.clubs || []);
        return;
      }

      setClubs([]);
      if (!requestedSlug) {
        setWorkspaceClub(null);
        return;
      }
      const data = await api(`/api/config?club=${encodeURIComponent(requestedSlug)}`);
      setWorkspaceClub(data.club || null);
    } catch (error) {
      setWorkspaceClub(null);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClubs();
  }, []);

  useEffect(() => {
    if (!isAdminRoute || !adminToken) return;
    api('/api/admin/clubs', { headers: { Authorization: `Bearer ${adminToken}` } })
      .then(data => setClubs(data.clubs || []))
      .catch(() => {
        sessionStorage.removeItem('club_admin_token');
        setAdminToken('');
        setMessage('La sesión de administración venció. Ingresá nuevamente.');
      });
  }, []);

  function openCreate() {
    setSelected(null);
    setForm(emptyClub);
    setShowForm(true);
    setMessage('');
  }

  function openWorkspace(club) {
    setWorkspaceAdminOrigin(isAdminRoute && Boolean(adminToken));
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
      tournamentAmhTeamName: club.tournament?.amhTeamName || '',
      tournamentDivision: club.tournament?.division || '1',
      seasonName: club.season?.name || String(new Date().getFullYear())
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
      if (form.tournamentClubId) {
        const selectedTeam = data.teams.find(item => item.value === form.tournamentClubId);
        if (selectedTeam) setForm(current => ({ ...current, tournamentAmhTeamName: selectedTeam.label }));
      }
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
      ...(name === 'tournamentClubSelect' ? {
        tournamentClubId: value,
        tournamentAmhTeamName: amhCatalog?.teams.find(item => item.value === value)?.label || ''
      } : {})
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
      const adminData = await api('/api/admin/clubs', { headers: { Authorization: `Bearer ${data.token}` } });
      setClubs(adminData.clubs || []);
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
    const hasStaffPassword = Boolean(form.staffPassword.trim());
    const hasStaffSecret = Boolean(form.staffSecret.trim());
    if (hasStaffPassword !== hasStaffSecret) {
      setMessage('Para cambiar el acceso del cuerpo técnico, completá la contraseña y el secreto. Dejá ambos vacíos para conservar los actuales.');
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
        tournament: {
          name: form.tournamentName,
          baseUrl: form.tournamentBaseUrl,
          tournamentId: form.tournamentId,
          clubId: form.tournamentClubId,
          amhTeamName: form.tournamentAmhTeamName,
          division: form.tournamentDivision || '1'
        },
        season: { name: form.seasonName },
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

  if (!isAdminRoute && requestedSlug && loading && !workspaceClub) {
    return (
      <main className="club-bootstrap" role="status" aria-live="polite">
        <span>Abriendo el club...</span>
      </main>
    );
  }

  if (workspaceClub) {
    return (
      <ClubWorkspace
        club={workspaceClub}
        showAdminBack={workspaceAdminOrigin}
        onBack={() => {
          setWorkspaceClub(null);
          setWorkspaceAdminOrigin(false);
          window.history.pushState({}, '', '/admin');
        }}
      />
    );
  }

  return (
    <main className="portal">
      <section className="shell">
        {isAdminRoute ? (
          <>
            <a className="admin-back-link" href="/">← Volver al portal</a>
            <span className="kicker">ÁREA PRIVADA</span>
            <h1>Administración</h1>
            <p className="intro">Gestión de clubes. El acceso requiere credenciales de administrador.</p>
          </>
        ) : (
          <>
            <span className="kicker">SPORTS CLUBS PLATFORM</span>
            <h1>Ingresá a tu club</h1>
            <p className="intro">Abrí el enlace que te compartió el cuerpo técnico de tu club.</p>
          </>
        )}
        {message && <div className="message">{message}</div>}
        {isAdminRoute && (
          <div className="toolbar">
            {!adminToken ? (
              <form className="admin-login" onSubmit={loginAdmin}>
                <input
                  type="password"
                  placeholder="Contraseña de administrador"
                  value={adminPassword}
                  onChange={event => setAdminPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button>Ingresar</button>
              </form>
            ) : (
              <>
                <button onClick={openCreate}>+ Agregar club</button>
                <button
                  className="secondary"
                  onClick={() => {
                    sessionStorage.removeItem('club_admin_token');
                    setAdminToken('');
                  }}
                >
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        )}
        {isAdminRoute && loading ? (
          <p>Cargando clubes...</p>
        ) : (isAdminRoute && adminToken) && (
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
                {isAdminRoute && adminToken && (
                  <button className="edit" onClick={() => openEdit(club)}>
                    Editar perfil
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {isAdminRoute && adminToken && showForm && (
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
                  type={name.toLowerCase().includes('url') ? 'url' : 'text'}
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
            <label>
              Temporada activa
              <input
                name="seasonName"
                value={form.seasonName}
                onChange={updateField}
                maxLength={60}
                placeholder="2027"
                required
              />
              <small>Citaciones, botonera, estadísticas, evaluaciones y seguimiento se guardan por temporada. Al iniciar otra, cambiá este nombre y seleccioná su torneo AMH.</small>
            </label>
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
            <p className="auth-settings-help">
              {selected
                ? 'Para cambiar el acceso, completá ambos campos. Si los dejás vacíos, se conserva la configuración actual. El secreto debe tener al menos 32 caracteres.'
                : 'Configurá la contraseña de acceso y un secreto privado de al menos 32 caracteres para firmar las sesiones.'}
            </p>
            <label>
              Contraseña cuerpo técnico
              <input
                name="staffPassword"
                type="password"
                value={form.staffPassword}
                onChange={updateField}
                autoComplete="new-password"
                required={!selected || Boolean(form.staffSecret)}
              />
            </label>
            <label>
              Secreto del club
              <input
                name="staffSecret"
                type="password"
                value={form.staffSecret}
                onChange={updateField}
                autoComplete="new-password"
                minLength={32}
                required={!selected || Boolean(form.staffPassword)}
              />
            </label>
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
