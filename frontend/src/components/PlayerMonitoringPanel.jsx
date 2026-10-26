import { useEffect, useMemo, useState } from 'react';

const CATEGORY_LABELS = { primera: '1ra División', intermedia: 'Intermedia', '5ta': '5ta División' };
const METRICS = [
  { key: 'sleep', label: 'Calidad del sueño', low: 'Muy mala', high: 'Muy buena', positive: true },
  { key: 'fatigue', label: 'Fatiga', low: 'Ninguna', high: 'Muy alta', positive: false },
  { key: 'muscleSoreness', label: 'Dolor muscular', low: 'Ninguno', high: 'Muy alto', positive: false },
  { key: 'stress', label: 'Estrés', low: 'Muy bajo', high: 'Muy alto', positive: false },
  { key: 'mood', label: 'Estado de ánimo', low: 'Muy malo', high: 'Muy bueno', positive: true }
];

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function disposition(record) {
  const raw = METRICS.map(metric => Number(record[metric.key]));
  if (raw.some(value => !Number.isFinite(value))) return null;
  const score = raw.reduce((sum, value, index) => sum + (METRICS[index].positive ? value : 6 - value), 0) / raw.length;
  return Math.round(score * 20);
}

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function PlayerMonitoringPanel({ club, authenticated, monitoring = { wellness: [], loads: [] }, onRefresh }) {
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState('');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState(authenticated ? 'analysis' : 'submit');
  const [formKind, setFormKind] = useState('wellness');
  const [date, setDate] = useState(localDate);
  const [wellness, setWellness] = useState(Object.fromEntries(METRICS.map(metric => [metric.key, ''])));
  const [durationMinutes, setDurationMinutes] = useState('');
  const [perceivedEffort, setPerceivedEffort] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    setTab(authenticated ? 'analysis' : 'submit');
  }, [authenticated]);

  useEffect(() => {
    fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}&dataset=player-portal`, { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el plantel.');
        const activePlayers = payload.players || [];
        setPlayers(activePlayers);
        if (activePlayers.length) {
          setPlayerId(String(activePlayers[0].id));
          setCategory(activePlayers[0].categories?.[0] || '');
        }
      })
      .catch(error => setStatus(error.message));
  }, [club.slug]);

  const selectedPlayer = players.find(player => String(player.id) === playerId);
  const categories = selectedPlayer?.categories || [];
  const visibleWellness = useMemo(() => (monitoring.wellness || []).filter(row => filterCategory === 'all' || row.team_category === filterCategory), [monitoring.wellness, filterCategory]);
  const visibleLoads = useMemo(() => (monitoring.loads || []).filter(row => filterCategory === 'all' || row.team_category === filterCategory), [monitoring.loads, filterCategory]);
  const today = localDate();
  const wellnessToday = visibleWellness.filter(row => String(row.response_date).slice(0, 10) === today);
  const loadsToday = visibleLoads.filter(row => String(row.training_date).slice(0, 10) === today);
  const activePlayerCount = players.filter(player => filterCategory === 'all' || player.categories.includes(filterCategory)).length;
  const readinessAverage = wellnessToday.length
    ? Math.round(wellnessToday.reduce((sum, row) => sum + disposition(row), 0) / wellnessToday.length)
    : null;

  function onPlayerChange(event) {
    const nextId = event.target.value;
    const nextPlayer = players.find(player => String(player.id) === nextId);
    setPlayerId(nextId);
    setCategory(nextPlayer?.categories?.[0] || '');
  }

  async function submit(event) {
    event.preventDefault();
    setStatus('');
    if (!playerId || !category) {
      setStatus('Elegí tu nombre y categoría para continuar.');
      return;
    }
    const body = {
      action: 'save-player-monitoring', playerId, category, date, kind: formKind,
      ...(formKind === 'wellness' ? wellness : { durationMinutes, perceivedEffort })
    };
    setSaving(true);
    try {
      const response = await fetch(`/api/club-data?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la respuesta.');
      setStatus(formKind === 'wellness'
        ? 'Wellness guardado. Gracias por responder.'
        : `Carga guardada: ${payload.load} unidades (minutos × esfuerzo). Gracias por responder.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!authenticated) {
    return (
      <section className="monitoring-panel">
        <header className="monitoring-hero">
          <div><span className="kicker">SEGUIMIENTO DEL PLANTEL</span><h2>Tu registro</h2><p>Elegí tu nombre y completá el formulario. Tus respuestas individuales solo las ve el cuerpo técnico.</p></div>
        </header>
        <form className="monitoring-form" onSubmit={submit}>
          <div className="monitoring-form-heading"><h3>Registrar respuesta</h3><span>Sin cuenta · respuesta privada</span></div>
          <div className="monitoring-fields">
            <label>Tu nombre<select value={playerId} onChange={onPlayerChange} required>
              <option value="">Seleccioná tu nombre</option>
              {players.map(player => <option value={player.id} key={player.id}>{player.name}</option>)}
            </select></label>
            <label>Categoría<select value={category} onChange={event => setCategory(event.target.value)} required disabled={categories.length <= 1}>
              {categories.map(item => <option key={item} value={item}>{CATEGORY_LABELS[item] || item}</option>)}
              {!categories.length && <option value="">Sin categoría asignada</option>}
            </select></label>
            <label>Fecha<input type="date" value={date} max={today} onChange={event => setDate(event.target.value)} required /></label>
          </div>
          <div className="monitoring-kind-tabs" role="tablist" aria-label="Tipo de registro">
            <button type="button" className={formKind === 'wellness' ? 'active' : ''} onClick={() => { setFormKind('wellness'); setStatus(''); }}>Wellness · antes</button>
            <button type="button" className={formKind === 'load' ? 'active' : ''} onClick={() => { setFormKind('load'); setStatus(''); }}>Esfuerzo · después</button>
          </div>
          {formKind === 'wellness' ? (
            <div className="wellness-question-list">
              {METRICS.map(metric => (
                <fieldset className="wellness-question" key={metric.key}>
                  <legend>{metric.label}</legend>
                  <div className="wellness-scale-hints"><span>1 · {metric.low}</span><span>5 · {metric.high}</span></div>
                  <div className="wellness-options">
                    {[1, 2, 3, 4, 5].map(value => <label key={value} className={Number(wellness[metric.key]) === value ? 'selected' : ''}>
                      <input type="radio" name={metric.key} value={value} required={value === 1} checked={Number(wellness[metric.key]) === value} onChange={() => setWellness(current => ({ ...current, [metric.key]: value }))} />{value}
                    </label>)}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : (
            <div className="load-entry-card">
              <p>Contanos cómo sentiste el entrenamiento de hoy. La carga se calcula como minutos × esfuerzo percibido.</p>
              <label>Duración del entrenamiento (minutos)<input type="number" min="1" max="360" step="1" value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} placeholder="Ej.: 90" required /></label>
              <fieldset className="wellness-question load-effort-question">
                <legend>Esfuerzo percibido</legend><div className="wellness-scale-hints"><span>1 · Muy suave</span><span>10 · Máximo</span></div>
                <div className="wellness-options effort-options">{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <label key={value} className={Number(perceivedEffort) === value ? 'selected' : ''}>
                  <input type="radio" name="perceivedEffort" value={value} required={value === 1} checked={Number(perceivedEffort) === value} onChange={() => setPerceivedEffort(value)} />{value}
                </label>)}</div>
              </fieldset>
              <div className="load-preview">Carga de la sesión <strong>{durationMinutes && perceivedEffort ? Number(durationMinutes) * Number(perceivedEffort) : '—'}</strong> <small>unidades arbitrarias</small></div>
            </div>
          )}
          {status && <p className={`monitoring-status${/guardado|gracias/i.test(status) ? ' success' : ' error'}`} role="status">{status}</p>}
          <button className="monitoring-submit" type="submit" disabled={saving || !players.length}>{saving ? 'Guardando…' : 'Guardar respuesta'}</button>
        </form>
        <p className="monitoring-privacy">Los registros no muestran datos de otras jugadoras. Si necesitás corregir una respuesta del día, podés volver a enviarla.</p>
      </section>
    );
  }

  return (
    <section className="monitoring-panel">
      <header className="monitoring-hero">
        <div><span className="kicker">SEGUIMIENTO DEL PLANTEL</span><h2>Wellness, cargas y disponibilidad</h2><p>Las jugadoras cargan sus respuestas desde el formulario público. El detalle del plantel solo está disponible para el cuerpo técnico.</p></div>
        <div className="monitoring-tools"><label className="monitoring-filter">Categoría<select value={filterCategory} onChange={event => setFilterCategory(event.target.value)}><option value="all">Todas</option>{Object.entries(CATEGORY_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><button type="button" className="secondary" onClick={onRefresh}>Actualizar respuestas</button></div>
      </header>
      <div className="monitoring-staff-tabs" role="tablist" aria-label="Seguimiento del plantel">
        {[['analysis', 'Análisis'], ['wellness', 'Wellness'], ['load', 'Control de cargas']].map(([id, label]) => <button type="button" className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === 'analysis' ? (
        <>
          <div className="monitoring-stats-grid">
            <article><span>PLANTEL</span><strong>{activePlayerCount}</strong><small>jugadoras activas</small></article>
            <article><span>WELLNESS HOY</span><strong>{wellnessToday.length}/{activePlayerCount}</strong><small>respuestas recibidas</small></article>
            <article><span>DISPOSICIÓN PROMEDIO</span><strong>{readinessAverage === null ? '—' : `${readinessAverage}%`}</strong><small>{readinessAverage === null ? 'sin respuestas hoy' : 'escala orientativa'}</small></article>
            <article><span>CARGAS HOY</span><strong>{loadsToday.length}/{activePlayerCount}</strong><small>registros recibidos</small></article>
          </div>
          <div className="monitoring-dashboard-grid">
            <section className="monitoring-card"><h3>Respuestas de wellness de hoy</h3>{wellnessToday.length ? <div className="monitoring-response-list">{wellnessToday.map(row => <div key={row.id}><span><strong>{row.player_name}</strong><small>{CATEGORY_LABELS[row.team_category]} · disposición</small></span><b className={disposition(row) < 60 ? 'alert' : ''}>{disposition(row)}%</b></div>)}</div> : <p>Todavía no hay respuestas de wellness para hoy.</p>}</section>
            <section className="monitoring-card"><h3>Cargas de hoy</h3>{loadsToday.length ? <div className="monitoring-response-list">{loadsToday.map(row => <div key={row.id}><span><strong>{row.player_name}</strong><small>{row.duration_minutes} min · esfuerzo {row.perceived_effort}/10</small></span><b>{row.load} UA</b></div>)}</div> : <p>Todavía no hay cargas registradas hoy.</p>}</section>
          </div>
        </>
      ) : tab === 'wellness' ? (
        <section className="monitoring-card"><div className="section-heading"><div><h3>Registros de wellness</h3><p>La disposición combina métricas de bienestar; es una referencia para el seguimiento, no un diagnóstico.</p></div></div>
          {visibleWellness.length ? <div className="monitoring-table-wrap"><table className="monitoring-table"><thead><tr><th>Fecha</th><th>Jugadora</th><th>Categoría</th><th>Sueño</th><th>Fatiga</th><th>Dolor</th><th>Estrés</th><th>Ánimo</th><th>Disp.</th></tr></thead><tbody>{visibleWellness.map(row => <tr key={row.id}><td>{displayDate(row.response_date)}</td><td>{row.player_name}</td><td>{CATEGORY_LABELS[row.team_category]}</td><td>{row.sleep}/5</td><td>{row.fatigue}/5</td><td>{row.muscle_soreness}/5</td><td>{row.stress}/5</td><td>{row.mood}/5</td><td>{disposition(row)}%</td></tr>)}</tbody></table></div> : <p>Todavía no hay respuestas de wellness para mostrar.</p>}
        </section>
      ) : (
        <section className="monitoring-card"><div className="section-heading"><div><h3>Control de cargas</h3><p>Carga por sesión calculada como minutos × esfuerzo percibido (RPE).</p></div></div>
          {visibleLoads.length ? <div className="monitoring-table-wrap"><table className="monitoring-table"><thead><tr><th>Fecha</th><th>Jugadora</th><th>Categoría</th><th>Duración</th><th>Esfuerzo</th><th>Carga</th></tr></thead><tbody>{visibleLoads.map(row => <tr key={row.id}><td>{displayDate(row.training_date)}</td><td>{row.player_name}</td><td>{CATEGORY_LABELS[row.team_category]}</td><td>{row.duration_minutes} min</td><td>{row.perceived_effort}/10</td><td>{row.load} UA</td></tr>)}</tbody></table></div> : <p>Todavía no hay cargas registradas.</p>}
        </section>
      )}
      <section className="monitoring-card monitoring-player-shortlist"><h3>Plantel · {players.length}</h3><div>{players.filter(player => filterCategory === 'all' || player.categories.includes(filterCategory)).map(player => {
        const last = visibleWellness.find(row => row.playerId === String(player.id));
        return <span key={player.id}><b>{player.name}</b><small>{last ? `Wellness ${disposition(last)}% · ${displayDate(last.response_date)}` : 'Sin wellness cargado'}</small></span>;
      })}</div></section>
    </section>
  );
}
