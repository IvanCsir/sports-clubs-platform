import { useState } from 'react';
import { Activity, Trophy, UsersRound } from 'lucide-react';
import { postClubAction } from '../api';

const CATEGORY_OPTIONS = [['primera', '1ra División'], ['intermedia', 'Intermedia'], ['5ta', '5ta División']];
const FILTERS = [['all', 'Todas'], ['1ra', '1ra División'], ['Inter', 'Intermedia'], ['5ta', '5ta División']];
const TEST_AREAS = [['fuerza', 'Fuerza'], ['potencia', 'Potencia'], ['velocidad', 'Velocidad'], ['resistencia', 'Resistencia'], ['agilidad', 'Agilidad'], ['movilidad', 'Movilidad'], ['técnica', 'Técnica'], ['personalizada', 'Otra']];
const EMPTY_TEST_DRAFT = { name: '', category: 'fuerza', unit: '', direction: 'neutral', decimals: 2 };

function divisionLabel(filterTag) {
  return filterTag === 'Inter' ? 'Intermedia' : filterTag === '5ta' ? '5ta División' : '1ra División';
}

function normalizeSearch(value) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function average(values, decimals) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(decimals)) : null;
}

function formatDate(value, options) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR', options);
}

export default function PhysicalPanel({ club, authenticated, token, physicalPlayers, physicalTests, players, onReloadPhysical, onReloadStaff, onGoToRoster }) {
  const [mode, setMode] = useState('players');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [draft, setDraft] = useState({ playerId: '', category: 'primera', evaluatedOn: '', testKey: '', value: '' });
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [editingCatalog, setEditingCatalog] = useState(false);
  const [testDraft, setTestDraft] = useState(EMPTY_TEST_DRAFT);
  const [catalogError, setCatalogError] = useState('');

  const query = normalizeSearch(search);
  const visiblePlayers = physicalPlayers.filter(player =>
    (filter === 'all' || player.filterTag === filter) && (!query || normalizeSearch(player.name).includes(query))
  );
  const averages = physicalTests.filter(test => test.active !== false || visiblePlayers.some(player => player.tests[test.key])).map(test => {
    const values = visiblePlayers.map(player => player.tests[test.key]?.evals.at(-1)?.value).filter(value => value !== undefined);
    const maxRecordedRounds = Math.max(0, ...visiblePlayers.map(player => player.tests[test.key]?.evals.length || 0));
    const rounds = Array.from({ length: maxRecordedRounds }, (_, index) =>
      average(visiblePlayers.map(player => player.tests[test.key]?.evals[index]?.value).filter(value => value !== undefined), test.decimals)
    );
    return { ...test, latest: average(values, test.decimals), rounds };
  });
  const selected = physicalPlayers.find(player => player.id === selectedPlayer);
  const assessmentPlayers = players
    .filter(player => player.active && (player.categories || []).includes(draft.category))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const selectedTest = physicalTests.find(test => test.key === draft.testKey && test.active !== false);
  const recordedEntries = physicalPlayers
    .map(player => ({
      ...player,
      result: player.tests[draft.testKey]?.evals.find(evaluation => String(evaluation.evaluatedOn || '').slice(0, 10) === draft.evaluatedOn)
    }))
    .filter(player => player.result)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const playersWithResults = visiblePlayers.filter(player => Object.keys(player.tests || {}).length > 0).length;

  function updateDraft(changes) {
    setDraft(current => ({ ...current, ...changes }));
    setSaveSuccess('');
  }

  async function submitAssessment(event) {
    event.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    const resultValue = Number(draft.value);
    if (!selectedTest || !draft.playerId || !draft.evaluatedOn || draft.value === '' || !Number.isFinite(resultValue)) {
      setSaveError('Elegí la fecha, la prueba y la jugadora, y cargá un resultado.');
      return;
    }
    const results = [{ testKey: selectedTest.key, attempt: 1, rawValue: draft.value, value: resultValue, unit: selectedTest.unit || '' }];
    try {
      await postClubAction(club.slug, 'save-physical-assessment', {
        ...draft,
        name: assessmentPlayers.find(player => String(player.id) === String(draft.playerId))?.name || '',
        results
      }, { token, fallbackError: 'No se pudo guardar la evaluación.' });
      await onReloadStaff();
      setDraft(current => ({ ...current, playerId: '', value: '' }));
      setSaveSuccess('Resultado guardado. Ya podés seleccionar a la siguiente jugadora.');
    } catch (error) { setSaveError(error.message); }
  }

  async function runCatalogAction(action, data, fallbackError) {
    setCatalogError('');
    try {
      await postClubAction(club.slug, action, data, { token, fallbackError });
      await onReloadPhysical();
      return true;
    } catch (error) {
      setCatalogError(error.message);
      return false;
    }
  }

  async function submitTestDefinition(event) {
    event.preventDefault();
    if (await runCatalogAction('save-physical-test', testDraft, 'No se pudo agregar la prueba.')) setTestDraft(EMPTY_TEST_DRAFT);
  }

  return (
    <section className="physical-card">
      <div className="section-heading">
        <h2>Evaluaciones físicas</h2>
        {authenticated && (
          <div className="physical-card-actions">
            <button className="secondary" type="button" onClick={() => { setEditingCatalog(false); setEditingAssessment(value => !value); }}>
              {editingAssessment ? 'Cerrar carga' : 'Cargar evaluación'}
            </button>
            <button className="secondary" type="button" onClick={() => { setEditingAssessment(false); setEditingCatalog(value => !value); setCatalogError(''); }}>
              {editingCatalog ? 'Cerrar pruebas' : 'Configurar pruebas'}
            </button>
          </div>
        )}
      </div>
      {editingCatalog && authenticated && (
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
                  {test.dataCount === 0 && <button type="button" className="secondary" onClick={() => runCatalogAction('delete-physical-test', { testKey: test.key }, 'No se pudo eliminar la prueba.')}>Eliminar</button>}
                  {test.active === false
                    ? <button type="button" className="secondary" onClick={() => runCatalogAction('reactivate-physical-test', { testKey: test.key }, 'No se pudo reactivar la prueba.')}>Reactivar</button>
                    : test.dataCount > 0 && <button type="button" className="secondary" onClick={() => runCatalogAction('deactivate-physical-test', { testKey: test.key }, 'No se pudo desactivar la prueba.')}>Desactivar</button>}
                </div>
              </div>
            ))}
            {!physicalTests.some(test => test.custom) && <p className="empty-state">Todavía no agregaste pruebas personalizadas.</p>}
          </div>
          <form className="physical-test-definition-form" onSubmit={submitTestDefinition}>
            <h3>Agregar prueba</h3>
            <div className="callup-meta-grid">
              <label>Nombre<input value={testDraft.name} maxLength={80} onChange={event => setTestDraft(current => ({ ...current, name: event.target.value }))} required /></label>
              <label>Área<select value={testDraft.category} onChange={event => setTestDraft(current => ({ ...current, category: event.target.value }))}>
                {TEST_AREAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              <label>Unidad<input value={testDraft.unit} maxLength={16} placeholder="seg, cm, kg, repeticiones…" onChange={event => setTestDraft(current => ({ ...current, unit: event.target.value }))} /></label>
              <label>Decimales<select value={testDraft.decimals} onChange={event => setTestDraft(current => ({ ...current, decimals: Number(event.target.value) }))}>
                {[0, 1, 2, 3].map(count => <option key={count} value={count}>{count}</option>)}
              </select></label>
              <label>Para el ranking, conviene<select value={testDraft.direction} onChange={event => setTestDraft(current => ({ ...current, direction: event.target.value }))}>
                <option value="higher">Un resultado más alto</option><option value="lower">Un resultado más bajo</option><option value="neutral">No ordenar por resultado</option>
              </select></label>
            </div>
            {catalogError && <p className="message error">{catalogError}</p>}
            <button type="submit">Agregar prueba al club</button>
          </form>
        </section>
      )}
      {editingAssessment && (
        <form className="physical-editor" onSubmit={submitAssessment}>
          <p className="form-hint">Elegí una prueba y una fecha; después cargá el resultado de cada jugadora. Podés cambiar de jugadora sin volver a seleccionar la prueba.</p>
          <div className="callup-meta-grid">
            <label>Categoría<select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value, playerId: '' }))}>
              {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Fecha de evaluación<input type="date" value={draft.evaluatedOn} onChange={event => updateDraft({ evaluatedOn: event.target.value, playerId: '', value: '' })} required /></label>
            <label>Prueba<select value={draft.testKey} onChange={event => updateDraft({ testKey: event.target.value, playerId: '', value: '' })} required>
              <option value="">Seleccioná una prueba</option>
              {physicalTests.filter(test => test.active !== false).map(test => <option key={test.key} value={test.key}>{test.name}{test.unit ? ` (${test.unit})` : ''}</option>)}
            </select></label>
          </div>
          {!assessmentPlayers.length && (
            <p className="empty-state">No hay jugadoras activas en esta categoría. <button type="button" className="inline-link" onClick={() => { setEditingAssessment(false); onGoToRoster(); }}>Agregalas o asignales esta categoría en Plantel.</button></p>
          )}
          {draft.testKey && assessmentPlayers.length > 0 && <div className="physical-entry-row">
            <label>Jugadora<select value={draft.playerId} onChange={event => updateDraft({ playerId: event.target.value })} required>
              <option value="">Seleccioná una jugadora del plantel</option>
              {assessmentPlayers.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select></label>
            <label>Resultado{selectedTest?.unit ? ` (${selectedTest.unit})` : ''}<input type="number" step="any" value={draft.value} onChange={event => setDraft(current => ({ ...current, value: event.target.value }))} required /></label>
          </div>}
          {!physicalTests.some(test => test.active !== false) && (
            <p className="empty-state">Todavía no hay pruebas activas. <button type="button" className="inline-link" onClick={() => { setEditingAssessment(false); setEditingCatalog(true); }}>Agregá las pruebas que van a evaluar.</button></p>
          )}
          {saveError && <p className="message error">{saveError}</p>}
          {saveSuccess && <p className="message success">{saveSuccess}</p>}
          <button type="submit" disabled={!selectedTest || !assessmentPlayers.length || !draft.evaluatedOn || !draft.playerId || draft.value === ''}>Guardar resultado y cargar otra jugadora</button>
          {draft.testKey && draft.evaluatedOn && <section className="physical-entry-recorded">
            <h3>{selectedTest?.name} · resultados del {formatDate(draft.evaluatedOn)}</h3>
            {recordedEntries.length ? <ul>{recordedEntries.map(player => <li key={player.id}>
              <span><strong>{player.name}</strong><small>{player.result.value} {player.result.unit || selectedTest?.unit || ''}</small></span>
              <button type="button" className="secondary" onClick={() => updateDraft({ playerId: player.rosterId, value: String(player.result.value) })}>Corregir</button>
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
        <div><Activity aria-hidden="true" /><span><strong>{playersWithResults}</strong><small>con resultados</small></span></div>
      </div>
      <input
        className="physical-search"
        value={search}
        onChange={event => setSearch(event.target.value)}
        aria-label="Buscar jugadora por nombre o apellido"
        placeholder="Buscar jugadora por nombre o apellido..."
      />
      <div className="physical-filters">
        {FILTERS.map(([key, label]) => (
          <button key={key} className={filter === key ? 'active' : ''} onClick={() => { setFilter(key); setSelectedPlayer(null); }}>
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
          <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>
            <Icon aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {mode === 'players' && (
        <div className="physical-player-layout">
          <div className="physical-player-list">
            {visiblePlayers.length ? (
              [...visiblePlayers]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(player => (
                  <button
                    className={`physical-player ${selectedPlayer === player.id ? 'selected' : ''}`}
                    key={player.id}
                    onClick={() => setSelectedPlayer(player.id)}
                  >
                    <strong>{player.name}</strong>
                    <span>{divisionLabel(player.filterTag)}</span>
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
                    <span>{divisionLabel(selected.filterTag)}</span>
                    {selected.evaluatedOn && <span>Última evaluación · {formatDate(selected.evaluatedOn, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
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
                        {result?.evals.map((evaluation, index) => (
                          <span key={`${evaluation.evaluatedOn || 'sin-fecha'}-${index}`}><small>{evaluation.evaluatedOn ? formatDate(evaluation.evaluatedOn) : `Evaluación ${index + 1}`}</small><strong>{evaluation.value}</strong></span>
                        ))}
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
      {mode === 'averages' && (
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
      {mode === 'top10' && (
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
                    <button key={item.player.id} onClick={() => { setMode('players'); setSelectedPlayer(item.player.id); }}>
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
  );
}
