import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import TacticalPlays from './TacticalPlays';

const emptyPreparation = () => ({ focus: '', videos: [{ title: '', url: '' }], plays: [] });

function getPreparationVideos(preparation) {
  if (Array.isArray(preparation?.videos)) {
    return preparation.videos.map(video => typeof video === 'string'
      ? { title: '', url: video }
      : { title: video.title || '', url: video.url || '' });
  }
  return (preparation?.videoUrls || []).map(url => ({ title: '', url }));
}

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

function fixtureDateOrdinal(value) {
  const text = String(value || '').trim();
  const localDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const [, day, month, year] = localDate
    ? [null, Number(localDate[1]), Number(localDate[2]), Number(localDate[3])]
    : isoDate
      ? [null, Number(isoDate[3]), Number(isoDate[2]), Number(isoDate[1])]
      : [];
  if (!day || !month || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / 86400000);
}

function todayDateOrdinal() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function getVideoEmbed(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (['drive.google.com', 'www.drive.google.com'].includes(hostname)) {
      const pathId = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1];
      const fileId = pathId || url.searchParams.get('id');
      if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) return null;
      return { src: `https://drive.google.com/file/d/${fileId}/preview`, provider: 'Drive' };
    }

    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'].includes(hostname)) {
      const pathId = url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1];
      const videoId = hostname.endsWith('youtu.be')
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') || pathId;
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
      return { src: `https://www.youtube-nocookie.com/embed/${videoId}`, provider: 'YouTube' };
    }
    return null;
  } catch (_) {
    return null;
  }
}

function PreparationVideoPlayer({ videoEmbed, title }) {
  return (
    <iframe
      src={videoEmbed.src}
      title={title}
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen={videoEmbed.provider !== 'Drive'}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function cleanRichTextHtml(value) {
  const allowed = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'div']);
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  const output = document.createElement('div');
  const copyNode = (node, parent) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.nodeValue || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (!allowed.has(tag)) {
      [...node.childNodes].forEach(child => copyNode(child, parent));
      return;
    }
    const cleanElement = document.createElement(tag);
    if (['p', 'div'].includes(tag) && ['left', 'center', 'right', 'justify'].includes(node.style.textAlign)) {
      cleanElement.style.textAlign = node.style.textAlign;
    }
    [...node.childNodes].forEach(child => copyNode(child, cleanElement));
    parent.appendChild(cleanElement);
  };
  [...template.content.childNodes].forEach(node => copyNode(node, output));
  return output.innerHTML;
}

