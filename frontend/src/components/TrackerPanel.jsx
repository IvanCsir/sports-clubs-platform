import { useEffect, useState } from 'react';
import { CircleDot, Goal, Target, ArrowDownToLine } from 'lucide-react';

const TRACKER_ACTIONS = [
  ['entry', ArrowDownToLine, 'Ingreso al área'],
  ['corner', Goal, 'Córner corto'],
  ['stroke', Target, 'Penal'],
  ['fieldGoal', CircleDot, 'Gol de jugada']
];

export default function TrackerPanel({
  club,
  calledUpPlayers = [],
  callupMatchKey = '',
  events,
  setEvents,
  onPersistEvent,
  onDeleteEvent,
  matches,
  loadMatches,
  authenticated,
  token,
  onAuthenticate,
  onOpenPrecarga
}) {
  const [matchIndex, setMatchIndex] = useState(-1);
  const [quarter, setQuarter] = useState(1);
  const [seconds, setSeconds] = useState(900);
  const [timerRunning, setTimerRunning] = useState(false);
  const [teamView, setTeamView] = useState('home');
  const [password, setPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [eventFlow, setEventFlow] = useState(null);
  const [eventFlowError, setEventFlowError] = useState('');

  const storageKey = `club_tracker_${club.slug}`;
  const match = matches[matchIndex];
  const matchLabel = match?.round || 'PARTIDO MANUAL';
  const matchKey = match?.round || 'amistoso';
  const expectedCallupMatchKey = `primera-${matchKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const matchCalledUpPlayers = match && callupMatchKey === expectedCallupMatchKey ? calledUpPlayers : [];

  function formatTime(val) {
    return `${String(Math.floor(val / 60)).padStart(2, '0')}:${String(val % 60).padStart(2, '0')}`;
  }

  async function login() {
    setAuthStatus('Validando acceso...');
    try {
      const response = await fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const payload = await response.json();
      if (!response.ok || !payload.token) {
        throw new Error(payload.error || 'No se pudo iniciar sesión.');
      }
      await onAuthenticate(payload.token);
      setPassword('');
      setAuthStatus('Sesión activa');
    } catch (error) {
      setAuthStatus(error.message);
    }
  }

  // Cargar estado inicial desde localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (saved.quarter) setQuarter(saved.quarter);
      if (saved.seconds != null) setSeconds(saved.seconds);
    } catch (_) {}
  }, [storageKey]);

  // Persistir en localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localStorage.setItem(storageKey, JSON.stringify({ ...saved, quarter, seconds }));
    } catch (_) {}
  }, [quarter, seconds, storageKey]);

  // Control del cronómetro
  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = window.setInterval(() => {
      setSeconds(val => {
        if (val <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return val - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const currentEvents = events.filter(event => (event.matchKey || event.match || 'amistoso') === matchKey);

  const score = team =>
    currentEvents.filter(
      event => event.team === team && ['cornerGoal', 'strokeGoal', 'fieldGoal'].includes(event.type)
    ).length;

  const count = (team, type) =>
    currentEvents.filter(event => event.team === team && event.type === type).length;

  const addEvent = async (team, type, details = {}) => {
    const newEvent = {
      id: `${Date.now()}-${Math.random()}`,
      match: matchKey,
      matchKey,
      quarter,
      team,
      type,
      ...details,
      at: new Date().toISOString()
    };
    try {
      await onPersistEvent(newEvent, match?.rival);
      setEvents(current => [...current, newEvent]);
      return true;
    } catch (error) {
      setAuthStatus(error.message);
      return false;
    }
  };

  const beginAction = (team, type) => {
    setAuthStatus('');
    setEventFlowError('');
    if (type === 'entry' || ['green', 'yellow', 'red'].includes(type)) {
      addEvent(team, type);
      return;
    }
    if (team === 'away' && type === 'fieldGoal') {
      addEvent(team, type);
      return;
    }
    if (team === 'home' && !matchCalledUpPlayers.length) {
      setAuthStatus('No hay una citación guardada para este partido. Guardá primero las jugadoras citadas de Primera.');
      return;
    }
    setEventFlow({
      team,
      type,
      step: type === 'fieldGoal' ? 'scorer' : type === 'corner' && team === 'home' ? 'generator' : 'outcome',
      generatedBy: '',
      scorer: ''
    });
  };

  const continueEventFlow = async () => {
    if (!eventFlow) return;
    setEventFlowError('');
    if (eventFlow.step === 'generator') {
      if (!eventFlow.generatedBy.trim()) {
        setEventFlowError('Elegí quién generó el córner corto.');
        return;
      }
      setEventFlow(current => ({ ...current, step: 'outcome' }));
      return;
    }
    if (eventFlow.step === 'outcome') {
      if (!eventFlow.goal) {
        const saved = await addEvent(eventFlow.team, eventFlow.type, eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {});
        if (saved) setEventFlow(null);
        return;
      }
      setEventFlow(current => ({ ...current, step: 'scorer' }));
      return;
    }
    if (!eventFlow.scorer.trim()) {
      setEventFlowError('Elegí quién hizo el gol.');
      return;
    }
    if (eventFlow.type !== 'fieldGoal') {
      const attemptSaved = await addEvent(eventFlow.team, eventFlow.type, eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {});
      if (!attemptSaved) return;
    }
    const details = {
      player: eventFlow.scorer.trim(),
      ...(eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {})
    };
    const goalSaved = await addEvent(eventFlow.team, eventFlow.type === 'fieldGoal' ? 'fieldGoal' : `${eventFlow.type}Goal`, details);
    if (goalSaved) setEventFlow(null);
  };

  const resetMatch = () => {
    if (window.confirm('¿Reiniciar los datos de este partido?')) {
      const removed = currentEvents;
      Promise.all(removed.map(event => onDeleteEvent(event.id))).then(() => {
        const removedIds = new Set(removed.map(event => event.id));
        setEvents(current => current.filter(event => !removedIds.has(event.id)));
      }).catch(error => setAuthStatus(error.message));
      setQuarter(1);
      setSeconds(900);
      setTimerRunning(false);
    }
  };

  // Guardado completo del partido en PostgreSQL.
  async function saveMatch() {
    setIsSyncing(true);
    setSyncStatus('Guardando en la base de datos...');
    try {
      const payload = {
        action: 'sync_full_match',
        round: matchKey,
        rival: match?.rival || 'Rival',
        matchState: {
          round: matchKey,
          rivalName: match?.rival || 'Rival',
          quarter,
          score: { home: score('home'), away: score('away') },
          events: currentEvents
        }
      };

      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'replace-match-events', match: payload.round, matchKey, opponent: payload.rival, events: currentEvents })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar el partido.');

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncStatus(`✅ Guardado en la base a las ${timeStr} hs`);
    } catch (err) {
      setSyncStatus(`❌ Error sincronizando: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  }

  const renderTeam = (team, name) => (
    <div className={`tracker-team ${team}`}>
      <h3>{name}</h3>
      <div className="tracker-score">{score(team)}</div>
      {TRACKER_ACTIONS.map(([type, Icon, label]) => (
        <button
          key={type}
          onClick={() => beginAction(team, type)}
        >
          <span><Icon /></span>
          <strong>{label}</strong>
          <small>{count(team, type)} en partido</small>
          <b>+1</b>
        </button>
      ))}
      <div className="tracker-cards">
        <span>Tarjetas</span>
        {['green', 'yellow', 'red'].map(card => (
          <button key={card} onClick={() => beginAction(team, card)}>
            {card === 'green' ? '🟩' : card === 'yellow' ? '🟨' : '🟥'} {count(team, card)}
          </button>
        ))}
      </div>
    </div>
  );

  if (!authenticated) {
    return (
      <section className="tracker-panel">
        <div className="tracker-hero">
          <span className="kicker">BOTONERA DT · {club.shortName || club.name}</span>
          <h2>Acceso del cuerpo técnico</h2>
          <p>Ingresá la contraseña de este club para registrar incidencias en tiempo real.</p>
        </div>
        <form
          className="tracker-login"
          onSubmit={event => {
            event.preventDefault();
            login();
          }}
        >
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Contraseña del cuerpo técnico"
            autoComplete="current-password"
          />
          <button type="submit">Ingresar</button>
        </form>
        {authStatus && <p className="message">{authStatus}</p>}
      </section>
    );
  }

  return (
    <section className="tracker-panel">
      <div className="tracker-hero">
        <span className="kicker">BOTONERA DT · {club.shortName || club.name} · 1RA DIVISIÓN</span>
        <h2>Registro táctico en vivo</h2>
        <p>Guardá las incidencias del partido por cuarto y equipo. Se actualizan automáticamente en Estadísticas.</p>
      </div>

      <div className="tracker-toolbar">
        <select value={matchIndex} onChange={event => setMatchIndex(Number(event.target.value))}>
          <option value={-1}>Amistoso / partido manual</option>
          {matches.map((item, index) => (
            <option value={index} key={`${item.round}-${index}`}>
              {item.round} · {item.rival} · {item.fecha}
            </option>
          ))}
        </select>
        <button className="refresh" onClick={() => loadMatches('1')}>
          Actualizar Fixture
        </button>
        {authenticated && (
          <button
            type="button"
            className="secondary sync-sheets-btn"
            onClick={saveMatch}
            disabled={isSyncing}
          >
            {isSyncing ? 'Guardando...' : '☁️ Guardar partido'}
          </button>
        )}
        {onOpenPrecarga && (
          <button
            type="button"
            className="secondary precarga-trigger-btn"
            onClick={onOpenPrecarga}
          >
            🏑 Precarga AMH
          </button>
        )}
        {syncStatus && <span className="sync-sheets-status">{syncStatus}</span>}
      </div>

      <div className="tracker-header">
        <div>
          <span className="kicker">{matchLabel || 'PARTIDO MANUAL'}</span>
          <h3>
            {club.shortName || club.name} <small>vs</small> {match?.rival || 'Rival'}
          </h3>
          <p>{match?.fecha || 'Sin fecha'} · {match?.homeAway || 'Local'}</p>
        </div>
        <div className="tracker-total-score">
          {score('home')} - {score('away')}
        </div>
      </div>

      <div className="tracker-clock">
        <strong>{formatTime(seconds)}</strong>
        <span>{quarter}° cuarto</span>
        <button onClick={() => setTimerRunning(val => !val)}>
          {timerRunning ? '⏸ Pausar' : '▶ Iniciar'}
        </button>
        <button
          onClick={() => {
            setSeconds(900);
            setTimerRunning(false);
          }}
        >
          ↺ Reiniciar reloj
        </button>
      </div>

      <div className="tracker-quarters">
        {[1, 2, 3, 4].map(item => (
          <button
            className={quarter === item ? 'active' : ''}
            onClick={() => {
              setQuarter(item);
              setSeconds(900);
              setTimerRunning(false);
            }}
            key={item}
          >
            {item}° cuarto
          </button>
        ))}
      </div>

      <div className="tracker-team-view">
        {[
          ['home', club.shortName || club.name],
          ['away', match?.rival || 'Rival'],
          ['both', 'Ambos']
        ].map(([team, label]) => (
          <button
            className={teamView === team ? 'active' : ''}
            onClick={() => setTeamView(team)}
            key={team}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tracker-grid">
        {(teamView === 'home' || teamView === 'both') && renderTeam('home', club.shortName || club.name)}
        {(teamView === 'away' || teamView === 'both') && renderTeam('away', match?.rival || 'Rival')}
      </div>

      <div className="tracker-actions">
        <button onClick={async () => {
          const lastEvent = currentEvents.at(-1);
          if (!lastEvent) return;
          try {
            await onDeleteEvent(lastEvent.id);
            setEvents(current => current.filter(event => event.id !== lastEvent.id));
          } catch (error) { setAuthStatus(error.message); }
        }}>
          ↩ Deshacer última jugada
        </button>
        <button onClick={() => setTeamView('both')}>📊 Vista Ambos Equipos</button>
        <button onClick={resetMatch}>🔄 Nuevo partido</button>
      </div>

      <div className="tracker-feed">
        <h3>Feed de incidencias ({currentEvents.length})</h3>
        {currentEvents.length ? (
          [...currentEvents].reverse().map(event => (
            <div key={event.id}>
              <span>{event.quarter}° cuarto</span>
              <strong>{event.team === 'home' ? club.shortName || club.name : match?.rival || 'Rival'}</strong>
              <small>{event.type}{event.player ? ` · Gol: ${event.player}` : ''}{event.generatedBy ? ` · Generó: ${event.generatedBy}` : ''}</small>
            </div>
          ))
        ) : (
          <p className="empty-state">Todavía no hay incidencias registradas en este partido.</p>
        )}
      </div>

      {eventFlow && (
        <div className="overlay" role="presentation">
          <form className="form-card tracker-event-dialog" role="dialog" aria-modal="true" onSubmit={event => { event.preventDefault(); continueEventFlow(); }}>
            <button type="button" className="close" onClick={() => { setEventFlow(null); setEventFlowError(''); }} aria-label="Cerrar">×</button>
            {eventFlow.step === 'generator' ? (
              <>
                <h2>¿Quién generó el córner corto?</h2>
                <label>Jugadora citada<select value={eventFlow.generatedBy} onChange={event => setEventFlow(current => ({ ...current, generatedBy: event.target.value }))} required>
                  <option value="">Elegí una jugadora</option>
                  {matchCalledUpPlayers.map(player => <option key={player} value={player}>{player}</option>)}
                </select></label>
              </>
            ) : eventFlow.step === 'outcome' ? (
              <>
                <h2>{eventFlow.type === 'stroke' ? 'Penal' : 'Córner corto'}</h2>
                <p className="tracker-event-question">¿Terminó en gol?</p>
                <div className="tracker-event-actions">
                  <button type="button" onClick={async () => {
                    if (eventFlow.team === 'away') {
                      const attemptSaved = await addEvent(eventFlow.team, eventFlow.type);
                      if (attemptSaved) {
                        const goalSaved = await addEvent(eventFlow.team, `${eventFlow.type}Goal`);
                        if (goalSaved) setEventFlow(null);
                      }
                    } else {
                      setEventFlow(current => ({ ...current, goal: true, step: 'scorer' }));
                    }
                  }}>Sí, fue gol</button>
                  <button type="button" className="secondary" onClick={async () => {
                    const saved = await addEvent(eventFlow.team, eventFlow.type, eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {});
                    if (saved) setEventFlow(null);
                  }}>No</button>
                </div>
              </>
            ) : (
              <>
                <h2>{eventFlow.type === 'fieldGoal' ? '¿Quién hizo el gol de jugada?' : '¿Quién hizo el gol?'}</h2>
                <label>Goleadora citada<select value={eventFlow.scorer} onChange={event => setEventFlow(current => ({ ...current, scorer: event.target.value }))} required>
                  <option value="">Elegí una jugadora</option>
                  {matchCalledUpPlayers.map(player => <option key={player} value={player}>{player}</option>)}
                </select></label>
              </>
            )}
            {eventFlowError && <p className="message error">{eventFlowError}</p>}
            {eventFlow.step !== 'outcome' && <button type="submit">Continuar</button>}
            <button type="button" className="secondary" onClick={() => { setEventFlow(null); setEventFlowError(''); }}>Cancelar</button>
          </form>
        </div>
      )}
    </section>
  );
}

