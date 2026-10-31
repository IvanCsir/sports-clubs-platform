import { useEffect, useState } from 'react';
import { api } from '../api';

// Sólo se abre con una sesión del cuerpo técnico activa.
export default function PrecargaModal({
  club,
  citedPlayers = {},
  token,
  onClose
}) {
  const [category, setCategory] = useState('primera');
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ text: '', type: '' });

  const currentPlayers = citedPlayers[category]?.players || [];

  // Cuando cambia la categoría o los jugadores, marcar todos por defecto
  useEffect(() => {
    setSelectedPlayers(new Set(currentPlayers));
  }, [category, currentPlayers.length]);

  // Cargar partidos disponibles en la AMH para la categoría
  async function loadAmhMatches(cat) {
    setLoadingMatches(true);
    setStatus({ text: '', type: '' });
    try {
      const divId = cat === 'intermedia' ? '2' : '1';
      const fallbackError = 'No se pudieron consultar los partidos en AMH';
      const data = await api(`/api/torneo/precarga?club=${encodeURIComponent(club.slug)}&division=${divId}`, { fallbackError });
      if (!data.success) throw new Error(data.error || fallbackError);
      setMatches(data.matches || []);
      if (data.matches && data.matches.length > 0) {
        setSelectedMatchId(data.matches[0].id);
      } else {
        setSelectedMatchId('');
      }
    } catch (err) {
      setStatus({ text: err.message, type: 'error' });
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  }

  useEffect(() => {
    loadAmhMatches(category);
  }, [category]);

  function togglePlayer(name) {
    setSelectedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedPlayers(new Set(currentPlayers));
  }

  function deselectAll() {
    setSelectedPlayers(new Set());
  }

  async function handleExecutePrecarga(e) {
    e.preventDefault();
    if (!selectedMatchId) {
      setStatus({ text: 'Por favor seleccioná un partido oficial de AMH.', type: 'error' });
      return;
    }
    if (selectedPlayers.size === 0) {
      setStatus({ text: 'Tildá al menos una jugadora para precargar.', type: 'error' });
      return;
    }

    const selectedMatch = matches.find(m => m.id === selectedMatchId);
    const divId = category === 'intermedia' ? '2' : '1';

    setIsSubmitting(true);
    setStatus({ text: 'Inscribiendo jugadoras en AMH…', type: 'info' });

    try {
      const data = await api('/api/torneo/precarga', {
        method: 'POST',
        token,
        body: {
          division: divId,
          partidoId: selectedMatchId,
          rival: selectedMatch?.text || '',
          clubSlug: club.slug,
          players: Array.from(selectedPlayers)
        },
        fallbackError: 'Falló la precarga en AMH.'
      });
      if (!data.success) throw new Error(data.error || 'Falló la precarga en AMH.');

      const inscribedCount = data.result?.inscribedCount ?? selectedPlayers.size;
      setStatus({
        text: `Precarga lista: ${inscribedCount} jugadoras inscriptas en AMH.`,
        type: 'success'
      });
    } catch (err) {
      setStatus({ text: `No se pudo precargar: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="overlay">
      <div className="form-card precarga-modal">
        <button type="button" className="close" onClick={onClose} disabled={isSubmitting}>
          ×
        </button>

        <h2>Precarga en AMH</h2>
        <p className="precarga-desc">
          Inscribí a las jugadoras citadas en la planilla oficial de la Asociación Mendocina de Hockey.
        </p>

        {/* Categoría */}
        <div className="category-tabs">
          <button
            type="button"
            className={category === 'primera' ? 'active' : ''}
            onClick={() => setCategory('primera')}
            disabled={isSubmitting}
          >
            1ra División
          </button>
          <button
            type="button"
            className={category === 'intermedia' ? 'active' : ''}
            onClick={() => setCategory('intermedia')}
            disabled={isSubmitting}
          >
            Intermedia
          </button>
        </div>

        {/* Selector de partido oficial */}
        <div className="precarga-field">
          <label htmlFor="precarga-match-select">
            <strong>Partido oficial en AMH</strong>
            {loadingMatches && <small> (Consultando partidos en vivo...)</small>}
          </label>
          <select
            id="precarga-match-select"
            value={selectedMatchId}
            onChange={e => setSelectedMatchId(e.target.value)}
            disabled={loadingMatches || isSubmitting || matches.length === 0}
          >
            {matches.length === 0 ? (
              <option value="">{loadingMatches ? 'Cargando partidos...' : 'No hay partidos pendientes'}</option>
            ) : (
              matches.map(m => (
                <option key={m.id} value={m.id}>
                  {m.text}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Lista de jugadoras citadas */}
        <div className="precarga-players-box">
          <div className="precarga-players-header">
            <strong>
              Jugadoras citadas ({selectedPlayers.size}/{currentPlayers.length})
            </strong>
            <div className="precarga-bulk-actions">
              <button type="button" className="secondary" onClick={selectAll} disabled={isSubmitting}>
                Todas
              </button>
              <button type="button" className="secondary" onClick={deselectAll} disabled={isSubmitting}>
                Ninguna
              </button>
            </div>
          </div>

          <div className="precarga-checkbox-list">
            {currentPlayers.length === 0 ? (
              <p className="empty-state">No hay jugadoras citadas en la planilla para esta categoría.</p>
            ) : (
              currentPlayers.map(name => {
                const isChecked = selectedPlayers.has(name);
                return (
                  <label key={name} className={`player-checkbox-item ${isChecked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePlayer(name)}
                      disabled={isSubmitting}
                    />
                    <span>{name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Status y advertencia */}
        {status.text && (
          <div className={`message ${status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : ''}`}>
            {status.text}
          </div>
        )}

        <div className="precarga-disclaimer">
          Solo se tildan las jugadoras que seleccionás. La planilla del partido no se cierra ni se bloquea.
        </div>

        <div className="precarga-footer">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecutePrecarga}
            disabled={isSubmitting || loadingMatches || !selectedMatchId || selectedPlayers.size === 0}
          >
            {isSubmitting ? 'Inscribiendo en AMH...' : `Inscribir (${selectedPlayers.size}) en AMH`}
          </button>
        </div>
      </div>
    </div>
  );
}

