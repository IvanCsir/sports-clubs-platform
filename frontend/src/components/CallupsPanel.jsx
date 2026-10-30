import { useState } from 'react';
import OpponentBadge from './OpponentBadge';
import { postClubAction } from '../api';
import { callTimeOf, callupMatchesFixture, matchTimeOf } from '../utils/callups';

const SHORT_CATEGORY_LABELS = { primera: '1ra', intermedia: 'Intermedia', '5ta': '5ta' };

function splitNames(text) {
  return text.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
}

// Datos iniciales del formulario: el partido sale del fixture de AMH y los horarios y la
// cancha se conservan sólo si la citación guardada es de ese mismo partido.
function callupMetaDraftFor(meta, nextMatch) {
  const sameMatch = callupMatchesFixture(meta, nextMatch);
  return {
    round: nextMatch?.round || meta['fecha n°'] || meta['fecha n'] || meta.fecha || '',
    opponent: nextMatch?.rival || meta.rival || '',
    date: nextMatch?.fecha || meta.dia || meta['día'] || '',
    homeAway: nextMatch?.homeAway || meta.localia || 'Local',
    venue: nextMatch ? (sameMatch ? (meta.cancha || '') : '') : (meta.cancha || ''),
    callTime: nextMatch ? (sameMatch ? callTimeOf(meta) : '') : callTimeOf(meta),
    matchTime: nextMatch
      ? (sameMatch && matchTimeOf(meta) ? matchTimeOf(meta) : (nextMatch.matchTime || ''))
      : matchTimeOf(meta)
  };
}

export default function CallupsPanel({ club, category, callup, matchInfo, nextMatch, players, authenticated, token, onSaved, onGoToRoster }) {
  const [editing, setEditing] = useState(false);
  const [callupDraft, setCallupDraft] = useState('');
  const [metaDraft, setMetaDraft] = useState({});
  const [error, setError] = useState('');
  const activePlayers = players
    .filter(player => player.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const calledUpPlayers = [...(callup.players || [])]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const selectedNames = splitNames(callupDraft);

  function beginEdit() {
    setCallupDraft((callup.players || []).join('\n'));
    setMetaDraft(callupMetaDraftFor(callup.meta || {}, nextMatch));
    setError('');
    setEditing(true);
  }

  function togglePlayer(name, selected) {
    setCallupDraft(current => {
      const selection = new Set(splitNames(current));
      if (selected) selection.add(name);
      else selection.delete(name);
      return [...selection].join('\n');
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (!authenticated) throw new Error('Ingresá con tu cuenta Google invitada para elegir y guardar las citadas.');
      await postClubAction(club.slug, 'save-callup', {
        category, teamName: category,
        matchKey: `${category}-${(metaDraft.round || 'actual').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        ...metaDraft, players: selectedNames
      }, { token, fallbackError: 'No se pudo guardar la citación.' });
      await onSaved();
      setEditing(false);
    } catch (saveError) { setError(saveError.message); }
  }

  const updateMeta = field => event => setMetaDraft(current => ({ ...current, [field]: event.target.value }));

  return (
    <>
      <section className="match-card">
        <span className="kicker">{matchInfo.round}</span>
        <div className="home-match-title-row">
          <h2>vs {matchInfo.rival || 'Rival pendiente'}</h2>
          <OpponentBadge key={matchInfo.rival} name={matchInfo.rival} />
        </div>
        <div className="match-details">
          <span>📅 {matchInfo.date}</span>
          {matchInfo.callTime && <span>📣 Citación: {matchInfo.callTime}</span>}
          <span>⏱️ {matchInfo.matchTime}</span>
          <span>📍 {matchInfo.venue}</span>
        </div>
      </section>
      <section className="players-section">
        <div className="section-heading">
          <h2>Jugadoras citadas <span>{callup.players.length}</span></h2>
          <div className="callup-actions">
            {authenticated && <button type="button" className="secondary" onClick={beginEdit}>Editar citación</button>}
          </div>
        </div>
        {editing && (
          <form className="callup-editor" onSubmit={submit}>
            {nextMatch ? (
              <div className="callup-fixture-summary">
                <strong>Partido obtenido de AMH</strong>
                <span>{metaDraft.round} · vs {metaDraft.opponent}</span>
                <span>{metaDraft.date || 'Fecha pendiente'} · {metaDraft.homeAway}</span>
              </div>
            ) : (
              <div className="callup-meta-grid">
                <label>Fecha / ronda<input value={metaDraft.round || ''} onChange={updateMeta('round')} /></label>
                <label>Rival<input value={metaDraft.opponent || ''} onChange={updateMeta('opponent')} /></label>
                <label>Día<input value={metaDraft.date || ''} onChange={updateMeta('date')} /></label>
                <label>Localía<select value={metaDraft.homeAway || 'Local'} onChange={updateMeta('homeAway')}><option>Local</option><option>Visitante</option></select></label>
              </div>
            )}
            <div className="callup-meta-grid">
              <label>Cancha<input value={metaDraft.venue || ''} onChange={updateMeta('venue')} /></label>
              <label>Horario del partido<input value={metaDraft.matchTime || ''} onChange={updateMeta('matchTime')} placeholder="Ej.: 16:45" /></label>
              <label>Horario de citación<input value={metaDraft.callTime || ''} onChange={updateMeta('callTime')} placeholder="Ej.: 14:30" /></label>
            </div>
            <div className="callup-selection">
              <div className="callup-selection-heading">
                <strong>Elegí las jugadoras citadas</strong>
                <span>{callupDraft.split(/\r?\n/).filter(Boolean).length} seleccionadas</span>
              </div>
              {!authenticated ? <p className="empty-state">Ingresá para elegir entre las jugadoras registradas en este club.</p> : (
                <div className="callup-player-list">
                  {activePlayers.map(player => (
                    <label className="callup-player-option" key={player.id}>
                      <input type="checkbox" checked={selectedNames.includes(player.name)} onChange={event => togglePlayer(player.name, event.target.checked)} />
                      <span>{player.name}<small className="callup-player-categories">{(player.categories || []).map(item => SHORT_CATEGORY_LABELS[item] || item).join(' · ') || 'Sin categoría de plantel'}</small></span>
                    </label>
                  ))}
                  {!activePlayers.length && (
                    <p className="empty-state">Todavía no hay jugadoras cargadas en el plantel. <button type="button" className="inline-link" onClick={() => { setEditing(false); onGoToRoster(); }}>Agregar al plantel</button></p>
                  )}
                </div>
              )}
            </div>
            {error && <p className="message error">{error}</p>}
            {authenticated && <button type="submit">Guardar citación en la base de datos</button>}
            <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancelar</button>
          </form>
        )}
        {calledUpPlayers.length ? (
          <div className="players-grid">
            {calledUpPlayers.map((player, index) => (
              <div className="player-pill" key={`${player}-${index}`}>{player}</div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavía no hay jugadoras citadas para esta categoría.</p>
        )}
      </section>
    </>
  );
}
