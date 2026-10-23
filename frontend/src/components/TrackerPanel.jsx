import { useEffect, useState } from 'react';

const TRACKER_ACTIONS = [
  ['entry', '📥', 'Ingreso al área'],
  ['corner', '🏑', 'Córner corto'],
  ['stroke', '🎯', 'Penal'],
  ['fieldGoal', '⚽', 'Gol de jugada']
];

export default function TrackerPanel({
  club,
  events,
  setEvents,
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

  const storageKey = `club_tracker_${club.slug}`;
  const match = matches[matchIndex];
  const matchKey = match?.round || 'amistoso';

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
      onAuthenticate(payload.token);
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

  const currentEvents = events.filter(event => (event.match || 'amistoso') === matchKey);

  const score = team =>
    currentEvents.filter(
      event => event.team === team && ['cornerGoal', 'strokeGoal', 'fieldGoal'].includes(event.type)
    ).length;

  const count = (team, type) =>
    currentEvents.filter(event => event.team === team && event.type === type).length;

  const addEvent = (team, type) => {
    const newEvent = {
      id: `${Date.now()}-${Math.random()}`,
      match: matchKey,
      quarter,
      team,
      type,
      at: new Date().toISOString()
    };
    setEvents(current => [...current, newEvent]);
  };

  const addSetPiece = (team, type) => {
    addEvent(team, type);
    if (window.confirm('¿Terminó en gol esta jugada fija?')) {
      addEvent(team, `${type}Goal`);
    }
  };

  const resetMatch = () => {
    if (window.confirm('¿Reiniciar los datos de este partido?')) {
      setEvents(current => current.filter(event => (event.match || 'amistoso') !== matchKey));
      setQuarter(1);
      setSeconds(900);
      setTimerRunning(false);
    }
  };

  // Sincronización con Google Sheets (Apps Script DT)
  async function syncWithSheets() {
    if (!club.dtSpreadsheetUrl) {
      setSyncStatus('⚠️ Club sin URL de Google Apps Script configurada');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Transmitiendo a Google Sheets...');
    try {
      const payload = {
        action: 'sync_full_match',
        round: match?.round || 'amistoso',
        rival: match?.rival || 'Rival',
        matchState: {
          round: match?.round || 'amistoso',
          rivalName: match?.rival || 'Rival',
          quarter,
          score: { home: score('home'), away: score('away') },
          events: currentEvents
        }
      };

      await fetch(club.dtSpreadsheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncStatus(`✅ Sincronizado con Sheets a las ${timeStr} hs`);
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
      {TRACKER_ACTIONS.map(([type, icon, label]) => (
        <button
          key={type}
          onClick={() => (type === 'corner' || type === 'stroke' ? addSetPiece(team, type) : addEvent(team, type))}
        >
          <span>{icon}</span>
          <strong>{label}</strong>
          <small>{count(team, type)} en partido</small>
          <b>+1</b>
        </button>
      ))}
      <div className="tracker-cards">
        <span>Tarjetas</span>
        {['green', 'yellow', 'red'].map(card => (
          <button key={card} onClick={() => addEvent(team, card)}>
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
        <span className="kicker">BOTONERA DT · {club.shortName || club.name}</span>
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
        <button className="refresh" onClick={loadMatches}>
          Actualizar Fixture
        </button>
        {club.dtSpreadsheetUrl && (
          <button
            type="button"
            className="secondary sync-sheets-btn"
            onClick={syncWithSheets}
            disabled={isSyncing}
          >
            {isSyncing ? 'Sincronizando...' : '☁️ Sincronizar en Sheets'}
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
          <span className="kicker">{match?.round || 'PARTIDO MANUAL'}</span>
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
        <button onClick={() => setEvents(current => current.slice(0, -1))}>
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
              <small>{event.type}</small>
            </div>
          ))
        ) : (
          <p className="empty-state">Todavía no hay incidencias registradas en este partido.</p>
        )}
      </div>
    </section>
  );
}

