import { useState } from 'react';
import GoogleIdentityButton from './GoogleIdentityButton';

export default function StaffLoginDialog({ googleClientId, onCredential, onClose }) {
  const [error, setError] = useState('');
  return (
    <div className="overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="form-card staff-login-card" role="dialog" aria-modal="true" aria-labelledby="staffLoginTitle">
        <button type="button" className="close" aria-label="Cerrar" onClick={onClose}>×</button>
        <span className="kicker">ACCESO PRIVADO</span>
        <h2 id="staffLoginTitle">Cuerpo técnico</h2>
        <p>Ingresá con la cuenta Google que recibió la invitación del club.</p>
        {googleClientId ? (
          <GoogleIdentityButton clientId={googleClientId} onCredential={onCredential} onError={loginError => setError(loginError.message)} />
        ) : <p className="message error">El acceso con Google todavía no está configurado.</p>}
        {error && <p className="message error" role="alert">{error}</p>}
        <button type="button" className="secondary" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
