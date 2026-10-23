import { useEffect, useMemo, useState } from 'react';
import TacticalPlays from './TacticalPlays';

const emptyPreparation = () => ({ focus: '', videoUrls: '', plays: [] });

function normalizePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fixtureKey(category, round, opponent, date) {
  return [category, round, opponent, date].map(normalizePart).filter(Boolean).join('-').slice(0, 180);
}

function fromFixture(category, match) {
  return {
    category,
    matchKey: fixtureKey(category, match.round, match.rival, match.fecha),
    round: match.round || 'Partido',
    opponent: match.rival || 'Rival',
    homeAway: match.homeAway || 'Local',
    date: match.fecha || '',
    played: Boolean(match.played)
  };
}

function toDraft(preparation) {
  return {
    focus: preparation?.focus || '',
    videoUrls: (preparation?.videoUrls || []).join('\n'),
    plays: Array.isArray(preparation?.plays) ? JSON.parse(JSON.stringify(preparation.plays)) : []
  };
}

export default function MatchPreparationPanel({ club, authenticated, token }) {
  const [category, setCategory] = useState('primera');
  const [fixtures, setFixtures] = useState({ primera: [], intermedia: [] });
  const [preparations, setPreparations] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [matchDraft, setMatchDraft] = useState({ round: '', opponent: '', homeAway: 'Local', date: '' });
  const [draft, setDraft] = useState(emptyPreparation);
  const [status, setStatus] = useState('Cargando el plan del partido...');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadPreparations() {
    try {
      const response = await fetch('/api/club-data?club=' + encodeURIComponent(club.slug) + '&dataset=preparations', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el plan del partido.');
      setPreparations(payload.preparations || []);
      setStatus('');
    } catch (loadError) {
      setStatus(loadError.message);
    }
  }

  useEffect(() => {
    loadPreparations();
  }, [club.slug]);

  useEffect(() => {
    let cancelled = false;
    async function loadFixtures() {
      try {
        const division = category === 'intermedia' ? '2' : '1';
        const response = await fetch('/api/torneo/matches?club=' + encodeURIComponent(club.slug) + '&division=' + division, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Fixture no disponible.');
        if (!cancelled) setFixtures(current => ({
          ...current,
          [category]: payload.matches || payload.pendingMatches || []
        }));
      } catch (_) {
        if (!cancelled) setFixtures(current => ({ ...current, [category]: [] }));
      }
    }
    loadFixtures();
    return () => { cancelled = true; };
  }, [club.slug, category]);

  useEffect(() => {
    setSelectedKey('');
    setEditing(false);
    setCreating(false);
  }, [category]);

  const options = useMemo(() => {
    const byKey = new Map();
    for (const match of fixtures[category] || []) {
      const option = fromFixture(category, match);
      if (option.matchKey) byKey.set(option.matchKey, option);
    }
    for (const item of preparations.filter(prep => prep.category === category)) {
      if (!byKey.has(item.matchKey)) {
        byKey.set(item.matchKey, {
          category: item.category,
          matchKey: item.matchKey,
          round: item.round,
          opponent: item.opponent,
          homeAway: item.homeAway,
          date: item.date,
          played: false
        });
      }
    }
    return [...byKey.values()];
  }, [fixtures, preparations, category]);

  const visibleOptions = authenticated
    ? options
    : options.filter(option => preparations.some(item => item.category === category && item.matchKey === option.matchKey));
  const selectedMatch = creating
    ? { ...matchDraft, category, matchKey: fixtureKey(category, matchDraft.round, matchDraft.opponent, matchDraft.date) }
    : visibleOptions.find(match => match.matchKey === selectedKey) || visibleOptions.find(match => !match.played) || visibleOptions[0] || null;
  const selectedRecord = !creating && selectedMatch
    ? preparations.find(item => item.category === category && item.matchKey === selectedMatch.matchKey)
    : null;
  const canView = Boolean(selectedRecord && selectedRecord.preparation);

  function beginEdit() {
    if (!selectedMatch) return beginNew();
    setCreating(false);
    setMatchDraft({
      round: selectedMatch.round || '',
      opponent: selectedMatch.opponent || '',
      homeAway: selectedMatch.homeAway || 'Local',
      date: selectedMatch.date || ''
    });
    setDraft(toDraft(selectedRecord?.preparation));
    setEditing(true);
    setError('');
  }

  function beginNew() {
    setCreating(true);
    setEditing(true);
    setSelectedKey('');
    setMatchDraft({ round: '', opponent: '', homeAway: 'Local', date: '' });
    setDraft(emptyPreparation());
    setError('');
  }

  function cancelEdit() {
    setEditing(false);
    setCreating(false);
    setError('');
  }

  function copyPrevious() {
    const previous = preparations
      .filter(item => item.category === category && item.matchKey !== selectedMatch?.matchKey)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
    if (!previous) return;
    setDraft(toDraft(previous.preparation));
  }

  async function savePreparation(event) {
    event.preventDefault();
    if (!authenticated || !token) {
      setError('Ingresá con la contraseña del cuerpo técnico para guardar.');
      return;
    }
    if (!selectedMatch?.matchKey || !matchDraft.round.trim() || !matchDraft.opponent.trim()) {
      setError('Completá la fecha y el rival para identificar el partido.');
      return;
    }
    const preparation = {
      focus: draft.focus.trim(),
      videoUrls: draft.videoUrls.split(/\r?\n/).map(url => url.trim()).filter(Boolean),
      plays: draft.plays
    };
    if (!preparation.focus && !preparation.videoUrls.length && !preparation.plays.length) {
      setError('Agregá un foco, un video o al menos una jugada antes de guardar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/club-data?club=' + encodeURIComponent(club.slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          action: 'save-preparation',
          category,
          matchKey: selectedMatch.matchKey,
          round: matchDraft.round.trim(),
          opponent: matchDraft.opponent.trim(),
          homeAway: matchDraft.homeAway,
          date: matchDraft.date.trim(),
          preparation
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error === 'Acción de persistencia desconocida.'
          ? 'El servidor está desactualizado y todavía no reconoce los planes de partido. Detenelo y volvé a iniciar la aplicación para cargar la versión nueva.'
          : payload.error === 'La pizarra táctica contiene una ficha inválida.' &&
            preparation.plays.some(play => (play.frames || []).some(frame => frame.some(marker => marker.side === 'ball')))
            ? 'El servidor todavía no reconoce la ficha de la bocha. Detenelo y volvé a iniciar la aplicación; si está publicada, volvé a desplegar la versión actualizada.'
          : payload.error || 'No se pudo guardar el plan del partido.';
        throw new Error(message);
      }
      const saved = {
        category, matchKey: selectedMatch.matchKey,
        round: matchDraft.round.trim(), opponent: matchDraft.opponent.trim(),
        homeAway: matchDraft.homeAway, date: matchDraft.date.trim(),
        preparation, updatedAt: new Date().toISOString()
      };
      setPreparations(current => [saved, ...current.filter(item => item.category !== category || item.matchKey !== saved.matchKey)]);
      setSelectedKey(saved.matchKey);
      setCreating(false);
      setEditing(false);
      setStatus('Plan del partido guardado.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function updatePlayList(plays) {
    setDraft(current => ({ ...current, plays }));
  }

  return (
    <section className="match-preparation-workspace">
      <header className="preparation-page-header">
        <div><span className="kicker">CUERPO TÉCNICO Y JUGADORAS</span><h2>Plan partido</h2>
          <p>Videos, foco semanal y jugadas para cada partido.</p></div>
        {authenticated && <button type="button" className="secondary" onClick={beginNew}>+ Nuevo plan</button>}
      </header>
      <div className="preparation-category-tabs">
        <button type="button" className={category === 'primera' ? 'active' : ''} onClick={() => setCategory('primera')}>1ra División</button>
        <button type="button" className={category === 'intermedia' ? 'active' : ''} onClick={() => setCategory('intermedia')}>Intermedia</button>
      </div>
      {status && <p className="preparation-status" role="status">{status}</p>}
      <label className="preparation-match-select">Partido
        <select
          value={selectedKey || selectedMatch?.matchKey || ''}
          onChange={event => { setSelectedKey(event.target.value); setEditing(false); setCreating(false); }}
          disabled={creating || !visibleOptions.length}
        >
          {!visibleOptions.length && <option value="">Todavía no hay partidos preparados</option>}
          {visibleOptions.map(match => (
            <option value={match.matchKey} key={match.matchKey}>
              {match.round} · {match.opponent}{match.date ? ' · ' + match.date : ''}
            </option>
          ))}
        </select>
      </label>
      {selectedMatch && !creating && (
        <div className="preparation-selected-match">
          <strong>{selectedMatch.round} · {selectedMatch.opponent}</strong>
          <span>{selectedMatch.date || 'Fecha pendiente'} · {selectedMatch.homeAway}</span>
        </div>
      )}
      {editing ? (
        <form className="preparation-form" onSubmit={savePreparation}>
          {creating ? (
            <div className="preparation-match-fields">
              <label>Fecha o ronda<input maxLength="100" value={matchDraft.round} onChange={event => setMatchDraft(current => ({ ...current, round: event.target.value }))} placeholder="Fecha 5" required /></label>
              <label>Rival<input maxLength="140" value={matchDraft.opponent} onChange={event => setMatchDraft(current => ({ ...current, opponent: event.target.value }))} required /></label>
              <label>Día<input maxLength="80" value={matchDraft.date} onChange={event => setMatchDraft(current => ({ ...current, date: event.target.value }))} placeholder="Sábado 18 de mayo" /></label>
              <label>Localía<select value={matchDraft.homeAway} onChange={event => setMatchDraft(current => ({ ...current, homeAway: event.target.value }))}><option>Local</option><option>Visitante</option></select></label>
            </div>
          ) : (
            <div className="preparation-copy-row">
              <span>Modificás solo el plan de este partido.</span>
              <button type="button" className="secondary" onClick={copyPrevious}>Copiar plan anterior</button>
            </div>
          )}
          <label>Foco de la semana
            <textarea rows="3" maxLength="1500" placeholder="Qué queremos trabajar o recordar" value={draft.focus} onChange={event => setDraft(current => ({ ...current, focus: event.target.value }))} />
          </label>
          <label>Videos de referencia
            <textarea rows="3" placeholder="Pegá un enlace por línea (YouTube, Drive u otro sitio)" value={draft.videoUrls} onChange={event => setDraft(current => ({ ...current, videoUrls: event.target.value }))} />
            <small>Se guardan enlaces; los videos no se suben a la aplicación.</small>
          </label>
          <div className="preparation-editor-plays">
            <div><h3>Jugadas tácticas</h3><p>Creá varias jugadas y agregá pasos para mostrar el movimiento.</p></div>
            <TacticalPlays plays={draft.plays} onChange={updatePlayList} editable />
          </div>
          {error && <p className="message error" role="alert">{error}</p>}
          <div className="preparation-form-actions">
            <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</button>
            <button type="button" className="secondary" onClick={cancelEdit}>Cancelar</button>
          </div>
        </form>
      ) : canView ? (
        <div className="match-preparation-card">
          {authenticated && <div className="preparation-view-actions"><button type="button" className="secondary" onClick={beginEdit}>Editar plan</button></div>}
          {selectedRecord.preparation.focus && <p className="match-preparation-focus">{selectedRecord.preparation.focus}</p>}
          {(selectedRecord.preparation.videoUrls || []).length > 0 && (
            <div className="preparation-videos">
              {selectedRecord.preparation.videoUrls.map((url, index) => (
                <a key={url + index} href={url} target="_blank" rel="noreferrer">▶ Ver video {index + 1}<span>{(() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return 'Abrir enlace'; } })()}</span></a>
              ))}
            </div>
          )}
          <TacticalPlays plays={selectedRecord.preparation.plays || []} />
        </div>
      ) : (
        <div className="empty-state preparation-empty">
          <p>{authenticated ? 'Todavía no hay un plan para este partido.' : 'El cuerpo técnico todavía no publicó un plan para estos partidos.'}</p>
          {authenticated && <button type="button" onClick={beginEdit}>Crear plan para este partido</button>}
        </div>
      )}
      {!selectedMatch && !editing && (
        <div className="empty-state preparation-empty">
          <p>{authenticated ? 'No hay partidos disponibles en el fixture. Podés crear un plan manual.' : 'El cuerpo técnico todavía no publicó planes de partido.'}</p>
          {authenticated && <button type="button" onClick={beginNew}>Crear plan</button>}
        </div>
      )}
    </section>
  );
}