function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const commands = [
    ['bold', Bold, 'Negrita'], ['italic', Italic, 'Cursiva'], ['underline', Underline, 'Subrayado'],
    ['insertUnorderedList', List, 'Lista con viñetas'], ['insertOrderedList', ListOrdered, 'Lista numerada'],
    ['justifyLeft', AlignLeft, 'Alinear a la izquierda'], ['justifyCenter', AlignCenter, 'Centrar'],
    ['justifyRight', AlignRight, 'Alinear a la derecha'], ['justifyFull', AlignJustify, 'Justificar']
  ];

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      const cleanValue = cleanRichTextHtml(value);
      if (editorRef.current.innerHTML !== cleanValue) editorRef.current.innerHTML = cleanValue;
    }
  }, [value]);

  function runCommand(command) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Formato del foco semanal">
        {commands.map(([command, Icon, label]) => (
          <button key={command} type="button" title={label} aria-label={label}
            onMouseDown={event => event.preventDefault()} onClick={() => runCommand(command)}>
            <Icon size={17} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        className="rich-text-content"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Foco de la semana"
        onInput={event => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
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
  const videos = getPreparationVideos(preparation);
  return {
    focus: preparation?.focus || '',
    videos: videos.length ? videos : [{ title: '', url: '' }],
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    setConfirmDelete(false);
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
    return [...byKey.values()].sort((a, b) => {
      const aDate = fixtureDateOrdinal(a.date);
      const bDate = fixtureDateOrdinal(b.date);
      if (aDate === null) return bDate === null ? 0 : 1;
      if (bDate === null) return -1;
      return aDate - bDate;
    });
  }, [fixtures, preparations, category]);

  const visibleOptions = authenticated
    ? options
    : options.filter(option => preparations.some(item => item.category === category && item.matchKey === option.matchKey));
  const todayOrdinal = todayDateOrdinal();
  const defaultMatch = visibleOptions.find(match => !match.played && fixtureDateOrdinal(match.date) >= todayOrdinal)
    || visibleOptions.find(match => !match.played)
    || visibleOptions[0]
    || null;
  const selectedMatch = creating
    ? { ...matchDraft, category, matchKey: fixtureKey(category, matchDraft.round, matchDraft.opponent, matchDraft.date) }
    : visibleOptions.find(match => match.matchKey === selectedKey) || defaultMatch;
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
      setError('Ingresá con tu cuenta Google invitada para guardar.');
      return;
    }
    if (!selectedMatch?.matchKey || !matchDraft.round.trim() || !matchDraft.opponent.trim()) {
      setError('Completá la fecha y el rival para identificar el partido.');
      return;
    }
    const preparation = {
      focus: draft.focus.trim(),
      videos: draft.videos
        .map(video => ({ title: String(video.title || '').trim(), url: String(video.url || '').trim() }))
        .filter(video => video.url),
      plays: draft.plays
    };
    if (!preparation.focus && !preparation.videos.length && !preparation.plays.length) {
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
          preparation: { ...preparation, videoUrls: preparation.videos.map(video => video.url) }
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

  async function deletePreparation() {
    if (!authenticated || !token || !selectedMatch || !selectedRecord) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch('/api/club-data?club=' + encodeURIComponent(club.slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'delete-preparation', category, matchKey: selectedMatch.matchKey })
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error === 'Acción de persistencia desconocida.'
          ? 'El servidor todavía no tiene la opción de eliminar planes. Volvé a desplegar la versión actualizada.'
          : payload.error || 'No se pudo eliminar el plan del partido.';
        throw new Error(message);
      }
      setPreparations(current => current.filter(item => item.category !== category || item.matchKey !== selectedMatch.matchKey));
      setSelectedKey(selectedMatch.matchKey);
      setConfirmDelete(false);
      setStatus('Plan del partido eliminado. Podés volver a crearlo desde este partido.');
    } catch (deleteFailure) {
      setDeleteError(deleteFailure.message);
    } finally {
      setDeleting(false);
    }
  }

  function updatePlayList(plays) {
    setDraft(current => ({ ...current, plays }));
  }

  return (
    <section className="match-preparation-workspace">
      <header className="preparation-page-header">
        <div><span className="kicker">CUERPO TÉCNICO Y JUGADORAS</span><h2>Plan partido</h2>
          <p>Elegí un partido del fixture para consultar o preparar su plan.</p></div>
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
            <RichTextEditor value={draft.focus} onChange={focus => setDraft(current => ({ ...current, focus }))} />
          </label>
          <div className="preparation-video-editor">
            <div className="preparation-video-editor-heading">
              <div><h3>Videos de referencia</h3><small>Se guardan enlaces; los videos no se suben a la aplicación.</small></div>
              <button type="button" className="secondary" onClick={() => setDraft(current => ({ ...current, videos: [...current.videos, { title: '', url: '' }] }))} disabled={draft.videos.length >= 10}>Agregar video</button>
            </div>
            {draft.videos.map((video, index) => (
              <div className="preparation-video-fields" key={index}>
                <label>Título del video
                  <input maxLength="100" value={video.title} placeholder={`Video ${index + 1}`} onChange={event => setDraft(current => ({
                    ...current,
                    videos: current.videos.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item)
                  }))} />
                </label>
                <label>Enlace de Drive o YouTube
                  <input type="url" maxLength="1000" value={video.url} placeholder="https://..." onChange={event => setDraft(current => ({
                    ...current,
                    videos: current.videos.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item)
                  }))} />
                </label>
                <button type="button" className="secondary" aria-label={`Quitar video ${index + 1}`} onClick={() => setDraft(current => ({
                  ...current,
                  videos: current.videos.filter((_, itemIndex) => itemIndex !== index)
                }))}>Quitar</button>
              </div>
            ))}
          </div>
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
          {authenticated && <div className="preparation-view-actions">
            <button type="button" className="secondary" onClick={beginEdit}>Editar plan</button>
            <button type="button" className="secondary preparation-delete-button" onClick={() => { setConfirmDelete(true); setDeleteError(''); }}>Eliminar plan</button>
          </div>}
          {authenticated && confirmDelete && (
            <div className="preparation-delete-confirm" role="alertdialog" aria-label="Confirmar eliminación del plan">
              <p>¿Eliminar el plan de {selectedMatch.round} · {selectedMatch.opponent}? Se borrarán su foco, videos y jugadas.</p>
              {deleteError && <p className="message error" role="alert">{deleteError}</p>}
              <div>
                <button type="button" className="preparation-delete-button" onClick={deletePreparation} disabled={deleting}>{deleting ? 'Eliminando...' : 'Sí, eliminar plan'}</button>
                <button type="button" className="secondary" onClick={() => { setConfirmDelete(false); setDeleteError(''); }} disabled={deleting}>Cancelar</button>
              </div>
            </div>
          )}
          {selectedRecord.preparation.focus && <div className="match-preparation-focus" dangerouslySetInnerHTML={{ __html: cleanRichTextHtml(selectedRecord.preparation.focus) }} />}
          {getPreparationVideos(selectedRecord.preparation).length > 0 && (
            <div className="preparation-videos">
              {getPreparationVideos(selectedRecord.preparation).map((video, index) => {
                const { url } = video;
                const videoEmbed = getVideoEmbed(url);
                const sourceName = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return 'Abrir enlace'; } })();
                return videoEmbed ? (
                  <article className="preparation-video-item" key={url + index}>
                    <h4 className="preparation-video-title">{video.title || `Video de referencia ${index + 1}`}</h4>
                    <div className={`preparation-video-frame preparation-video-frame-${videoEmbed.provider.toLowerCase()}`}>
                      <PreparationVideoPlayer
                        key={url}
                        videoEmbed={videoEmbed}
                        title={`Video de referencia ${index + 1} · ${videoEmbed.provider}`}
                      />
                    </div>
                    <a href={url} target="_blank" rel="noreferrer">Abrir video {index + 1} en {videoEmbed.provider}</a>
                  </article>
                ) : (
                  <article className="preparation-video-item" key={url + index}>
                    <h4 className="preparation-video-title">{video.title || `Video de referencia ${index + 1}`}</h4>
                    <a href={url} target="_blank" rel="noreferrer">▶ Ver video {index + 1}<span>{sourceName}</span></a>
                  </article>
                );
              })}
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
          <p>{authenticated ? 'No hay partidos disponibles en el fixture. Podés cargar un partido manual para preparar su plan.' : 'El cuerpo técnico todavía no publicó planes de partido.'}</p>
          {authenticated && <button type="button" onClick={beginNew}>Cargar partido manual</button>}
        </div>
      )}
    </section>
  );
}
