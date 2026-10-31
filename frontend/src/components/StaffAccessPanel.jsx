import { useEffect, useState } from 'react';
import { fetchClubDataset, postClubAction } from '../api';

export default function StaffAccessPanel({ club, token }) {
  const [email, setEmail] = useState('');
  const [grantAccessManagement, setGrantAccessManagement] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [message, setMessage] = useState('');
  const [staff, setStaff] = useState([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(true);
  async function loadStaff() {
    setLoadingStaff(true);
    try {
      const payload = await fetchClubDataset(club.slug, 'staff-access', { token, fallbackError: 'No se pudieron cargar los accesos.' });
      setStaff(payload.staff || []);
      setCurrentEmail(String(payload.currentEmail || '').toLowerCase());
    } catch (error) { setMessage(error.message); }
    finally { setLoadingStaff(false); }
  }
  useEffect(() => { loadStaff(); }, [club.slug, token]);
  async function invite(event) {
    event.preventDefault();
    setMessage('Creando invitación…');
    setInviteUrl('');
    try {
      const payload = await postClubAction(club.slug, 'create-staff-invite', { email, canManageAccess: grantAccessManagement },
        { token, fallbackError: 'No se pudo crear la invitación.' });
      setInviteUrl(new URL(payload.invitePath, window.location.origin).toString());
      setMessage(`Invitación para ${payload.email}. Vence en ${payload.expiresInDays} días.${payload.canManageAccess ? ' También será responsable de accesos.' : ''}`);
      setEmail('');
      setGrantAccessManagement(false);
    } catch (error) { setMessage(error.message); }
  }
  async function revoke(user) {
    if (!window.confirm(`¿Quitar el acceso de ${user.email}?`)) return;
    try {
      await postClubAction(club.slug, 'revoke-staff-user', { userId: user.id }, { token, fallbackError: 'No se pudo quitar el acceso.' });
      setMessage(`Se quitó el acceso de ${user.email}.`);
      await loadStaff();
    } catch (error) { setMessage(error.message); }
  }
  async function setAccessManager(user, canManageAccess) {
    const confirmation = canManageAccess
      ? `¿Designar a ${user.email} como responsable de accesos?`
      : `¿Quitarle a ${user.email} el permiso para administrar accesos?`;
    if (!window.confirm(confirmation)) return;
    try {
      await postClubAction(club.slug, 'set-staff-access-manager', { userId: user.id, canManageAccess },
        { token, fallbackError: 'No se pudo actualizar el responsable de accesos.' });
      setMessage(canManageAccess ? `${user.email} ahora puede administrar los accesos.` : `Se quitó a ${user.email} el permiso para administrar accesos.`);
      await loadStaff();
    } catch (error) { setMessage(error.message); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setMessage('Enlace copiado.'); }
    catch (_) { setMessage('No se pudo copiar automáticamente. Seleccioná y copiá el enlace.'); }
  }
  return (
    <section className="players-section staff-access-panel">
      <h2>Invitar a otra persona</h2>
      <p>Solo las personas responsables de accesos pueden invitar o quitar cuentas. El club debe conservar al menos una persona responsable.</p>
      <p>La persona recibirá un enlace para registrarse con Google. La invitación solo funciona con este email y vence en siete días.</p>
      <form onSubmit={invite}>
        <label>Email de Google
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} />
        </label>
        <label className="staff-manager-checkbox">
          <input type="checkbox" checked={grantAccessManagement} onChange={event => setGrantAccessManagement(event.target.checked)} />
          También podrá invitar y quitar accesos
        </label>
        <button type="submit">Crear invitación</button>
      </form>
      {message && <p className="message" role="status">{message}</p>}
      {inviteUrl && <><label>Enlace de invitación<input readOnly value={inviteUrl} onFocus={event => event.target.select()} /></label><button type="button" className="secondary" onClick={copyInvite}>Copiar enlace</button></>}
      <h3>Accesos activos</h3>
      {loadingStaff ? <p>Cargando accesos…</p> : staff.length ? (
        <ul className="staff-access-list">{staff.map(user => (
          <li key={user.id}><span><strong>{user.displayName || user.email}</strong><small>{user.displayName ? user.email : 'Cuerpo técnico'}{user.canManageAccess ? ' · Responsable de accesos' : ''}</small></span>
            {user.email.toLowerCase() === currentEmail ? <small>Tu cuenta</small> : (
              <div className="staff-access-actions">
                <button type="button" className="secondary" onClick={() => setAccessManager(user, !user.canManageAccess)}>
                  {user.canManageAccess ? 'Quitar permiso' : 'Hacer responsable'}
                </button>
                <button type="button" className="secondary" onClick={() => revoke(user)}>Quitar acceso</button>
              </div>
            )}
          </li>
        ))}</ul>
      ) : <p>No hay cuentas Google activas.</p>}
    </section>
  );
}
