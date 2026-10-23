import { useEffect, useState } from 'react';

export default function PrecargaModal({
  club,
  citedPlayers = {},
  authenticated,
  onAuthenticate,
  onClose
}) {
  const [category, setCategory] = useState('primera');
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ text: '', type: '' });
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    if (!authPassword) return;
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const response = await fetch(`/api/auth?club=${encodeURIComponent(club.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: authPassword })
      });
      const data = await response.json();
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Contraseña incorrecta');
      }
      onAuthenticate(data.token);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="overlay">
        <div className="form-card precarga-modal">
          <button type="button" className="close" onClick={onClose}>
            ×
          </button>
          <span className="kicker">ACCESO EXCLUSIVO · CUERPO TÉCNICO</span>
          <h2>Precarga Oficial AMH</h2>
          <p className="precarga-desc">
            Esta herramienta es de uso exclusivo para el cuerpo técnico para la inscripción oficial en Oracle APEX. Ingresá la contraseña del club.
          </p>
          <form className="tracker-login" onSubmit={handleAuth}>
            <input
              type="password"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="Contraseña del cuerpo técnico"
              autoComplete="current-password"
              disabled={isAuthenticating}
            />
            <button type="submit" disabled={isAuthenticating}>
              {isAuthenticating ? 'Validando...' : 'Acceder'}
            </button>
          </form>
          {authError && <p className="message error">{authError}</p>}
        </div>
      </div>
    );
  }

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
      const res = await fetch(`/api/torneo/precarga?club=${encodeURIComponent(club.slug)}&division=${divId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudieron consultar los partidos en AMH');
      }
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
      setStatus({ text: 'Debes tildar al menos una jugadora para precargar.', type: 'error' });
      return;
    }

    const selectedMatch = matches.find(m => m.id === selectedMatchId);
    const divId = category === 'intermedia' ? '2' : '1';

    setIsSubmitting(true);
    setStatus({ text: 'Ejecutando inscripción en sistema AMH (Oracle APEX)...', type: 'info' });

    try {
      const res = await fetch('/api/torneo/precarga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division: divId,
          partidoId: selectedMatchId,
          rival: selectedMatch?.text || '',
          clubSlug: club.slug,
          players: Array.from(selectedPlayers)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falló la precarga en AMH.');
      }

      const inscribedCount = data.result?.inscribedCount ?? selectedPlayers.size;
      setStatus({
        text: `✅ Precarga exitosa: ${inscribedCount} jugadoras inscriptas en el sistema oficial AMH.`,
        type: 'success'
      });
    } catch (err) {
      setStatus({ text: `❌ Error al precargar: ${err.message}`, type: 'error' });
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

        <span className="kicker">AUTOMATIZACIÓN OFICIAL · AMH ORACLE APEX</span>
        <h2>Precarga de Equipos en AMH</h2>
        <p className="precarga-desc">
          Inscribe automáticamente a las jugadoras citadas en la planilla oficial de la Asociación Mendocina de Hockey.
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
            <strong>Partido Oficial en AMH:</strong>
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
              Jugadoras Citadas ({selectedPlayers.size}/{currentPlayers.length})
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
          ⚠️ <strong>Seguridad garantizada:</strong> El bot únicamente tilda las jugadoras seleccionadas y presiona &quot;Inscribe Tildados&quot;. Nunca cierra ni bloquea la planilla del partido.
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

