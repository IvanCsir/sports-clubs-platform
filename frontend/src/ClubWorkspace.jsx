import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import TrackerPanel from './components/TrackerPanel';
import TournamentPanel from './components/TournamentPanel';
import EstadisticasPanel from './components/EstadisticasPanel';
import PrecargaModal from './components/PrecargaModal';
import MatchPreparationPanel from './components/MatchPreparationPanel';
import PlayerMonitoringPanel from './components/PlayerMonitoringPanel';
import SeasonBackupPanel from './components/SeasonBackupPanel';
import StaffAccessPanel from './components/StaffAccessPanel';
import StaffLoginDialog from './components/StaffLoginDialog';
import WorkspaceNav, { workspaceSections } from './components/WorkspaceNav';
import ClubHome from './components/ClubHome';
import CallupsPanel from './components/CallupsPanel';
import RosterPanel from './components/RosterPanel';
import PhysicalPanel from './components/PhysicalPanel';
import { deleteTrackerEvents, fetchClubDataset, fetchFixture, postClubAction, signInWithGoogle, verifySession } from './api';
import { callupMatchesFixture, describeNextMatch, isCallupExpired } from './utils/callups';

const EMPTY_CITATIONS = { primera: null, intermedia: null };
const EMPTY_CALLUP = { players: [], meta: {}, matchKey: '' };
const EMPTY_TOURNAMENT_STATS = { tournaments: [], activeKey: '' };
const EMPTY_MONITORING = { wellness: [], loads: [] };

function hydratePhysicalTests(tests) {
  return (tests || []).map(test => ({
    ...test,
    type: test.type || test.category || 'Personalizada',
    icon: Activity,
    decimals: Number(test.decimals ?? 2)
  }));
}

