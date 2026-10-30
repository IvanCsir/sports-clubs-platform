import { useState } from 'react';
import { postClubAction } from '../api';

const CATEGORY_OPTIONS = [['primera', '1ra División'], ['intermedia', 'Intermedia'], ['5ta', '5ta División']];
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS);

export default function RosterPanel({ club, token, players, onSaved }) {
  const [playerDraft, setPlayerDraft] = useState({ name: '', category: 'primera' });
  const [playerError, setPlayerError] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [playerEditDraft, setPlayerEditDraft] = useState({ name: '', categories: [] });
  const [playerEditError, setPlayerEditError] = useState('');
  const activePlayers = players
    .filter(player => player.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  async function submitPlayer(event) {
    event.preventDefault();
    setPlayerError('');
    try {
      await postClubAction(club.slug, 'save-player', playerDraft, { token, fallbackError: 'No se pudo agregar la jugadora.' });
      await onSaved();
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
      await postClubAction(club.slug, 'update-player', { id: editingPlayerId, ...playerEditDraft },
        { token, fallbackError: 'No se pudo editar la jugadora.' });
      await onSaved();
      setEditingPlayerId(null);
    } catch (error) { setPlayerEditError(error.message); }
  }

  return (
    <section className="physical-card">
      <div className="section-heading">
        <div><h2>Plantel de {club.shortName || club.name}</h2><p>Agregá jugadoras y asignales una categoría.</p></div>
        <span>{activePlayers.length} activas</span>
      </div>
      <form className="player-editor" onSubmit={submitPlayer}>
        <label>Nombre y apellido<input value={playerDraft.name} onChange={event => setPlayerDraft(current => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
        <label>Categoría<select value={playerDraft.category} onChange={event => setPlayerDraft(current => ({ ...current, category: event.target.value }))}>
          {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {playerError && <p className="message error">{playerError}</p>}
        <button type="submit">Agregar jugadora</button>
      </form>
      <div className="players-grid">
        {activePlayers.map(player => (
          <div className="player-pill" key={player.id}>
            {editingPlayerId === player.id ? (
              <form className="player-edit-form" onSubmit={submitPlayerEdit}>
                <label>Nombre y apellido<input value={playerEditDraft.name} onChange={event => setPlayerEditDraft(current => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
                <fieldset className="player-category-options">
                  <legend>Categorías</legend>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <label key={value}><input type="checkbox" checked={playerEditDraft.categories.includes(value)} onChange={event => setPlayerEditDraft(current => ({ ...current, categories: event.target.checked ? [...current.categories, value] : current.categories.filter(item => item !== value) }))} />{label}</label>
                  ))}
                </fieldset>
                {playerEditError && <p className="message error">{playerEditError}</p>}
                <div className="player-edit-actions"><button type="submit">Guardar cambios</button><button type="button" className="secondary" onClick={() => setEditingPlayerId(null)}>Cancelar</button></div>
              </form>
            ) : (
              <>
                <strong>{player.name}</strong>
                <small>{(player.categories || []).map(item => CATEGORY_LABELS[item] || item).join(' · ') || 'Sin categoría'}</small>
                <button type="button" className="player-edit-trigger secondary" onClick={() => beginPlayerEdit(player)}>Editar</button>
              </>
            )}
          </div>
        ))}
      </div>
      {activePlayers.length === 0 && <p className="empty-state">Todavía no hay jugadoras cargadas en este club.</p>}
    </section>
  );
}
