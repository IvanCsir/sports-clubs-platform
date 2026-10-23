import { useEffect, useState } from 'react';

export default function SunModeToggle() {
  const [sunMode, setSunMode] = useState(() => {
    return localStorage.getItem('dt_sun_mode') === 'true';
  });

  useEffect(() => {
    if (sunMode) {
      document.body.classList.add('dt-sun-mode');
      localStorage.setItem('dt_sun_mode', 'true');
    } else {
      document.body.classList.remove('dt-sun-mode');
      localStorage.setItem('dt_sun_mode', 'false');
    }
  }, [sunMode]);

  return (
    <button
      type="button"
      className={`sun-mode-btn ${sunMode ? 'active' : ''}`}
      onClick={() => setSunMode(prev => !prev)}
      title="Modo Sol: Alto contraste para la cancha bajo luz solar directa"
    >
      {sunMode ? '☀️ Modo Sol ACTIVO' : '☀️ Modo Sol'}
    </button>
  );
}

