import { useEffect, useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { adminApi, api } from './api';

const ADMIN_TOKEN_KEY = 'club_admin_token';
const DEFAULT_AMH_BASE_URL = 'http://15.235.75.172:8080';
const PROFILE_FIELDS = ['slug', 'name', 'shortName', 'sport', 'teamName', 'logoUrl', 'tournamentName', 'tournamentBaseUrl', 'tournamentId', 'tournamentClubId'];
const REQUIRED_FIELDS = ['slug', 'name', 'shortName', 'sport', 'teamName'];

const emptyClub = {
  slug: '',
  name: '',
  shortName: '',
  sport: 'Hockey',
  teamName: 'PLANTEL SUPERIOR',
  logoUrl: '',
  tournamentName: '',
  tournamentBaseUrl: '',
  tournamentId: '',
  tournamentClubId: '',
  tournamentAmhTeamName: '',
  tournamentDivision: '1',
  seasonName: String(new Date().getFullYear())
};

function formFromClub(club) {
  return {
    ...emptyClub,
    ...club,
    tournamentName: club.tournament?.name || '',
    tournamentBaseUrl: club.tournament?.baseUrl || '',
    tournamentId: club.tournament?.tournamentId || '',
    tournamentClubId: club.tournament?.clubId || '',
    tournamentAmhTeamName: club.tournament?.amhTeamName || '',
    tournamentDivision: club.tournament?.division || '1',
    seasonName: club.season?.name || String(new Date().getFullYear())
  };
}

function clubFromForm(form) {
  return {
    slug: form.slug,
    name: form.name,
    shortName: form.shortName,
    sport: form.sport,
    teamName: form.teamName,
    logoUrl: form.logoUrl,
    tournament: {
      name: form.tournamentName,
      baseUrl: form.tournamentBaseUrl,
      tournamentId: form.tournamentId,
      clubId: form.tournamentClubId,
      amhTeamName: form.tournamentAmhTeamName,
      division: form.tournamentDivision || '1'
    },
    season: { name: form.seasonName },
    auth: {}
  };
}

export default function AdminPortal({ onOpenWorkspace }) {
  const [clubs, setClubs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyClub);
  const [adminToken, setAdminToken] = useState(sessionStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [amhCatalog, setAmhCatalog] = useState(null);
  const [amhLoading, setAmhLoading] = useState(false);
  const [logoReading, setLogoReading] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(adminToken));

  async function loadClubs(token = adminToken) {
    const data = await adminApi(token);
    setClubs(data.clubs || []);
  }

  useEffect(() => {
    if (!adminToken) return;
    loadClubs()
      .catch(() => {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setAdminToken('');
        setMessage('La sesión de administración venció. Ingresá nuevamente.');
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken('');
  }

  function openCreate() {
    setSelected(null);
    setForm(emptyClub);
    setShowForm(true);
    setMessage('');
  }

  function openEdit(club) {
    setSelected(club);
    setForm(formFromClub(club));
    setShowForm(true);
    setMessage('');
  }

  async function loadAmhCatalog() {
    setAmhLoading(true);
    try {
      const baseUrl = form.tournamentBaseUrl || DEFAULT_AMH_BASE_URL;
      const data = await api(`/api/amh/catalog?baseUrl=${encodeURIComponent(baseUrl)}`);
      setAmhCatalog(data);
      if (form.tournamentClubId) {
        const selectedTeam = data.teams.find(item => item.value === form.tournamentClubId);
        if (selectedTeam) setForm(current => ({ ...current, tournamentAmhTeamName: selectedTeam.label }));
      }
      setMessage('Catálogo AMH cargado. Elegí el torneo y el equipo.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAmhLoading(false);
    }
  }

  function updateTournamentField(event) {
    const { name, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: value,
      ...(name === 'tournamentSelect'
        ? {
            tournamentName: amhCatalog?.tournaments.find(item => item.value === value)?.label || '',
            tournamentId: value
          }
        : {}),
      ...(name === 'tournamentClubSelect' ? {
        tournamentClubId: value,
        tournamentAmhTeamName: amhCatalog?.teams.find(item => item.value === value)?.label || ''
      } : {})
    }));
  }

  async function loginAdmin(event) {
    event.preventDefault();
    try {
      const data = await adminApi('', { method: 'POST', body: { action: 'login', password: adminPassword } });
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminToken(data.token);
      setAdminPassword('');
      await loadClubs(data.token);
      setMessage('Administrador autenticado.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function inviteClubStaff(club) {
    const email = window.prompt(`Email de Google para invitar al cuerpo técnico de ${club.name}:`);
    if (!email) return;
    const canManageAccess = window.confirm(`¿Designar a ${email.trim()} como responsable de accesos de ${club.name}?`);
    try {
      const result = await adminApi(adminToken, {
        method: 'POST',
        body: { action: 'create-staff-invite', slug: club.slug, email, canManageAccess }
      });
      const link = new URL(result.invitePath, window.location.origin).toString();
      window.prompt(`Invitación para ${result.email}. Vence en ${result.expiresInDays} días.${result.canManageAccess ? ' Será responsable de accesos.' : ''} Copiá este enlace y envialo:`, link);
    } catch (error) { setMessage(error.message); }
  }

  async function deleteClub(club) {
    const confirmation = window.prompt(
      `Esta acción eliminará el club y todos sus datos asociados. Para confirmar, escribí exactamente el slug: ${club.slug}`
    );
    if (confirmation === null) return;
    if (confirmation !== club.slug) {
      setMessage('El slug no coincide. No se eliminó el club.');
      return;
    }
    try {
      await adminApi(adminToken, { method: 'DELETE', body: { slug: club.slug, confirmSlug: confirmation } });
      setClubs(current => current.filter(item => item.slug !== club.slug));
      setMessage(`${club.name || club.slug} y sus datos asociados fueron eliminados.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveClub(event) {
    event.preventDefault();
    if (logoReading) {
      setMessage('Esperá a que termine de cargar el escudo.');
      return;
    }
    try {
      await adminApi(adminToken, {
        method: selected ? 'PATCH' : 'POST',
        body: { slug: selected?.slug, club: clubFromForm(form) }
      });
      setMessage(selected ? 'Perfil actualizado.' : 'Club creado.');
      setShowForm(false);
      await loadClubs();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('La foto o escudo debe ser una imagen válida (PNG, JPG, WEBP, SVG).');
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage('La imagen no puede superar 1 MB.');
      return;
    }
    setLogoReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setForm(current => ({ ...current, logoUrl: String(reader.result) }));
      setLogoReading(false);
      setMessage('Foto o escudo cargado. Guardá los cambios para persistirlo.');
    };
    reader.onerror = () => {
      setLogoReading(false);
      setMessage('No se pudo leer el archivo del escudo.');
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="portal">
      <section className="shell">
        <a className="admin-back-link" href="/">← Volver al portal</a>
        <h1>Administración</h1>
        <p className="intro">Gestión de clubes. El acceso requiere credenciales de administrador.</p>
        {message && <div className="message">{message}</div>}
        <div className="toolbar">
          {!adminToken ? (
            <form className="admin-login" onSubmit={loginAdmin}>
              <input
                type="password"
                placeholder="Contraseña de administrador"
                value={adminPassword}
                onChange={event => setAdminPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button>Ingresar</button>
            </form>
          ) : (
            <>
              <button onClick={openCreate}>+ Agregar club</button>
              <button className="secondary" onClick={logout}>Cerrar sesión</button>
            </>
          )}
        </div>
        {loading ? (
          <p>Cargando clubes...</p>
        ) : adminToken && (
          <div className="club-list">
            {clubs.map(club => (
              <article className="club-card" key={club.slug}>
                <a
                  href={`/?club=${encodeURIComponent(club.slug)}`}
                  onClick={event => {
                    event.preventDefault();
                    onOpenWorkspace(club);
                  }}
                >
                  <img src={club.logoUrl || '/escudo-regatas-andino.png'} alt="" />
                  <span>
                    <strong>{club.shortName || club.name}</strong>
                    <small>{club.sport} · {club.teamName}</small>
                  </span>
                  <b>→</b>
                </a>
                <div className="club-card-actions">
                  <details className="club-options">
                    <summary aria-label={`Opciones de ${club.name || club.slug}`} title="Opciones del club"><Ellipsis size={20} /></summary>
                    <div className="club-options-menu">
                      <button type="button" onClick={() => openEdit(club)}>Editar perfil</button>
                      <button type="button" onClick={() => inviteClubStaff(club)}>Invitar cuerpo técnico</button>
                      <button type="button" className="danger" onClick={() => deleteClub(club)}>Eliminar club</button>
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {adminToken && showForm && (
        <div className="overlay">
          <form className="form-card" onSubmit={saveClub}>
            <button type="button" className="close" onClick={() => setShowForm(false)}>
              ×
            </button>
            <h2>{selected ? 'Perfil del club' : 'Agregar club'}</h2>
            {PROFILE_FIELDS.map(name => (
              <label key={name}>
                {name}
                <input
                  name={name}
                  value={form[name]}
                  onChange={updateField}
                  type={name.toLowerCase().includes('url') ? 'url' : 'text'}
                  required={REQUIRED_FIELDS.includes(name)}
                  readOnly={selected && name === 'slug'}
                />
              </label>
            ))}
            <label>
              Foto o escudo del club
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} />
            </label>
            {form.logoUrl && (
              <div className="logo-preview">
                <img src={form.logoUrl} alt="Vista previa del club" />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setForm(current => ({ ...current, logoUrl: '' }))}
                >
                  Quitar imagen
                </button>
              </div>
            )}
            <label>
              Temporada activa
              <input
                name="seasonName"
                value={form.seasonName}
                onChange={updateField}
                maxLength={60}
                placeholder="2027"
                required
              />
              <small>Citaciones, botonera, estadísticas, evaluaciones y seguimiento se guardan por temporada. Al iniciar otra, cambiá este nombre y seleccioná su torneo AMH.</small>
            </label>
            <fieldset className="amh-selector">
              <legend>Configurar torneo desde AMH</legend>
              <p>Buscá los datos oficiales sin cargar IDs manualmente.</p>
              <label>
                URL base de AMH
                <input
                  name="tournamentBaseUrl"
                  value={form.tournamentBaseUrl}
                  onChange={updateField}
                  placeholder={DEFAULT_AMH_BASE_URL}
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={loadAmhCatalog}
                disabled={amhLoading}
              >
                {amhLoading ? 'Buscando en AMH...' : 'Buscar torneos y equipos'}
              </button>
              {amhCatalog && (
                <>
                  <label>
                    Torneo
                    <select name="tournamentSelect" value={form.tournamentId} onChange={updateTournamentField}>
                      <option value="">Seleccioná un torneo</option>
                      {amhCatalog.tournaments.map(item => (
                        <option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Equipo
                    <select name="tournamentClubSelect" value={form.tournamentClubId} onChange={updateTournamentField}>
                      <option value="">Seleccioná un equipo</option>
                      {amhCatalog.teams.map(item => (
                        <option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    División AMH
                    <select name="tournamentDivision" value={form.tournamentDivision || '1'} onChange={updateField}>
                      {amhCatalog.divisions.map(item => (
                        <option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </fieldset>
            <p className="auth-settings-help">El acceso del cuerpo técnico se asigna por invitación y cuenta Google individual.</p>
            <button type="submit" disabled={logoReading}>
              {logoReading ? 'Cargando escudo...' : selected ? 'Guardar cambios' : 'Crear club'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
