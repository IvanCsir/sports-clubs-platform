import { useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function HockeyTacticalBoard({ value = [], onChange, interactive = false, animated = false }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [selected, setSelected] = useState(null);
  const markers = Array.isArray(value) ? value : [];

  function addMarker(side) {
    const marker = {
      id: 'marker-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      side,
      x: 50,
      y: side === 'own' ? 67 : side === 'opponent' ? 33 : 50
    };
    onChange([...markers, marker]);
    setSelected(marker.id);
  }

  function moveMarker(event) {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 3, 97);
    onChange(markers.map(marker => marker.id === dragging ? { ...marker, x, y } : marker));
  }

  function finishDrag() {
    setDragging(null);
  }

  function removeSelected() {
    if (!selected) return;
    onChange(markers.filter(marker => marker.id !== selected));
    setSelected(null);
  }

  return (
    <div className={'tactical-board' + (interactive ? ' is-editable' : '')}>
      {interactive && (
        <div className="tactical-board-tools">
          <button type="button" className="secondary" onClick={() => addMarker('own')}>+ Mi equipo</button>
          <button type="button" className="secondary" onClick={() => addMarker('opponent')}>+ Rival</button>
          <button type="button" className="secondary" onClick={() => addMarker('ball')}>+ Bocha</button>
          <button type="button" className="secondary" onClick={removeSelected} disabled={!selected}>Quitar seleccionada</button>
          <small>Arrastrá las fichas para ubicarlas.</small>
        </div>
      )}
      <svg
        ref={svgRef}
        className="tactical-board-field"
        viewBox="0 0 900 600"
        role="img"
        aria-label="Pizarra táctica de hockey"
        onPointerMove={interactive ? moveMarker : undefined}
        onPointerUp={interactive ? finishDrag : undefined}
        onPointerCancel={interactive ? finishDrag : undefined}
      >
        <rect x="12" y="12" width="876" height="576" rx="18" className="field-surface" />
        <rect x="35" y="35" width="830" height="530" rx="8" className="field-line" />
        <line x1="450" y1="35" x2="450" y2="565" className="field-line" />
        <circle cx="450" cy="300" r="65" className="field-line" />
        <circle cx="450" cy="300" r="5" className="field-mark" />
        <line x1="244" y1="35" x2="244" y2="565" className="field-line" />
        <line x1="656" y1="35" x2="656" y2="565" className="field-line" />
        <path d="M35 167 A133 133 0 0 1 35 433 M865 167 A133 133 0 0 0 865 433" className="field-line" />
        <circle cx="99" cy="300" r="4" className="field-mark" />
        <circle cx="801" cy="300" r="4" className="field-mark" />
        <path d="M35 48 Q48 48 48 35 M852 35 Q852 48 865 48 M35 552 Q48 552 48 565 M852 565 Q852 552 865 552" className="field-line" />
        <rect x="16" y="276" width="19" height="48" rx="3" className="field-goal" />
        <rect x="865" y="276" width="19" height="48" rx="3" className="field-goal" />
        {markers.map(marker => (
          <g
            key={marker.id}
            className={'tactical-marker ' + marker.side + (selected === marker.id && interactive ? ' selected' : '')}
            transform={'translate(' + marker.x * 9 + ' ' + marker.y * 6 + ')'}
            style={animated ? { transition: 'transform 800ms ease-in-out' } : undefined}
            onPointerDown={interactive ? event => {
              event.preventDefault();
              event.stopPropagation();
              svgRef.current?.setPointerCapture(event.pointerId);
              setDragging(marker.id);
              setSelected(marker.id);
            } : undefined}
          >
            <circle r={marker.side === 'ball' ? 9 : 25} />
          </g>
        ))}
      </svg>
      <div className="tactical-board-legend">
        <span><i className="own-dot" /> Mi equipo</span>
        <span><i className="opponent-dot" /> Rival</span>
        <span><i className="ball-dot" /> Bocha</span>
      </div>
    </div>
  );
}