function updatedAtLabel() {
  return `Datos actualizados · ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
}

// Citación vigente de la categoría: se descarta si es de un partido anterior al próximo
// del fixture, o si su fecha ya pasó cuando AMH no informa el próximo partido.
function currentCallup(stored, nextMatch, matchesLoaded) {
  const callup = stored || EMPTY_CALLUP;
  const meta = callup.meta || {};
  const matchesFixture = callupMatchesFixture(meta, nextMatch);
  const stale = matchesLoaded
    ? (nextMatch ? !matchesFixture : isCallupExpired(meta))
    : (isCallupExpired(meta) && !(nextMatch && matchesFixture));
  return stale ? EMPTY_CALLUP : { ...EMPTY_CALLUP, ...callup, meta };
}

export default function ClubWorkspace({ club, onBack, showAdminBack }) {
  const authKey = `club_tracker_auth_${club.slug}`;
  const staffInviteToken = new URLSearchParams(window.location.search).get('staffInvite') || '';
  const [category, setCategory] = useState('primera');
  const [view, setView] = useState('inicio');
  const [citations, setCitations] = useState(EMPTY_CITATIONS);
  const [physicalPlayers, setPhysicalPlayers] = useState([]);
  const [physicalTests, setPhysicalTests] = useState([]);
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tournamentStats, setTournamentStats] = useState(EMPTY_TOURNAMENT_STATS);
  const [monitoring, setMonitoring] = useState(EMPTY_MONITORING);
  const [status, setStatus] = useState('Cargando información del club...');
  const [citationLoadState, setCitationLoadState] = useState({ loading: true, error: '' });
  const [matchLoadState, setMatchLoadState] = useState({ loading: true, error: '' });
  const [matches, setMatches] = useState([]);
  const [nextAmhMatch, setNextAmhMatch] = useState(null);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [token, setToken] = useState('');
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [showStaffLogin, setShowStaffLogin] = useState(Boolean(staffInviteToken));
  const [showPrecargaModal, setShowPrecargaModal] = useState(false);
  const authenticated = Boolean(token);

  async function loadMatches(division = (category === 'intermedia' ? '2' : '1')) {
    setMatchesLoaded(false);
    setMatchLoadState({ loading: true, error: '' });
    try {
      const payload = await fetchFixture(club.slug, division);
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
    const payload = await fetchClubDataset(club.slug, 'staff', {
      token: sessionToken, fallbackError: 'No se pudieron cargar los datos del cuerpo técnico.'
    });
    setEvents(payload.events || []);
    setTournamentStats(payload.tournamentStats || EMPTY_TOURNAMENT_STATS);
    setPhysicalPlayers(payload.physicalPlayers || []);
    setPhysicalTests(hydratePhysicalTests(payload.physicalTests));
    setPlayers(payload.players || []);
    setMonitoring(payload.monitoring || EMPTY_MONITORING);
    setCanManageAccess(Boolean(payload.canManageAccess));
    if (payload.citations) setCitations(payload.citations);
  }

  async function loadCitations() {
    setCitationLoadState({ loading: true, error: '' });
    try {
      const payload = await fetchClubDataset(club.slug, 'citations', { fallbackError: 'No se pudieron cargar las citaciones.' });
      setCitations(payload.citations || EMPTY_CITATIONS);
      setStatus(updatedAtLabel());
      setCitationLoadState({ loading: false, error: '' });
    } catch (error) {
      setStatus(error.message);
      setCitationLoadState({ loading: false, error: error.message || 'No se pudieron cargar las citaciones.' });
    }
  }

  async function loadPhysical() {
    setStatus('Cargando evaluaciones físicas...');
    try {
      const payload = await fetchClubDataset(club.slug, 'physical', { fallbackError: 'No se pudieron cargar las evaluaciones físicas.' });
      setPhysicalPlayers(payload.physicalPlayers || []);
      setPhysicalTests(hydratePhysicalTests(payload.physicalTests));
      setStatus(updatedAtLabel());
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function startSession(sessionToken) {
    await loadStaffData(sessionToken);
    setToken(sessionToken);
    sessionStorage.setItem(authKey, sessionToken);
  }

  async function authenticateStaffGoogle(credential) {
    const payload = await signInWithGoogle(club.slug, credential, staffInviteToken);
    if (!payload.token) throw new Error('No se pudo validar la cuenta de Google.');
    await startSession(payload.token);
    if (staffInviteToken) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('staffInvite');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
    setShowStaffLogin(false);
    setView('inicio');
  }

  function logoutStaff() {
    sessionStorage.removeItem(authKey);
    localStorage.removeItem(authKey);
    setToken('');
    setCanManageAccess(false);
    setEvents([]);
    setTournamentStats(EMPTY_TOURNAMENT_STATS);
    setPlayers([]);
    setPhysicalPlayers([]);
    setPhysicalTests([]);
    setMonitoring(EMPTY_MONITORING);
    setShowPrecargaModal(false);
    setView('inicio');
  }

  async function persistTrackerEvent(event, opponent) {
    await postClubAction(club.slug, 'save-event', { match: event.match, matchKey: event.matchKey, opponent, event },
      { token, fallbackError: 'No se pudo guardar el evento en la base de datos.' });
    setTournamentStats(current => ({
      ...current,
      tournaments: current.tournaments.map(tournament => tournament.key === current.activeKey
        ? { ...tournament, events: [...(tournament.events || []).filter(item => item.id !== event.id), { ...event, opponent }] }
        : tournament)
    }));
  }

  // Recuperar la sesión guardada del cuerpo técnico y cargar el fixture de la categoría.
  useEffect(() => {
    loadMatches(category === 'intermedia' ? '2' : '1');
    try {
      localStorage.removeItem(authKey);
      const savedToken = sessionStorage.getItem(authKey);
      if (savedToken) {
        verifySession(club.slug, savedToken)
          .then(payload => {
            if (!payload.valid) throw new Error('Sesión vencida');
            return loadStaffData(savedToken).then(() => setToken(savedToken));
          })
          .catch(() => sessionStorage.removeItem(authKey));
      }
    } catch (_) {}
  }, [club.slug, category]);

  useEffect(() => {
    loadCitations();
  }, [club.slug]);

  function selectSection(id) {
    setView(id);
    if (id === 'fisico') loadPhysical();
    if (id === 'seguimiento' && authenticated) loadStaffData(token);
    if (id === 'stats' && authenticated) loadStaffData(token).catch(error => setStatus(error.message));
    if (id === 'dt') {
      setMatches([]);
      loadMatches('1');
    }
  }

  const callup = currentCallup(citations[category], nextAmhMatch, matchesLoaded);
  const matchInfo = describeNextMatch(callup.meta, nextAmhMatch, club);
  const latestResult = [...matches].reverse().find(match => match.played) || null;
  const sections = workspaceSections(authenticated, canManageAccess);
  const showsCitations = ['inicio', 'citaciones'].includes(view);
  const citationError = showsCitations && citationLoadState.error;

  function renderView() {
    switch (view) {
      case 'inicio':
        return (
          <ClubHome
            club={club}
            category={category}
            matchInfo={matchInfo}
            hasNextMatch={Boolean(nextAmhMatch)}
            matchLoadState={matchLoadState}
            onRetryMatches={() => loadMatches()}
            callup={callup}
            citationLoadState={citationLoadState}
            latestResult={latestResult}
            authenticated={authenticated}
            activePlayerCount={players.filter(player => player.active).length}
            onSelect={selectSection}
          />
        );
      case 'dt':
        return (
          <TrackerPanel
            club={club}
            calledUpPlayers={citations.primera?.players || []}
            callupMatchKey={citations.primera?.matchKey || ''}
            events={events}
            setEvents={setEvents}
            onPersistEvent={persistTrackerEvent}
            onDeleteEvent={ids => deleteTrackerEvents(club.slug, token, ids)}
            matches={matches}
            nextMatch={nextAmhMatch}
            loadMatches={loadMatches}
            authenticated={authenticated}
          />
        );
      case 'stats':
        return (
          <EstadisticasPanel
            club={club}
            events={events}
            tournaments={tournamentStats.tournaments}
            activeTournamentKey={tournamentStats.activeKey}
            matches={matches}
            authenticated={authenticated}
            onGoToTracker={() => selectSection('dt')}
          />
        );
      case 'respaldo':
        return authenticated ? <SeasonBackupPanel club={club} token={token} /> : null;
      case 'accesos':
        return authenticated ? <StaffAccessPanel club={club} token={token} /> : null;
      case 'torneo':
        return <TournamentPanel club={club} />;
      case 'preparacion':
        return <MatchPreparationPanel club={club} authenticated={authenticated} token={token} />;
      case 'seguimiento':
        return <PlayerMonitoringPanel club={club} authenticated={authenticated} monitoring={monitoring} onRefresh={() => loadStaffData(token)} />;
      case 'jugadoras':
        return authenticated ? <RosterPanel club={club} token={token} players={players} onSaved={() => loadStaffData(token)} /> : null;
      case 'fisico':
        return (
          <PhysicalPanel
            club={club}
            authenticated={authenticated}
            token={token}
            physicalPlayers={physicalPlayers}
            physicalTests={physicalTests}
            players={players}
            onReloadPhysical={loadPhysical}
            onReloadStaff={() => loadStaffData(token)}
            onGoToRoster={() => setView('jugadoras')}
          />
        );
      default:
        return (
          <CallupsPanel
            club={club}
            category={category}
            callup={callup}
            matchInfo={matchInfo}
            nextMatch={nextAmhMatch}
            players={players}
            authenticated={authenticated}
            token={token}
            onSaved={async () => { await loadCitations(); await loadStaffData(token); }}
            onGoToRoster={() => setView('jugadoras')}
          />
        );
    }
  }

  return (
    <main className={`portal${view === 'dt' ? ' live-mode' : ''}`} style={{ '--club-accent': club.theme?.accent || '#00a2ff', '--club-primary': club.theme?.primary || '#1e88e5' }}>
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
              <button type="button" className="secondary staff-access-header" onClick={() => setShowStaffLogin(true)}>
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

        <WorkspaceNav
          club={club}
          view={view}
          sections={sections}
          authenticated={authenticated}
          onSelect={selectSection}
          onLogin={() => setShowStaffLogin(true)}
          onLogout={logoutStaff}
        />

        <div className="view-toolbar">
        {showsCitations && (
          <div className="segmented" role="group" aria-label="Categoría">
            <button type="button" className={category === 'primera' ? 'active' : ''} aria-pressed={category === 'primera'} onClick={() => setCategory('primera')}>1ra División</button>
            <button type="button" className={category === 'intermedia' ? 'active' : ''} aria-pressed={category === 'intermedia'} onClick={() => setCategory('intermedia')}>Intermedia</button>
          </div>
        )}

        {(showsCitations || view === 'fisico') && (
          <div className={`sync-status${citationError ? ' is-error' : ''}`}>
            <span className="sync-status-message" role={citationError ? 'alert' : 'status'}>
              {showsCitations
                ? citationLoadState.loading ? 'Cargando citaciones…' : citationLoadState.error ? `No se pudieron cargar las citaciones: ${citationLoadState.error}` : status
                : status}
            </span>
            <button className="refresh" onClick={() => {
              if (view === 'fisico') loadPhysical();
              else {
                loadCitations();
                if (view === 'inicio') loadMatches();
              }
            }} aria-label={citationLoadState.error ? 'Reintentar carga de datos' : 'Actualizar datos'}><span aria-hidden="true">↻</span><span>{citationLoadState.error ? 'Reintentar' : 'Actualizar'}</span></button>
          </div>
        )}
        </div>

        {renderView()}
      </section>

      {showStaffLogin && (
        <StaffLoginDialog
          googleClientId={club.googleClientId}
          onCredential={authenticateStaffGoogle}
          onClose={() => setShowStaffLogin(false)}
        />
      )}

      {showPrecargaModal && authenticated && (
        <PrecargaModal
          club={club}
          citedPlayers={citations}
          token={token}
          onClose={() => setShowPrecargaModal(false)}
        />
      )}
    </main>
  );
}
