import { Fragment, useEffect, useRef, useState } from 'react';
import { Activity, CalendarClock, ChevronRight, ClipboardList, Ellipsis, Goal, MapPin, Megaphone, Timer, Trophy, UsersRound, Zap } from 'lucide-react';
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
  tournamentName: '',
  tournamentBaseUrl: '',
  tournamentId: '',
  tournamentClubId: '',
  tournamentAmhTeamName: '',
  tournamentDivision: '1',
  seasonName: String(new Date().getFullYear())
};

const PHYSICAL_TESTS = [];

function hydratePhysicalTests(tests) {
  return (tests || []).map(test => ({
    ...test,
    type: test.type || test.category || 'Personalizada',
    icon: Activity,
    decimals: Number(test.decimals ?? 2)
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
  const [physicalDraft, setPhysicalDraft] = useState({ playerId: '', category: 'primera', evaluatedOn: '', testKey: '', value: '' });
  const [physicalSaveError, setPhysicalSaveError] = useState('');
  const [physicalSaveSuccess, setPhysicalSaveSuccess] = useState('');
  const [physicalTests, setPhysicalTests] = useState(PHYSICAL_TESTS);
  const [editingTestCatalog, setEditingTestCatalog] = useState(false);
  const [testDraft, setTestDraft] = useState({ name: '', category: 'fuerza', unit: '', direction: 'neutral', decimals: 2 });
  const [testCatalogError, setTestCatalogError] = useState('');
  const [status, setStatus] = useState('Cargando información del club...');
  const [citationLoadState, setCitationLoadState] = useState({ loading: true, error: '' });
  const [matchLoadState, setMatchLoadState] = useState({ loading: true, error: '' });
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
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [token, setToken] = useState('');
  const staffInviteToken = new URLSearchParams(window.location.search).get('staffInvite') || '';
  const [showStaffLogin, setShowStaffLogin] = useState(Boolean(staffInviteToken));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [managementMenuOpen, setManagementMenuOpen] = useState(false);
  const [staffLoginError, setStaffLoginError] = useState('');

  // Cargar fixture para Botonera y Estadísticas
  async function loadMatches(div = (category === 'intermedia' ? '2' : '1')) {
    setMatchesLoaded(false);
    setMatchLoadState({ loading: true, error: '' });
    try {
      const response = await fetch(`/api/torneo/matches?club=${encodeURIComponent(club.slug)}&division=${div}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el fixture.');
      setMatches(payload.matches || payload.pendingMatches || []);
      setNextAmhMatch(payload.nextMatch || (payload.pendingMatches && payload.pendingMatches[0]) || null);
      setMatchLoadState({ loading: false, error: '' });
    } catch (error) {
      setMatches([]);
      setNextAmhMatch(null);
      setMatchLoadState({ loading: false, error: error.message || 'No se pudo cargar el fixture de AMH.' });
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
    setCanManageAccess(Boolean(payload.canManageAccess));
    if (payload.citations) setData(payload.citations);
  }

  async function authenticateStaffGoogle(credential) {
    const response = await fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleCredential: credential, invite: staffInviteToken })
    });
    const payload = await response.json();
    if (!response.ok || !payload.token) throw new Error(payload.error || 'No se pudo validar la cuenta de Google.');
    await loadStaffData(payload.token);
    setToken(payload.token);
    setAuthenticated(true);
    sessionStorage.setItem(authKey, payload.token);
    if (staffInviteToken) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('staffInvite');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
    setShowStaffLogin(false);
    setView('inicio');
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

  function logoutStaff() {
    sessionStorage.removeItem(authKey);
    localStorage.removeItem(authKey);
    setToken('');
    setAuthenticated(false);
    setCanManageAccess(false);
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
      if (!authenticated) throw new Error('Ingresá con tu cuenta Google invitada para elegir y guardar las citadas.');
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
    setPhysicalSaveSuccess('');
    const selectedTest = physicalTests.find(item => item.key === physicalDraft.testKey && item.active !== false);
    const resultValue = Number(physicalDraft.value);
    if (!selectedTest || !physicalDraft.playerId || !physicalDraft.evaluatedOn || physicalDraft.value === '' || !Number.isFinite(resultValue)) {
      setPhysicalSaveError('Elegí la fecha, la prueba y la jugadora, y cargá un resultado.');
      return;
    }
    const results = [{ testKey: selectedTest.key, attempt: 1, rawValue: physicalDraft.value, value: resultValue, unit: selectedTest.unit || '' }];
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'save-physical-assessment',
          ...physicalDraft,
          name: physicalAssessmentPlayers.find(player => String(player.id) === String(physicalDraft.playerId))?.name || '',
          results
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la evaluación.');
      await loadStaffData(token);
      setPhysicalDraft(current => ({ ...current, playerId: '', value: '' }));
      setPhysicalSaveSuccess('Resultado guardado. Ya podés seleccionar a la siguiente jugadora.');
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
      setTestDraft({ name: '', category: 'fuerza', unit: '', direction: 'neutral', decimals: 2 });
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

  async function deletePhysicalTest(testKey) {
    setTestCatalogError('');
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'delete-physical-test', testKey })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar la prueba.');
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
    setCitationLoadState({ loading: true, error: '' });
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}&dataset=citations`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las citaciones.');
      setData(payload.citations || { primera: null, intermedia: null });
      setStatus(`Datos actualizados · ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`);
      setCitationLoadState({ loading: false, error: '' });
    } catch (error) {
      setStatus(error.message);
      setCitationLoadState({ loading: false, error: error.message || 'No se pudieron cargar las citaciones.' });
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
    const maxRecordedRounds = Math.max(0, ...visiblePlayers.map(player => player.tests[test.key]?.evals.length || 0));
    const rounds = Array.from({ length: maxRecordedRounds }, (_, index) => index + 1).map(round => {
      const roundValues = visiblePlayers.map(player => player.tests[test.key]?.evals[round - 1]?.value).filter(value => value !== undefined);
      return roundValues.length ? Number((roundValues.reduce((sum, value) => sum + value, 0) / roundValues.length).toFixed(test.decimals)) : null;
    });
    return { ...test, latest: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(test.decimals)) : null, rounds };
  });

  const selected = physicalPlayers.find(player => player.id === selectedPlayer);
  const physicalAssessmentPlayers = players
    .filter(player => player.active && (player.categories || []).includes(physicalDraft.category))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const selectedPhysicalTest = physicalTests.find(test => test.key === physicalDraft.testKey && test.active !== false);
  const physicalTestEntries = physicalPlayers
    .map(player => ({
      ...player,
      result: player.tests[physicalDraft.testKey]?.evals.find(evaluation => String(evaluation.evaluatedOn || '').slice(0, 10) === physicalDraft.evaluatedOn)
    }))
    .filter(player => player.result)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
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
      { id: 'respaldo', label: 'Respaldo' },
      ...(canManageAccess ? [{ id: 'accesos', label: 'Accesos del cuerpo técnico' }] : [])
    ] : [])
  ];
  const workspaceGroups = [
    { id: 'planificacion', label: 'Planificación', sectionIds: ['citaciones', 'fisico', 'seguimiento'] },
    { id: 'partido', label: 'Partido', sectionIds: ['preparacion', 'dt', 'stats'] },
    { id: 'administracion', label: 'Administración', sectionIds: ['jugadoras', 'accesos', 'respaldo'] }
  ].map(group => ({
    ...group,
    sections: group.sectionIds.map(id => workspaceSections.find(section => section.id === id)).filter(Boolean)
  })).filter(group => group.sections.length > 0);
  const activeWorkspaceGroup = workspaceGroups.find(group => group.sections.some(section => section.id === view));
  const playerWorkspaceSections = ['inicio', 'citaciones', 'preparacion', 'torneo', 'seguimiento', 'fisico']
    .map(id => workspaceSections.find(section => section.id === id)).filter(Boolean);
  const selectWorkspaceSection = id => {
    setView(id);
    setMobileMenuOpen(false);
    setManagementMenuOpen(false);
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
          {!authenticated ? playerWorkspaceSections.map(section => (
            <button key={section.id} className={view === section.id ? 'active' : ''} onClick={() => selectWorkspaceSection(section.id)}>{section.label}</button>
          )) : <>
          <button className={view === 'inicio' ? 'active' : ''} onClick={() => selectWorkspaceSection('inicio')}>Inicio</button>
          {workspaceGroups.filter(group => group.id !== 'administracion').map(group => (
            <button
              type="button"
              key={group.id}
              className={`workspace-nav-more${activeWorkspaceGroup?.id === group.id ? ' active' : ''}`}
              aria-expanded={managementMenuOpen === group.id}
              onClick={() => setManagementMenuOpen(open => open === group.id ? false : group.id)}
            >{group.label} <span aria-hidden="true">{managementMenuOpen === group.id ? '−' : '+'}</span></button>
          ))}
          <button className={view === 'torneo' ? 'active' : ''} onClick={() => selectWorkspaceSection('torneo')}>Torneos</button>
          {authenticated && workspaceGroups.find(group => group.id === 'administracion') && (
            <button
              type="button"
              className={`workspace-nav-more${activeWorkspaceGroup?.id === 'administracion' ? ' active' : ''}`}
              aria-expanded={managementMenuOpen === 'administracion'}
              onClick={() => setManagementMenuOpen(open => open === 'administracion' ? false : 'administracion')}
            >Administración <span aria-hidden="true">{managementMenuOpen === 'administracion' ? '−' : '+'}</span></button>
          )}
          </>}
        </nav>
        {managementMenuOpen && workspaceGroups.find(group => group.id === managementMenuOpen) && (
          <nav className="workspace-nav-secondary" aria-label={workspaceGroups.find(group => group.id === managementMenuOpen).label}>
            {workspaceGroups.find(group => group.id === managementMenuOpen).sections.map(section => (
              <button key={section.id} className={view === section.id ? 'active' : ''} onClick={() => selectWorkspaceSection(section.id)}>{section.label}</button>
            ))}
          </nav>
        )}
        {mobileMenuOpen && (
          <div className="mobile-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
            <nav id="workspace-mobile-menu" className="mobile-menu-drawer" aria-label="Menú del club">
              <div className="mobile-menu-heading">
                <div><span className="kicker">{club.shortName}</span><h2>Secciones</h2></div>
                <button type="button" className="secondary mobile-menu-close" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)}>×</button>
              </div>
              {!authenticated ? playerWorkspaceSections.map(section => (
                <button
                  type="button"
                  key={section.id}
                  className={`mobile-menu-item${view === section.id ? ' active' : ''}`}
                  aria-current={view === section.id ? 'page' : undefined}
                  onClick={() => selectWorkspaceSection(section.id)}
                >{section.label}<span aria-hidden="true">→</span></button>
              )) : <>
              <p className="mobile-menu-group-label">GENERAL</p>
              <button type="button" className={`mobile-menu-item${view === 'inicio' ? ' active' : ''}`} aria-current={view === 'inicio' ? 'page' : undefined} onClick={() => selectWorkspaceSection('inicio')}>Inicio<span aria-hidden="true">→</span></button>
              {workspaceGroups.filter(group => group.id !== 'administracion').map(group => (
                <Fragment key={group.id}>
                  <p className="mobile-menu-group-label">{group.label.toLocaleUpperCase('es-AR')}</p>
                  {group.sections.map(section => (
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
                </Fragment>
              ))}
              <p className="mobile-menu-group-label">COMPETENCIA</p>
              <button type="button" className={`mobile-menu-item${view === 'torneo' ? ' active' : ''}`} aria-current={view === 'torneo' ? 'page' : undefined} onClick={() => selectWorkspaceSection('torneo')}>Torneos<span aria-hidden="true">→</span></button>
              {workspaceGroups.filter(group => group.id === 'administracion').map(group => (
                <Fragment key={group.id}>
                  <p className="mobile-menu-group-label">{group.label.toLocaleUpperCase('es-AR')}</p>
                  {group.sections.map(section => (
                    <button
                      type="button"
                      key={section.id}
                      className={`mobile-menu-item${view === section.id ? ' active' : ''}`}
                      aria-current={view === section.id ? 'page' : undefined}
                      onClick={() => selectWorkspaceSection(section.id)}
                    >{section.label}<span aria-hidden="true">→</span></button>
                  ))}
                </Fragment>
              ))}
              </>}
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
          <div className={`sync-status${['inicio', 'citaciones'].includes(view) && citationLoadState.error ? ' is-error' : ''}`}>
            <span className="sync-status-message" role={['inicio', 'citaciones'].includes(view) && citationLoadState.error ? 'alert' : 'status'}>
              {['inicio', 'citaciones'].includes(view)
                ? citationLoadState.loading ? 'Cargando citaciones…' : citationLoadState.error ? `No se pudieron cargar las citaciones: ${citationLoadState.error}` : status
                : status}
            </span>
            <button className="refresh" onClick={() => {
              if (view === 'fisico') loadPhysical();
              else {
                loadSheets();
                if (view === 'inicio') loadMatches();
              }
            }} aria-label={citationLoadState.error ? 'Reintentar carga de datos' : 'Actualizar datos'}><span aria-hidden="true">↻</span><span>{citationLoadState.error ? 'Reintentar' : 'Actualizar'}</span></button>
          </div>
        )}

        {view === 'inicio' ? (
          <section className="club-home">
            <header className="club-home-heading">
              <div><span className="kicker">PANEL DEL CLUB</span><h2>Hola, {club.shortName || club.name}</h2><p>Resumen de {category === 'primera' ? '1ra División' : 'Intermedia'}</p></div>
            </header>
            <section className="home-next-match">
              {matchLoadState.loading ? (
                <div className="home-data-notice" role="status">Cargando fixture desde AMH…</div>
              ) : matchLoadState.error ? (
                <div className="home-data-notice is-error" role="alert">
                  <span>No se pudo cargar el fixture de AMH: {matchLoadState.error}</span>
                  <button type="button" className="home-retry-button" onClick={() => loadMatches()}>Reintentar</button>
                </div>
              ) : !nextAmhMatch ? (
                <div className="home-data-notice" role="status">No hay próximos partidos disponibles en AMH.</div>
              ) : null}
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
                <span className="home-card-copy"><strong>Citaciones</strong><small>{citationLoadState.loading ? 'Cargando citaciones…' : citationLoadState.error ? 'No se pudieron cargar las citaciones' : current.players.length ? `${current.players.length} jugadoras citadas` : 'Todavía no hay jugadoras citadas'}</small>
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
        ) : view === 'accesos' && authenticated ? (
          <StaffAccessPanel club={club} token={token} />
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
                      <span><strong>{test.name}{test.active === false ? ' · Inactiva' : ''}</strong><small>{test.category} · {test.unit || 'sin unidad'}</small></span>
                      <div className="physical-test-item-actions">
                        {test.dataCount === 0 && <button type="button" className="secondary" onClick={() => deletePhysicalTest(test.key)}>Eliminar</button>}
                        {test.active === false
                          ? <button type="button" className="secondary" onClick={() => reactivatePhysicalTest(test.key)}>Reactivar</button>
                          : test.dataCount > 0 && <button type="button" className="secondary" onClick={() => deactivatePhysicalTest(test.key)}>Desactivar</button>}
                      </div>
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
                <p className="form-hint">Elegí una prueba y una fecha; después cargá el resultado de cada jugadora. Podés cambiar de jugadora sin volver a seleccionar la prueba.</p>
                <div className="callup-meta-grid">
                  <label>Categoría<select value={physicalDraft.category} onChange={event => setPhysicalDraft(current => ({ ...current, category: event.target.value, playerId: '' }))}>
                    <option value="primera">1ra División</option><option value="intermedia">Intermedia</option><option value="5ta">5ta División</option>
                  </select></label>
                  <label>Fecha de evaluación<input type="date" value={physicalDraft.evaluatedOn} onChange={event => { setPhysicalDraft(current => ({ ...current, evaluatedOn: event.target.value, playerId: '', value: '' })); setPhysicalSaveSuccess(''); }} required /></label>
                  <label>Prueba<select value={physicalDraft.testKey} onChange={event => { setPhysicalDraft(current => ({ ...current, testKey: event.target.value, playerId: '', value: '' })); setPhysicalSaveSuccess(''); }} required>
                    <option value="">Seleccioná una prueba</option>
                    {physicalTests.filter(test => test.active !== false).map(test => <option key={test.key} value={test.key}>{test.name}{test.unit ? ` (${test.unit})` : ''}</option>)}
                  </select></label>
                </div>
                {!physicalAssessmentPlayers.length && (
                  <p className="empty-state">No hay jugadoras activas en esta categoría. <button type="button" className="inline-link" onClick={() => { setEditingPhysical(false); setView('jugadoras'); }}>Agregalas o asignales esta categoría en Plantel.</button></p>
                )}
                {physicalDraft.testKey && physicalAssessmentPlayers.length > 0 && <div className="physical-entry-row">
                  <label>Jugadora<select value={physicalDraft.playerId} onChange={event => { setPhysicalDraft(current => ({ ...current, playerId: event.target.value })); setPhysicalSaveSuccess(''); }} required>
                    <option value="">Seleccioná una jugadora del plantel</option>
                    {physicalAssessmentPlayers.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select></label>
                  <label>Resultado{selectedPhysicalTest?.unit ? ` (${selectedPhysicalTest.unit})` : ''}<input type="number" step="any" value={physicalDraft.value} onChange={event => setPhysicalDraft(current => ({ ...current, value: event.target.value }))} required /></label>
                </div>}
                {!physicalTests.some(test => test.active !== false) && (
                  <p className="empty-state">Todavía no hay pruebas activas. <button type="button" className="inline-link" onClick={() => { setEditingPhysical(false); setEditingTestCatalog(true); }}>Agregá las pruebas que van a evaluar.</button></p>
                )}
                {physicalSaveError && <p className="message error">{physicalSaveError}</p>}
                {physicalSaveSuccess && <p className="message success">{physicalSaveSuccess}</p>}
                <button type="submit" disabled={!selectedPhysicalTest || !physicalAssessmentPlayers.length || !physicalDraft.evaluatedOn || !physicalDraft.playerId || physicalDraft.value === ''}>Guardar resultado y cargar otra jugadora</button>
                {physicalDraft.testKey && physicalDraft.evaluatedOn && <section className="physical-entry-recorded">
                  <h3>{selectedPhysicalTest?.name} · resultados del {new Date(`${physicalDraft.evaluatedOn}T00:00:00`).toLocaleDateString('es-AR')}</h3>
                  {physicalTestEntries.length ? <ul>{physicalTestEntries.map(player => <li key={player.id}>
                    <span><strong>{player.name}</strong><small>{player.result.value} {player.result.unit || selectedPhysicalTest?.unit || ''}</small></span>
                    <button type="button" className="secondary" onClick={() => { setPhysicalDraft(current => ({ ...current, playerId: player.rosterId, value: String(player.result.value) })); setPhysicalSaveSuccess(''); }}>Corregir</button>
                  </li>)}</ul> : <p>Todavía no hay resultados cargados para esta prueba y fecha.</p>}
                </section>}
              </form>
            )}
            <div className="physical-hero">
              <span className="kicker"><Activity aria-hidden="true" /> RENDIMIENTO ATLÉTICO</span>
              <p>Consultá las evaluaciones anuales, marcas y promedios del plantel.</p>
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
                      <span>Historial de resultados por fecha</span>
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
                            {latest && <small className="test-result-caption">Última evaluación</small>}
                            <div className="test-rounds">
                              {result?.evals.map((evaluation, index) => {
                                return (
                                  <span key={`${evaluation.evaluatedOn || 'sin-fecha'}-${index}`}><small>{evaluation.evaluatedOn ? new Date(`${evaluation.evaluatedOn}T00:00:00`).toLocaleDateString('es-AR') : `Evaluación ${index + 1}`}</small><strong>{evaluation.value}</strong></span>
                                );
                              })}
                            </div>
                            {result?.diff != null && (
                              <em className={result.improved ? 'positive' : 'negative'}>
                                {result.improved === null ? '' : result.improved ? '↗ ' : '↘ '}Diferencia entre evaluaciones: {result.diff > 0 ? '+' : ''}{result.diff} {test.unit}
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
                        <span key={index}>Evaluación {index + 1} · promedio: {value === null ? '—' : `${value} ${test.unit}`}</span>
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
          <div className="form-card staff-login-card" role="dialog" aria-modal="true" aria-labelledby="staffLoginTitle">
            <button type="button" className="close" aria-label="Cerrar" onClick={() => setShowStaffLogin(false)}>×</button>
            <span className="kicker">ACCESO PRIVADO</span>
            <h2 id="staffLoginTitle">Cuerpo técnico</h2>
            <p>Ingresá con la cuenta Google que recibió la invitación del club.</p>
            {club.googleClientId ? (
              <GoogleIdentityButton clientId={club.googleClientId} onCredential={authenticateStaffGoogle} onError={error => setStaffLoginError(error.message)} />
            ) : <p className="message error">El acceso con Google todavía no está configurado.</p>}
            {staffLoginError && <p className="message error" role="alert">{staffLoginError}</p>}
            <button type="button" className="secondary" onClick={() => setShowStaffLogin(false)}>Cerrar</button>
          </div>
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

function GoogleIdentityButton({ clientId, onCredential, onError }) {
  const container = useRef(null);
  const callback = useRef(onCredential);
  const reportError = useRef(onError);
  useEffect(() => { callback.current = onCredential; reportError.current = onError; }, [onCredential, onError]);
  useEffect(() => {
    let cancelled = false;
    const mountButton = () => {
      if (cancelled || !container.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try { await callback.current(credential); }
          catch (error) { reportError.current?.(error); }
        }
      });
      window.google.accounts.id.renderButton(container.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320
      });
    };
    let script = document.querySelector('script[data-google-identity]');
    if (window.google?.accounts?.id) mountButton();
    else if (script) script.addEventListener('load', mountButton, { once: true });
    else {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.addEventListener('load', mountButton, { once: true });
      script.addEventListener('error', () => reportError.current?.(new Error('No se pudo cargar el acceso de Google.')), { once: true });
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [clientId]);
  return <div ref={container} className="google-signin-button" />;
}

function StaffAccessPanel({ club, token }) {
  const [email, setEmail] = useState('');
  const [grantAccessManagement, setGrantAccessManagement] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [message, setMessage] = useState('');
  const [staff, setStaff] = useState([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(true);
  async function loadStaff() {
    setLoadingStaff(true);
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}&dataset=staff-access`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los accesos.');
      setStaff(payload.staff || []);
      setCurrentEmail(String(payload.currentEmail || '').toLowerCase());
    } catch (error) { setMessage(error.message); }
    finally { setLoadingStaff(false); }
  }
  useEffect(() => { loadStaff(); }, [club.slug, token]);
  async function invite(event) {
    event.preventDefault();
    setMessage('Creando invitación…');
    setInviteUrl('');
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create-staff-invite', email, canManageAccess: grantAccessManagement })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear la invitación.');
      setInviteUrl(new URL(payload.invitePath, window.location.origin).toString());
      setMessage(`Invitación para ${payload.email}. Vence en ${payload.expiresInDays} días.${payload.canManageAccess ? ' También será responsable de accesos.' : ''}`);
      setEmail('');
      setGrantAccessManagement(false);
    } catch (error) { setMessage(error.message); }
  }
  async function revoke(user) {
    if (!window.confirm(`¿Quitar el acceso de ${user.email}?`)) return;
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'revoke-staff-user', userId: user.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo quitar el acceso.');
      setMessage(`Se quitó el acceso de ${user.email}.`);
      await loadStaff();
    } catch (error) { setMessage(error.message); }
  }
  async function setAccessManager(user, canManageAccess) {
    const confirmation = canManageAccess
      ? `¿Designar a ${user.email} como responsable de accesos?`
      : `¿Quitarle a ${user.email} el permiso para administrar accesos?`;
    if (!window.confirm(confirmation)) return;
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set-staff-access-manager', userId: user.id, canManageAccess })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo actualizar el responsable de accesos.');
      setMessage(canManageAccess ? `${user.email} ahora puede administrar los accesos.` : `Se quitó a ${user.email} el permiso para administrar accesos.`);
      await loadStaff();
    } catch (error) { setMessage(error.message); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setMessage('Enlace copiado.'); }
    catch (_) { setMessage('No se pudo copiar automáticamente. Seleccioná y copiá el enlace.'); }
  }
  return (
    <section className="players-section staff-access-panel">
      <span className="kicker">CUERPO TÉCNICO</span>
      <h2>Invitar a otra persona</h2>
      <p>Solo las personas responsables de accesos pueden invitar o quitar cuentas. El club debe conservar al menos una persona responsable.</p>
      <p>La persona recibirá un enlace para registrarse con Google. La invitación solo funciona con este email y vence en siete días.</p>
      <form onSubmit={invite}>
        <label>Email de Google
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} />
        </label>
        <label className="staff-manager-checkbox">
          <input type="checkbox" checked={grantAccessManagement} onChange={event => setGrantAccessManagement(event.target.checked)} />
          También podrá invitar y quitar accesos
        </label>
        <button type="submit">Crear invitación</button>
      </form>
      {message && <p className="message" role="status">{message}</p>}
      {inviteUrl && <><label>Enlace de invitación<input readOnly value={inviteUrl} onFocus={event => event.target.select()} /></label><button type="button" className="secondary" onClick={copyInvite}>Copiar enlace</button></>}
      <h3>Accesos activos</h3>
      {loadingStaff ? <p>Cargando accesos…</p> : staff.length ? (
        <ul className="staff-access-list">{staff.map(user => (
          <li key={user.id}><span><strong>{user.displayName || user.email}</strong><small>{user.displayName ? user.email : 'Cuerpo técnico'}{user.canManageAccess ? ' · Responsable de accesos' : ''}</small></span>
            {user.email.toLowerCase() === currentEmail ? <small>Tu cuenta</small> : (
              <div className="staff-access-actions">
                <button type="button" className="secondary" onClick={() => setAccessManager(user, !user.canManageAccess)}>
                  {user.canManageAccess ? 'Quitar permiso' : 'Hacer responsable'}
                </button>
                <button type="button" className="secondary" onClick={() => revoke(user)}>Quitar acceso</button>
              </div>
            )}
          </li>
        ))}</ul>
      ) : <p>No hay cuentas Google activas.</p>}
    </section>
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
      setWorkspaceClub(data.club ? { ...data.club, googleClientId: data.googleClientId || '' } : null);
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

  async function inviteClubStaff(club) {
    const email = window.prompt(`Email de Google para invitar al cuerpo técnico de ${club.name}:`);
    if (!email) return;
    const canManageAccess = window.confirm(`¿Designar a ${email.trim()} como responsable de accesos de ${club.name}?`);
    try {
      const result = await api('/api/admin/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'create-staff-invite', slug: club.slug, email, canManageAccess })
      });
      const link = new URL(result.invitePath, window.location.origin).toString();
      window.prompt(`Invitación para ${result.email}. Vence en ${result.expiresInDays} días.${result.canManageAccess ? ' Será responsable de accesos.' : ''} Copiá este enlace y envialo:`, link);
    } catch (error) { setMessage(error.message); }
  }

  async function deleteClub(club) {
    const confirmation = window.prompt(
      `Esta acción eliminará el club y todos sus datos asociados. Para confirmar, escribí exactamente el slug: ${club.slug}`
    );
    if (confirmation === null) return;
    if (confirmation !== club.slug) {
      setMessage('El slug no coincide. No se eliminó el club.');
      return;
    }
    try {
      await api('/api/admin/clubs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ slug: club.slug, confirmSlug: confirmation })
      });
      setClubs(current => current.filter(item => item.slug !== club.slug));
      setMessage(`${club.name || club.slug} y sus datos asociados fueron eliminados.`);
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
        tournament: {
          name: form.tournamentName,
          baseUrl: form.tournamentBaseUrl,
          tournamentId: form.tournamentId,
          clubId: form.tournamentClubId,
          amhTeamName: form.tournamentAmhTeamName,
          division: form.tournamentDivision || '1'
        },
        season: { name: form.seasonName },
        auth: {}
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
                  <div className="club-card-actions">
                    <details className="club-options">
                      <summary aria-label={`Opciones de ${club.name || club.slug}`} title="Opciones del club"><Ellipsis size={20} /></summary>
                      <div className="club-options-menu">
                        <button type="button" onClick={() => openEdit(club)}>Editar perfil</button>
                        <button type="button" onClick={() => inviteClubStaff(club)}>Invitar cuerpo técnico</button>
                        <button type="button" className="danger" onClick={() => deleteClub(club)}>Eliminar club</button>
                      </div>
                    </details>
                  </div>
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
            <p className="auth-settings-help">El acceso del cuerpo técnico se asigna por invitación y cuenta Google individual.</p>
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
