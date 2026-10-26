import { useState } from 'react';
import { Goal, Zap, Shield, Timer } from 'lucide-react';
import { calculateQuarterStats } from '../utils/statsCalculator';

export default function EstadisticasPanel({
  club,
  events = [],
  matches = [],
  authenticated,
  onAuthenticate
}) {
  const [selectedMatch, setSelectedMatch] = useState('all');
  const [activeTab, setActiveTab] = useState('quarters'); // 'quarters' | 'trends' | 'timeline'
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar eventos por partido seleccionado
  const filteredEvents = selectedMatch === 'all'
    ? events
    : events.filter(e => (e.match || 'amistoso') === selectedMatch);

  // Obtener partidos únicos presentes en las incidencias
  const matchOptions = Array.from(new Set(events.map(e => e.match || 'amistoso')));

  // Calcular estadísticas
  const { quarters, insights, halves } = calculateQuarterStats(filteredEvents);

  async function handleLogin(e) {
    e.preventDefault();
    if (!password) return;
    setIsSubmitting(true);
    setAuthError('');
    try {
      const response = await fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Contraseña incorrecta');
      }
      await onAuthenticate(data.token);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!authenticated) {
    return (
      <section className="stats-panel">
        <div className="stats-hero">
          <span className="kicker">ANÁLISIS TÁCTICO · {club.shortName || club.name}</span>
          <h2>Acceso a Estadísticas Avanzadas</h2>
          <p>Ingresá la clave del cuerpo técnico para visualizar métricas por cuartos, efectividad en cortos y tendencias.</p>
        </div>
        <form className="tracker-login" onSubmit={handleLogin}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña del cuerpo técnico"
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Verificando...' : 'Acceder'}
          </button>
        </form>
        {authError && <p className="message">{authError}</p>}
      </section>
    );
  }

  const homeName = club.shortName || club.name;
  const awayName = selectedMatch !== 'all'
    ? (matches.find(m => m.round === selectedMatch)?.rival || 'Rival')
    : 'Rivales (Acumulado)';

  return (
    <section className="stats-panel">
      <div className="stats-hero">
        <span className="kicker">ESTADÍSTICAS DT · {homeName}</span>
        <h2>Rendimiento táctico por cuartos</h2>
        <p>Análisis de efectividad en ingresos al área, córners cortos y evolución durante el partido.</p>
      </div>

      <div className="stats-toolbar">
        <div className="stats-selector-box">
          <label htmlFor="select-stats-match">Seleccionar partido a analizar:</label>
          <select
            id="select-stats-match"
            value={selectedMatch}
            onChange={e => setSelectedMatch(e.target.value)}
          >
            <option value="all">🌟 Todos los partidos (Acumulado General - {events.length} incidencias)</option>
            {matchOptions.map(key => {
              const count = events.filter(e => (e.match || 'amistoso') === key).length;
              const matchObj = matches.find(m => m.round === key);
              const label = matchObj ? `${key} vs ${matchObj.rival}` : key;
              return (
                <option key={key} value={key}>
                  {label} ({count} incidencias)
                </option>
              );
            })}
          </select>
        </div>

        <div className="stats-subtabs">
          <button
            className={activeTab === 'quarters' ? 'active' : ''}
            onClick={() => setActiveTab('quarters')}
          >
            📊 Cuartos
          </button>
          <button
            className={activeTab === 'trends' ? 'active' : ''}
            onClick={() => setActiveTab('trends')}
          >
            📈 Tendencias 1T vs 2T
          </button>
          <button
            className={activeTab === 'timeline' ? 'active' : ''}
            onClick={() => setActiveTab('timeline')}
          >
            <Timer aria-hidden="true" /> Cronología ({filteredEvents.length})
          </button>
        </div>
      </div>

      {/* Resumen rápido de métricas */}
      <div className="stats-summary-grid">
        <div className="stats-summary-card">
          <span>MARCADOR GLOBAL</span>
          <strong>{quarters.total.home.goals} - {quarters.total.away.goals}</strong>
          <small>{homeName} vs {awayName}</small>
        </div>
        <div className="stats-summary-card">
          <span>INGRESOS AL ÁREA</span>
          <strong>{quarters.total.home.entries} <small>vs</small> {quarters.total.away.entries}</strong>
          <small>Conversión propia: {quarters.total.home.conversion}%</small>
        </div>
        <div className="stats-summary-card">
          <span>CÓRNERS CORTOS</span>
          <strong>{quarters.total.home.corners} <small>({quarters.total.home.cornerGoals} goles)</small></strong>
          <small>Efectividad: {quarters.total.home.cornerEff}%</small>
        </div>
        <div className="stats-summary-card">
          <span>PENALES (STROKES)</span>
          <strong>{quarters.total.home.strokes} <small>({quarters.total.home.strokeGoals} goles)</small></strong>
          <small>Efectividad: {quarters.total.home.strokeEff}%</small>
        </div>
      </div>

      {activeTab === 'quarters' && (
        <div className="stats-tab-content">
          {/* Insights tácticos */}
          <div className="tactical-insights">
            <div className="insight-card">
              <span className="insight-icon"><Goal /></span>
              <div>
                <strong>Mejor cuarto ofensivo</strong>
                <p>
                  {insights.bestQByGoals.val > 0
                    ? `${insights.bestQByGoals.q}° Cuarto (${insights.bestQByGoals.val} goles marcados)`
                    : 'Aún no se registraron goles'}
                </p>
              </div>
            </div>
            <div className="insight-card">
              <span className="insight-icon"><Zap /></span>
              <div>
                <strong>Mayor volumen de ataque</strong>
                <p>
                  {insights.bestQByEntries.val > 0
                    ? `${insights.bestQByEntries.q}° Cuarto (${insights.bestQByEntries.val} ingresos al área)`
                    : 'Sin registros de ingresos'}
                </p>
              </div>
            </div>
            <div className="insight-card">
              <span className="insight-icon"><Shield /></span>
              <div>
                <strong>Cuarto defensivo más exigido</strong>
                <p>
                  {insights.hardestQDef.val > 0
                    ? `${insights.hardestQDef.q}° Cuarto (${insights.hardestQDef.val} ingresos del rival)`
                    : 'Sin ingresos rivales registrados'}
                </p>
              </div>
            </div>
          </div>

          {/* Tabla de análisis por cuartos */}
          <div className="stats-table-wrap">
            <table className="stats-quarter-table">
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th>1° Cuarto</th>
                  <th>2° Cuarto</th>
                  <th>3° Cuarto</th>
                  <th>4° Cuarto</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>⚽ Goles ({homeName} - Rival)</strong></td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q} className="stat-highlight">
                      {quarters[q].home.goals} - {quarters[q].away.goals}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>📥 Ingresos al Área ({homeName})</td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q}>{quarters[q].home.entries}</td>
                  ))}
                </tr>
                <tr>
                  <td>📥 Ingresos al Área (Rival)</td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q}>{quarters[q].away.entries}</td>
                  ))}
                </tr>
                <tr>
                  <td>🏑 Córners Cortos ({homeName})</td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q}>
                      {quarters[q].home.corners}
                      {quarters[q].home.corners > 0 && (
                        <small className="eff-tag"> ({quarters[q].home.cornerEff}%)</small>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>🏑 Córners Cortos (Rival)</td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q}>
                      {quarters[q].away.corners}
                      {quarters[q].away.corners > 0 && (
                        <small className="eff-tag"> ({quarters[q].away.cornerEff}%)</small>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>🎯 Penales ({homeName})</td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q}>
                      {quarters[q].home.strokes} ({quarters[q].home.strokeGoals}G)
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>🟨 Tarjetas Recibidas</td>
                  {[1, 2, 3, 4, 'total'].map(q => (
                    <td key={q}>
                      🟩 {quarters[q].home.green} | 🟨 {quarters[q].home.yellow} | 🟥 {quarters[q].home.red}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="stats-tab-content">
          <div className="halves-comparison-grid">
            <div className="half-card">
              <h3>Primer Tiempo (1°C + 2°C)</h3>
              <div className="half-metric">
                <span>Goles marcados:</span>
                <strong>{halves.half1.home.goals} - {halves.half1.away.goals}</strong>
              </div>
              <div className="half-metric">
                <span>Ingresos al área:</span>
                <strong>{halves.half1.home.entries} vs {halves.half1.away.entries}</strong>
              </div>
              <div className="half-metric">
                <span>Córners cortos:</span>
                <strong>{halves.half1.home.corners} ({halves.half1.home.cornerGoals}G)</strong>
              </div>
            </div>

            <div className="half-card">
              <h3>Segundo Tiempo (3°C + 4°C)</h3>
              <div className="half-metric">
                <span>Goles marcados:</span>
                <strong>{halves.half2.home.goals} - {halves.half2.away.goals}</strong>
              </div>
              <div className="half-metric">
                <span>Ingresos al área:</span>
                <strong>{halves.half2.home.entries} vs {halves.half2.away.entries}</strong>
              </div>
              <div className="half-metric">
                <span>Córners cortos:</span>
                <strong>{halves.half2.home.corners} ({halves.half2.home.cornerGoals}G)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="stats-tab-content">
          <div className="timeline-list">
            {filteredEvents.length === 0 ? (
              <p className="empty-state">No hay incidencias registradas para este filtro.</p>
            ) : (
              [...filteredEvents].reverse().map(e => (
                <div key={e.id} className="timeline-item">
                  <span className="timeline-badge">{e.quarter}°C</span>
                  <div className="timeline-desc">
                    <strong>{e.team === 'home' ? homeName : awayName}</strong>
                    <span>{e.type}{e.player ? ` · Gol: ${e.player}` : ''}{e.generatedBy ? ` · Generó: ${e.generatedBy}` : ''}</span>
                  </div>
                  <small className="timeline-time">
                    {e.at ? new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </small>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

