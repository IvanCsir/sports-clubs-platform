import { useEffect, useState } from 'react';
import ClubWorkspace from './ClubWorkspace';
import AdminPortal from './AdminPortal';
import LandingPage from './LandingPage';
import { fetchClubConfig } from './api';

function useDocumentBranding(isLandingRoute, workspaceClub) {
  useEffect(() => {
    document.title = isLandingRoute ? 'Blue Hockey | Gestión deportiva para hockey' : 'Blue Hockey';
  }, [isLandingRoute]);

  useEffect(() => {
    const favicon = document.querySelector('link[rel~="icon"]');
    if (!favicon) return;
    favicon.href = isLandingRoute ? '/blue-hockey-icon.png' : workspaceClub?.logoUrl || '/blue-hockey-icon.png';
    favicon.type = isLandingRoute || !workspaceClub?.logoUrl ? 'image/png'
      : workspaceClub.logoUrl.startsWith('data:image/')
        ? workspaceClub.logoUrl.slice(5, workspaceClub.logoUrl.indexOf(';'))
        : '';
  }, [workspaceClub, isLandingRoute]);
}

// Rutas: /inicio (landing), /admin (administración) y /?club=slug (espacio del club).
function App() {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isLandingRoute = normalizedPath === '/inicio';
  const isAdminRoute = normalizedPath === '/admin';
  const requestedSlug = !isAdminRoute ? new URLSearchParams(window.location.search).get('club') : null;
  const [workspaceClub, setWorkspaceClub] = useState(null);
  const [workspaceAdminOrigin, setWorkspaceAdminOrigin] = useState(false);
  const [loading, setLoading] = useState(Boolean(requestedSlug));
  const [message, setMessage] = useState('');
  useDocumentBranding(isLandingRoute, workspaceClub);

  useEffect(() => {
    if (!requestedSlug) return;
    fetchClubConfig(requestedSlug)
      .then(data => setWorkspaceClub(data.club ? { ...data.club, googleClientId: data.googleClientId || '' } : null))
      .catch(error => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  if (isLandingRoute) return <LandingPage />;

  if (loading) {
    return (
      <main className="club-bootstrap" role="status" aria-live="polite">
        <span>Abriendo el club...</span>
      </main>
    );
  }

  if (workspaceClub) {
    return (
      <ClubWorkspace
        club={workspaceClub}
        showAdminBack={workspaceAdminOrigin}
        onBack={() => {
          setWorkspaceClub(null);
          setWorkspaceAdminOrigin(false);
          window.history.pushState({}, '', '/admin');
        }}
      />
    );
  }

  if (isAdminRoute) {
    return (
      <AdminPortal
        onOpenWorkspace={club => {
          setWorkspaceAdminOrigin(true);
          setWorkspaceClub(club);
          window.history.pushState({}, '', `/?club=${encodeURIComponent(club.slug)}`);
        }}
      />
    );
  }

  return (
    <main className="portal">
      <section className="shell">
        <span className="kicker">BLUE HOCKEY</span>
        <h1>Ingresá a tu club</h1>
        <p className="intro">Abrí el enlace que te compartió el cuerpo técnico de tu club.</p>
        {message && <div className="message">{message}</div>}
      </section>
    </main>
  );
}

export default App;
