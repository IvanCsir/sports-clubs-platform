import { useEffect, useState } from 'react';
import { Goal, Zap, Shield } from 'lucide-react';
import { calculateQuarterStats } from '../utils/statsCalculator';
import { EVENT_LABELS } from '../utils/eventLabels';

const TABS = [
  ['quarters', 'Por cuartos'],
  ['players', 'Jugadoras'],
  ['timeline', 'Cronología']
];

function calculatePlayerContributions(events) {
  const players = new Map();
  const generatedCornerActions = new Set();
  const getPlayer = name => {
    const displayName = String(name || '').trim();
    if (!displayName) return null;
    const key = displayName.toLocaleLowerCase('es');
    if (!players.has(key)) players.set(key, { name: displayName, fieldGoals: 0, cornerGoals: 0, strokeGoals: 0, cornersGenerated: 0 });
    return players.get(key);
  };

  for (const event of events) {
    if (event.team !== 'home') continue;
    const goalField = { fieldGoal: 'fieldGoals', cornerGoal: 'cornerGoals', strokeGoal: 'strokeGoals' }[event.type];
    if (goalField && event.player) getPlayer(event.player)[goalField]++;

    if (event.type === 'corner' && event.generatedBy) {
      const actionKey = event.actionId ? `action:${event.actionId}` : `event:${event.id}`;
      if (generatedCornerActions.has(actionKey)) continue;
      generatedCornerActions.add(actionKey);
      getPlayer(event.generatedBy).cornersGenerated++;
    }
  }

  return [...players.values()].sort((a, b) => {
    const aGoals = a.fieldGoals + a.cornerGoals + a.strokeGoals;
    const bGoals = b.fieldGoals + b.cornerGoals + b.strokeGoals;
    return bGoals - aGoals || b.cornersGenerated - a.cornersGenerated || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;

function CardCounts({ stats }) {
  return (
    <span className="stats-card-counts" aria-label={`${stats.green} verdes, ${stats.yellow} amarillas, ${stats.red} rojas`}>
      <span><i className="dot green" />{stats.green}</span>
      <span><i className="dot yellow" />{stats.yellow}</span>
      <span><i className="dot red" />{stats.red}</span>
    </span>
  );
}

export default function EstadisticasPanel({
  club,
  events = [],
  tournaments = [],
  activeTournamentKey = '',
  matches = [],
  authenticated,
  onGoToTracker
}) {
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [selectedTournamentKey, setSelectedTournamentKey] = useState(activeTournamentKey);
  const [activeTab, setActiveTab] = useState('quarters');

  useEffect(() => {
    if (activeTournamentKey) setSelectedTournamentKey(activeTournamentKey);
  }, [activeTournamentKey]);

  useEffect(() => {
    setSelectedMatch('all');
  }, [selectedTournamentKey]);

  const selectedTournament = tournaments.find(tournament => tournament.key === selectedTournamentKey);
  const tournamentEvents = selectedTournament ? selectedTournament.events : events;

  const filteredEvents = selectedMatch === 'all'
    ? tournamentEvents
    : tournamentEvents.filter(e => (e.match || 'amistoso') === selectedMatch);
  const playerContributions = calculatePlayerContributions(filteredEvents);

  // Partidos únicos presentes en las incidencias
  const matchOptions = Array.from(new Set(tournamentEvents.map(e => e.match || 'amistoso')));

  const { quarters, insights, halves } = calculateQuarterStats(filteredEvents);

  if (!authenticated) {
    return (
      <section className="stats-panel">
        <div className="stats-hero">
          <h2>Estadísticas del equipo</h2>
          <p>Ingresá con tu cuenta Google invitada desde “Acceso cuerpo técnico” para ver las métricas por cuartos, la efectividad en cortos y las tendencias.</p>
        </div>
      </section>
    );
  }

  const homeName = club.shortName || club.name;
  const rivalOf = key => {
    const eventMatch = tournamentEvents.find(e => (e.match || 'amistoso') === key);
    return eventMatch?.opponent || matches.find(m => m.round === key)?.rival || '';
  };
  const awayName = selectedMatch !== 'all' ? (rivalOf(selectedMatch) || 'Rival') : 'Rivales';
  const total = quarters.total;
  const hasEvents = filteredEvents.length > 0;

  return (
    <section className="stats-panel">
      <div className="stats-toolbar">
        {tournaments.length > 1 && (
          <select
            aria-label="Torneo"
            value={selectedTournamentKey || activeTournamentKey}
            onChange={event => setSelectedTournamentKey(event.target.value)}
          >
            {tournaments.map(tournament => (
              <option key={tournament.key} value={tournament.key}>{tournament.label}</option>
            ))}
          </select>
        )}
        <select aria-label="Partido" value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}>
          <option value="all">Todos los partidos</option>
          {matchOptions.map(key => {
            const rival = rivalOf(key);
            return <option key={key} value={key}>{rival ? `${key} · vs ${rival}` : key}</option>;
          })}
        </select>
      </div>

      {!hasEvents ? (
        <div className="stats-empty">
          <strong>{tournamentEvents.length ? 'No hay incidencias para este partido' : 'Todavía no hay incidencias'}</strong>
          <p>Registralas en la Botonera durante el partido y acá vas a ver cómo rindió el equipo en cada cuarto.</p>
          {onGoToTracker && <button type="button" onClick={onGoToTracker}>Ir a la Botonera</button>}
        </div>
      ) : (
        <>
          <div className="stats-summary-grid">
            <div className="stats-summary-card">
              <span>Marcador</span>
              <strong>{total.home.goals} - {total.away.goals}</strong>
              <small>{homeName} vs {awayName}</small>
            </div>
            <div className="stats-summary-card">
              <span>Ingresos al área</span>
              <strong>{total.home.entries} <small>vs</small> {total.away.entries}</strong>
              <small>Conversión propia {total.home.conversion}%</small>
            </div>
            <div className="stats-summary-card">
              <span>Córners cortos</span>
              <strong>{total.home.corners}</strong>
              <small>{plural(total.home.cornerGoals, 'gol', 'goles')} · {total.home.cornerEff}% de efectividad</small>
            </div>
            <div className="stats-summary-card">
              <span>Penales</span>
              <strong>{total.home.strokes}</strong>
              <small>{plural(total.home.strokeGoals, 'gol', 'goles')} · {total.home.strokeEff}% de efectividad</small>
            </div>
          </div>

          <ul className="stats-highlights">
            <li>
              <Goal aria-hidden="true" />
              <span>Mejor cuarto ofensivo</span>
              <strong>{insights.bestQByGoals.val > 0 ? `${insights.bestQByGoals.q}° · ${plural(insights.bestQByGoals.val, 'gol', 'goles')}` : 'Sin goles todavía'}</strong>
            </li>
            <li>
              <Zap aria-hidden="true" />
              <span>Mayor volumen de ataque</span>
              <strong>{insights.bestQByEntries.val > 0 ? `${insights.bestQByEntries.q}° · ${plural(insights.bestQByEntries.val, 'ingreso', 'ingresos')}` : 'Sin ingresos todavía'}</strong>
            </li>
            <li>
              <Shield aria-hidden="true" />
              <span>Cuarto más exigido en defensa</span>
              <strong>{insights.hardestQDef.val > 0 ? `${insights.hardestQDef.q}° · ${plural(insights.hardestQDef.val, 'ingreso rival', 'ingresos rivales')}` : 'Sin ingresos rivales'}</strong>
            </li>
          </ul>

          <div className="segmented stats-tabs" role="group" aria-label="Vista de estadísticas">
            {TABS.map(([id, label]) => (
              <button type="button" key={id} className={activeTab === id ? 'active' : ''} aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}>
                {label}{id === 'timeline' ? ` (${filteredEvents.length})` : ''}
              </button>
            ))}
          </div>

          {activeTab === 'quarters' && (
            <div className="stats-tab-content">
              <div className="stats-table-wrap">
                <table className="stats-quarter-table">
                  <thead>
                    <tr>
                      <th scope="col">Por cuarto</th>
                      {['1°', '2°', '3°', '4°', 'Total'].map(label => <th scope="col" key={label}>{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Goles (a favor - en contra)</th>
                      {[1, 2, 3, 4, 'total'].map(q => (
                        <td key={q} className="stat-highlight">{quarters[q].home.goals} - {quarters[q].away.goals}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Ingresos al área</th>
                      {[1, 2, 3, 4, 'total'].map(q => <td key={q}>{quarters[q].home.entries}</td>)}
                    </tr>
                    <tr>
                      <th scope="row">Ingresos del rival</th>
                      {[1, 2, 3, 4, 'total'].map(q => <td key={q}>{quarters[q].away.entries}</td>)}
                    </tr>
                    <tr>
                      <th scope="row">Córners cortos</th>
                      {[1, 2, 3, 4, 'total'].map(q => (
                        <td key={q}>
                          {quarters[q].home.corners}
                          {quarters[q].home.corners > 0 && <small className="eff-tag"> ({quarters[q].home.cornerEff}%)</small>}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Córners del rival</th>
                      {[1, 2, 3, 4, 'total'].map(q => (
                        <td key={q}>
                          {quarters[q].away.corners}
                          {quarters[q].away.corners > 0 && <small className="eff-tag"> ({quarters[q].away.cornerEff}%)</small>}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Penales</th>
                      {[1, 2, 3, 4, 'total'].map(q => <td key={q}>{quarters[q].home.strokes} ({quarters[q].home.strokeGoals} gol)</td>)}
                    </tr>
                    <tr>
                      <th scope="row">Tarjetas</th>
                      {[1, 2, 3, 4, 'total'].map(q => <td key={q}><CardCounts stats={quarters[q].home} /></td>)}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="stats-table-wrap">
                <table className="stats-quarter-table stats-halves-table">
                  <thead>
                    <tr>
                      <th scope="col">Primer y segundo tiempo</th>
                      <th scope="col">1° tiempo</th>
                      <th scope="col">2° tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Goles (a favor - en contra)</th>
                      <td className="stat-highlight">{halves.half1.home.goals} - {halves.half1.away.goals}</td>
                      <td className="stat-highlight">{halves.half2.home.goals} - {halves.half2.away.goals}</td>
                    </tr>
                    <tr>
                      <th scope="row">Ingresos (a favor - en contra)</th>
                      <td>{halves.half1.home.entries} - {halves.half1.away.entries}</td>
                      <td>{halves.half2.home.entries} - {halves.half2.away.entries}</td>
                    </tr>
                    <tr>
                      <th scope="row">Córners cortos</th>
                      <td>{halves.half1.home.corners} ({halves.half1.home.cornerGoals} gol)</td>
                      <td>{halves.half2.home.corners} ({halves.half2.home.cornerGoals} gol)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'players' && (
            <div className="stats-tab-content">
              {playerContributions.length ? (
                <div className="stats-table-wrap">
                  <table className="stats-quarter-table stats-player-table">
                    <thead>
                      <tr>
                        <th scope="col">Jugadora</th>
                        <th scope="col">Gol de jugada</th>
                        <th scope="col">Gol de corto</th>
                        <th scope="col">Gol de penal</th>
                        <th scope="col">Goles</th>
                        <th scope="col">Cortos generados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerContributions.map(player => {
                        const totalGoals = player.fieldGoals + player.cornerGoals + player.strokeGoals;
                        return (
                          <tr key={player.name}>
                            <th scope="row">{player.name}</th>
                            <td>{player.fieldGoals}</td>
                            <td>{player.cornerGoals}</td>
                            <td>{player.strokeGoals}</td>
                            <td className="stat-highlight">{totalGoals}</td>
                            <td>{player.cornersGenerated}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">Todavía no hay goles ni córners con jugadoras identificadas en este partido.</p>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="stats-tab-content">
              <div className="timeline-list">
                {[...filteredEvents].reverse().map(e => (
                  <div key={e.id} className="timeline-item">
                    <span className="timeline-badge">{e.quarter}°</span>
                    <div className="timeline-desc">
                      <strong className={e.team === 'home' ? '' : 'is-away'}>{e.team === 'home' ? homeName : awayName}</strong>
                      <span>{EVENT_LABELS[e.type] || e.type}{e.player ? ` · Gol: ${e.player}` : ''}{e.generatedBy ? ` · Generó: ${e.generatedBy}` : ''}</span>
                    </div>
                    <small className="timeline-time">
                      {e.at ? new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
