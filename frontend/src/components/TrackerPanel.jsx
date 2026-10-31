import { useEffect, useState } from 'react';
import { CircleDot, Goal, Target, ArrowDownToLine } from 'lucide-react';
import { EVENT_LABELS } from '../utils/eventLabels';

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
  nextMatch,
  loadMatches,
  authenticated
}) {
  const [matchIndex, setMatchIndex] = useState(-1);
  const [quarter, setQuarter] = useState(1);
  const [teamView, setTeamView] = useState('both');
  const [authStatus, setAuthStatus] = useState('');
  const [eventFlow, setEventFlow] = useState(null);
  const [eventFlowError, setEventFlowError] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [flash, setFlash] = useState('');

  const storageKey = `club_tracker_${club.slug}`;
  const match = matches[matchIndex];
  const matchLabel = match?.round || 'PARTIDO MANUAL';
  const matchKey = match?.round || 'amistoso';
  const expectedCallupMatchKey = `primera-${matchKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const matchCalledUpPlayers = match && callupMatchKey === expectedCallupMatchKey
    ? [...calledUpPlayers].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    : [];

  // Cargar estado inicial desde localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (saved.quarter) setQuarter(saved.quarter);
    } catch (_) {}
  }, [storageKey]);

  useEffect(() => {
    if (!matches.length) {
      setMatchIndex(-1);
      return;
    }
    const nextIndex = nextMatch
      ? matches.findIndex(item => item.round === nextMatch.round && item.rival === nextMatch.rival && item.fecha === nextMatch.fecha)
      : -1;
    setMatchIndex(nextIndex >= 0 ? nextIndex : matches.findIndex(item => !item.played));
    setSaveStatus('');
  }, [matches, nextMatch]);

  // Persistir en localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      delete saved.seconds;
      localStorage.setItem(storageKey, JSON.stringify({ ...saved, quarter }));
    } catch (_) {}
  }, [quarter, storageKey]);

  const currentEvents = events.filter(event => (event.matchKey || event.match || 'amistoso') === matchKey);

  const score = team =>
    currentEvents.filter(
      event => event.team === team && ['cornerGoal', 'strokeGoal', 'fieldGoal'].includes(event.type)
    ).length;

  const count = (team, type) =>
    currentEvents.filter(event => event.team === team && event.type === type).length;

  const countQuarter = (team, type) =>
    currentEvents.filter(event => event.team === team && event.type === type && Number(event.quarter) === Number(quarter)).length;

  const addEvent = async (team, type, details = {}, actionId = '') => {
    if (savingEvent) return false;
    setSavingEvent(true);
    setSaveStatus('Guardando incidencia...');
    setAuthStatus('');
    const newEvent = {
      id: `${Date.now()}-${Math.random()}`,
      match: matchKey,
      matchKey,
      quarter,
      team,
      type,
      ...details,
      actionId: actionId || details.actionId || `action-${Date.now()}-${Math.random()}`,
      at: new Date().toISOString()
    };
    try {
      await onPersistEvent(newEvent, match?.rival);
      setEvents(current => [...current, newEvent]);
      setSaveStatus(`Guardado en la base de datos · ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`);
      return true;
    } catch (error) {
      setSaveStatus('No se pudo guardar la incidencia.');
      setAuthStatus(error.message);
      return false;
    } finally {
      setSavingEvent(false);
    }
  };

  const beginAction = (team, type) => {
    setFlash(`${team}-${type}`);
    setTimeout(() => setFlash(''), 450);
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
      actionId: `action-${Date.now()}-${Math.random()}`,
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
        const saved = await addEvent(eventFlow.team, eventFlow.type, eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {}, eventFlow.actionId);
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
      const attemptSaved = await addEvent(eventFlow.team, eventFlow.type, eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {}, eventFlow.actionId);
      if (!attemptSaved) return;
    }
    const details = {
      player: eventFlow.scorer.trim(),
      actionId: eventFlow.actionId,
      ...(eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {})
    };
    const goalSaved = await addEvent(eventFlow.team, eventFlow.type === 'fieldGoal' ? 'fieldGoal' : `${eventFlow.type}Goal`, details, eventFlow.actionId);
    if (goalSaved) setEventFlow(null);
  };

  const resetMatch = () => {
    if (window.confirm('¿Reiniciar los datos de este partido?')) {
      const removed = currentEvents;
      if (!removed.length) return;
      setSavingEvent(true);
      setSaveStatus('Eliminando incidencias del partido...');
      onDeleteEvent(removed.map(event => event.id)).then(() => {
        const removedIds = new Set(removed.map(event => event.id));
        setEvents(current => current.filter(event => !removedIds.has(event.id)));
        setSaveStatus('Partido reiniciado y cambios guardados.');
        setQuarter(1);
      }).catch(error => {
        setSaveStatus('No se pudieron eliminar las incidencias.');
        setAuthStatus(error.message);
      }).finally(() => setSavingEvent(false));
    }
  };

  const undoLastAction = async () => {
    const lastEvent = currentEvents.at(-1);
    if (!lastEvent || savingEvent) return;
    const actionEvents = lastEvent.actionId
      ? currentEvents.filter(event => event.actionId === lastEvent.actionId)
      : [lastEvent];
    setSavingEvent(true);
    setAuthStatus('');
    setSaveStatus('Deshaciendo la última acción...');
    try {
      await onDeleteEvent(actionEvents.map(event => event.id));
      const removedIds = new Set(actionEvents.map(event => event.id));
      setEvents(current => current.filter(event => !removedIds.has(event.id)));
      setSaveStatus('Última acción eliminada y cambio guardado.');
    } catch (error) {
      setSaveStatus('No se pudo deshacer la última acción.');
      setAuthStatus(error.message);
    } finally {
      setSavingEvent(false);
    }
  };

  const renderTeam = (team, name) => (
    <div className={`tracker-team ${team}`}>
      <h3>{name}</h3>
      <div className="tracker-event-grid">
        {TRACKER_ACTIONS.map(([type, Icon, label]) => (
          <button
            type="button"
            key={type}
            className={flash === `${team}-${type}` ? 'flash' : ''}
            onClick={() => beginAction(team, type)}
            disabled={savingEvent}
            aria-label={`${label}, ${quarter}° cuarto: ${countQuarter(team, type)}. Sumar uno`}
          >
            <span className="tracker-event-icon"><Icon aria-hidden="true" /></span>
            <strong>{label}</strong>
            <b>{countQuarter(team, type)}</b>
            <small>Total {count(team, type)}</small>
          </button>
        ))}
      </div>
      <div className="tracker-cards">
        <span>Tarjetas</span>
        {['green', 'yellow', 'red'].map(card => (
          <button type="button" key={card} onClick={() => beginAction(team, card)} disabled={savingEvent}>
            {card === 'green' ? '🟩' : card === 'yellow' ? '🟨' : '🟥'} {countQuarter(team, card)} <small>de {count(team, card)}</small>
          </button>
        ))}
      </div>
    </div>
  );

  if (!authenticated) {
    return (
      <section className="tracker-panel">
        <div className="tracker-hero">
          <h2>Acceso del cuerpo técnico</h2>
          <p>Ingresá con tu cuenta Google invitada desde “Acceso cuerpo técnico” para registrar incidencias en tiempo real.</p>
        </div>
      </section>
    );
  }

  const homeName = club.shortName || club.name;
  const awayName = match?.rival || 'Rival';
  const lastEvent = currentEvents.at(-1);

  return (
    <section className={`tracker-panel${teamView === 'away' ? ' viewing-away' : ''}`}>
      <div className="tracker-live">
        <div className="tracker-scoreline" aria-live="polite">
          <span>{homeName}</span>
          <b>{score('home')} - {score('away')}</b>
          <span>{awayName}</span>
        </div>
        <div className="tracker-controls">
          <div className="tracker-quarters" role="group" aria-label="Cuarto">
            {[1, 2, 3, 4].map(item => (
              <button type="button" className={quarter === item ? 'active' : ''} aria-pressed={quarter === item} onClick={() => setQuarter(item)} key={item}>{item}°</button>
            ))}
          </div>
          <div className="tracker-team-view" role="group" aria-label="Equipo">
            {[['home', homeName], ['away', awayName], ['both', 'Ambos']].map(([team, label]) => (
              <button type="button" data-team={team} className={teamView === team ? 'active' : ''} aria-pressed={teamView === team} onClick={() => setTeamView(team)} key={team}>{label}</button>
            ))}
          </div>
          <button type="button" className="tracker-undo" onClick={undoLastAction} disabled={!currentEvents.length || savingEvent}>
            ↩ Deshacer
          </button>
        </div>
        <p className="tracker-status-line" role="status" aria-live="polite">{authStatus ? '' : saveStatus}</p>
      </div>

      {authStatus && (
        <div className="tracker-save-status is-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>{saveStatus && <strong>{saveStatus}</strong>}<small>{authStatus}</small></div>
        </div>
      )}

      <div className={`tracker-grid${teamView === 'both' ? '' : ' single-team'}`}>
        {(teamView === 'home' || teamView === 'both') && renderTeam('home', homeName)}
        {(teamView === 'away' || teamView === 'both') && renderTeam('away', awayName)}
      </div>

      <details className="tracker-setup">
        <summary>
          <strong>{matchLabel}{match?.rival ? ` · vs ${match.rival}` : ''}</strong>
          <small>{match?.fecha || 'Sin fecha'} · {match?.homeAway || 'Local'} · Cambiar partido</small>
        </summary>
        <div className="tracker-toolbar">
          <select aria-label="Partido" value={matchIndex} onChange={event => { setMatchIndex(Number(event.target.value)); setSaveStatus(''); setAuthStatus(''); setEventFlow(null); }}>
            <option value={-1}>Amistoso / partido manual</option>
            {matches.map((item, index) => (
              <option value={index} key={`${item.round}-${index}`}>
                {item.round} · {item.rival} · {item.fecha}
              </option>
            ))}
          </select>
          <button type="button" className="refresh" onClick={() => loadMatches('1')}>Actualizar fixture</button>
        </div>
      </details>

      <details className="tracker-feed">
        <summary>
          <strong>Incidencias ({currentEvents.length})</strong>
          <small>{lastEvent ? `Última: ${EVENT_LABELS[lastEvent.type] || lastEvent.type}, ${lastEvent.quarter}° cuarto` : 'Todavía no hay incidencias'}</small>
        </summary>
        {currentEvents.length ? (
          [...currentEvents].reverse().map(event => (
            <div key={event.id}>
              <span>{event.quarter}° cuarto</span>
              <strong>{event.team === 'home' ? homeName : awayName}</strong>
              <small>{EVENT_LABELS[event.type] || event.type}{event.player ? ` · Gol: ${event.player}` : ''}{event.generatedBy ? ` · Generó: ${event.generatedBy}` : ''}</small>
            </div>
          ))
        ) : (
          <p className="empty-state">Todavía no hay incidencias registradas en este partido.</p>
        )}
        <button type="button" className="secondary tracker-reset" onClick={resetMatch} disabled={savingEvent || !currentEvents.length}>Borrar incidencias del partido</button>
      </details>

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
                  <button type="button" disabled={savingEvent} onClick={async () => {
                    if (eventFlow.team === 'away') {
                      const attemptSaved = await addEvent(eventFlow.team, eventFlow.type, {}, eventFlow.actionId);
                      if (attemptSaved) {
                        const goalSaved = await addEvent(eventFlow.team, `${eventFlow.type}Goal`, {}, eventFlow.actionId);
                        if (goalSaved) setEventFlow(null);
                      }
                    } else {
                      setEventFlow(current => ({ ...current, goal: true, step: 'scorer' }));
                    }
                  }}>Sí, fue gol</button>
                  <button type="button" className="secondary" disabled={savingEvent} onClick={async () => {
                    const saved = await addEvent(eventFlow.team, eventFlow.type, eventFlow.generatedBy ? { generatedBy: eventFlow.generatedBy } : {}, eventFlow.actionId);
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
            {eventFlow.step !== 'outcome' && <button type="submit" disabled={savingEvent}>{savingEvent ? 'Guardando...' : 'Continuar'}</button>}
            <button type="button" className="secondary" onClick={() => { setEventFlow(null); setEventFlowError(''); }}>Cancelar</button>
          </form>
        </div>
      )}
    </section>
  );
}

