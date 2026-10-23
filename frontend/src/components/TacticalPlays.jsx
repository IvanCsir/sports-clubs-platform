import { useEffect, useState } from 'react';
import HockeyTacticalBoard from './HockeyTacticalBoard';

function copyMarkers(markers) {
  return (markers || []).map(marker => ({ ...marker }));
}

export default function TacticalPlays({ plays = [], onChange, editable = false }) {
  const [selectedId, setSelectedId] = useState('');
  const [workingMarkers, setWorkingMarkers] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [playFrame, setPlayFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activePlay = plays.find(play => play.id === selectedId) || plays[0] || null;
  const frames = activePlay?.frames || [];

  useEffect(() => {
    if (!selectedId && plays[0]) setSelectedId(plays[0].id);
  }, [plays, selectedId]);

  useEffect(() => {
    const play = plays.find(item => item.id === selectedId) || (!selectedId ? plays[0] : null);
    if (play) {
      setSelectedFrame(0);
      setWorkingMarkers(copyMarkers(play.frames?.[0]));
    }
  }, [selectedId]);

  useEffect(() => {
    setPlaying(false);
    setPlayFrame(0);
  }, [selectedId]);

  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const timer = setInterval(() => {
      setPlayFrame(index => {
        if (index >= frames.length - 1) {
          setPlaying(false);
          return 0;
        }
        return index + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [playing, frames.length]);

  function updatePlay(id, updater) {
    onChange(plays.map(play => play.id === id ? updater(play) : play));
  }

  function addPlay() {
    const play = { id: 'play-' + Date.now(), title: 'Nueva jugada', frames: [] };
    onChange([...plays, play]);
    setSelectedId(play.id);
    setSelectedFrame(0);
    setWorkingMarkers([]);
  }

  function removePlay() {
    if (!activePlay) return;
    const remaining = plays.filter(play => play.id !== activePlay.id);
    onChange(remaining);
    setSelectedId(remaining[0]?.id || '');
    setSelectedFrame(0);
    setWorkingMarkers(copyMarkers(remaining[0]?.frames?.[0]));
  }

  function selectFrame(index) {
    setSelectedFrame(index);
    setWorkingMarkers(copyMarkers(frames[index]));
  }

  function saveStep() {
    if (!activePlay || !workingMarkers.length || frames.length >= 30) return;
    const nextFrames = [...frames, copyMarkers(workingMarkers)];
    updatePlay(activePlay.id, play => ({ ...play, frames: nextFrames }));
    setSelectedFrame(nextFrames.length - 1);
  }

  function deleteStep(index) {
    if (!activePlay || index < 0 || index >= frames.length) return;
    const nextFrames = frames.filter((_, frameIndex) => frameIndex !== index);
    updatePlay(activePlay.id, play => ({ ...play, frames: nextFrames }));
    let nextSelected = selectedFrame;
    if (index < selectedFrame) nextSelected -= 1;
    else if (index === selectedFrame) nextSelected = Math.min(index, nextFrames.length - 1);
    if (nextFrames.length) nextSelected = Math.max(0, Math.min(nextSelected, nextFrames.length - 1));
    else nextSelected = 0;
    setSelectedFrame(nextSelected);
    if (index <= selectedFrame || !nextFrames.length) {
      setWorkingMarkers(copyMarkers(nextFrames[nextSelected]));
    }
  }

  function deleteAllSteps() {
    if (!activePlay || !frames.length || !window.confirm('¿Eliminar todos los pasos de esta jugada?')) return;
    updatePlay(activePlay.id, play => ({ ...play, frames: [] }));
    setSelectedFrame(0);
    setWorkingMarkers([]);
    setPlaying(false);
    setPlayFrame(0);
  }

  function selectPlay(play) {
    setSelectedId(play.id);
    setSelectedFrame(0);
    setWorkingMarkers(copyMarkers(play.frames?.[0]));
  }

  if (!editable && !plays.length) return <p className="empty-state">Todavía no hay jugadas cargadas.</p>;

  return (
    <div className="tactical-plays">
      <div className="tactical-play-list" aria-label="Jugadas">
        {plays.map((play, index) => (
          <button
            type="button"
            key={play.id}
            className={activePlay?.id === play.id ? 'active' : ''}
            onClick={() => selectPlay(play)}
          >
            <span>{play.title || 'Jugada ' + (index + 1)}</span>
            <small>{(play.frames || []).length} pasos</small>
          </button>
        ))}
        {editable && <button type="button" className="add-tactical-play" onClick={addPlay}>+ Nueva jugada</button>}
      </div>
      {activePlay ? (
        <div className="tactical-play-content">
          {editable ? (
            <div className="tactical-play-edit-title">
              <input
                aria-label="Nombre de la jugada"
                maxLength="80"
                value={activePlay.title || ''}
                onChange={event => updatePlay(activePlay.id, play => ({ ...play, title: event.target.value }))}
              />
              <button type="button" className="secondary" onClick={removePlay}>Eliminar jugada</button>
            </div>
          ) : <h3>{activePlay.title || 'Jugada'}</h3>}
          {editable ? (
            <>
              <p className="preparation-help">Armá la posición inicial, mové las fichas y guardá cada momento como un paso.</p>
              <HockeyTacticalBoard value={workingMarkers} onChange={setWorkingMarkers} interactive />
              <div className="tactical-frame-tools">
                <button type="button" onClick={saveStep} disabled={!workingMarkers.length || frames.length >= 30}>
                  Guardar paso {frames.length + 1}
                </button>
                {frames.length > 0 && <button type="button" className="secondary" onClick={() => setWorkingMarkers(copyMarkers(frames.at(-1)))}>Volver al último paso</button>}
              </div>
              {frames.length > 0 && (
                <>
                  <div className="tactical-frame-list" aria-label="Pasos guardados">
                    {frames.map((_, index) => (
                      <button type="button" key={index} className={selectedFrame === index ? 'active' : ''} onClick={() => selectFrame(index)}>
                        Paso {index + 1}
                      </button>
                    ))}
                  </div>
                  <div className="tactical-frame-delete-tools">
                    <button type="button" className="secondary" onClick={() => deleteStep(selectedFrame)}>
                      Eliminar paso {selectedFrame + 1}
                    </button>
                    <button type="button" className="secondary" onClick={deleteAllSteps}>Eliminar todos los pasos</button>
                  </div>
                </>
              )}
            </>
          ) : frames.length ? (
            <>
              <HockeyTacticalBoard value={frames[Math.min(playFrame, frames.length - 1)] || []} animated={playing} />
              <div className="tactical-playback-tools">
                <button type="button" className="secondary" onClick={() => { setPlaying(false); setPlayFrame(index => Math.max(0, index - 1)); }} disabled={playFrame === 0}>← Anterior</button>
                <button type="button" onClick={() => {
                  if (frames.length < 2) return;
                  if (playFrame >= frames.length - 1) setPlayFrame(0);
                  setPlaying(value => !value);
                }} disabled={frames.length < 2}>{playing ? 'Pausar' : 'Reproducir'}</button>
                <button type="button" className="secondary" onClick={() => { setPlaying(false); setPlayFrame(index => Math.min(frames.length - 1, index + 1)); }} disabled={playFrame >= frames.length - 1}>Siguiente →</button>
                <small>Paso {playFrame + 1} de {frames.length}</small>
              </div>
            </>
          ) : <p className="empty-state">Esta jugada todavía no tiene pasos guardados.</p>}
        </div>
      ) : editable ? (
        <p className="empty-state">Creá una jugada para empezar a dibujarla.</p>
      ) : null}
    </div>
  );
}
