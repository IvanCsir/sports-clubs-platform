import { Fragment, useEffect, useState } from 'react';

const PLAYER_SECTION_IDS = ['inicio', 'citaciones', 'preparacion', 'torneo', 'seguimiento', 'fisico'];
const STAFF_GROUPS = [
  { id: 'planificacion', label: 'Planificación', sectionIds: ['citaciones', 'fisico', 'seguimiento'] },
  { id: 'partido', label: 'Partido', sectionIds: ['preparacion', 'dt', 'stats'] },
  { id: 'administracion', label: 'Administración', sectionIds: ['jugadoras', 'accesos', 'respaldo'] }
];

export function workspaceSections(authenticated, canManageAccess) {
  return [
    { id: 'inicio', label: 'Inicio' },
    { id: 'citaciones', label: 'Citaciones' },
    { id: 'preparacion', label: 'Plan partido' },
    { id: 'torneo', label: 'Torneos' },
    { id: 'fisico', label: 'Evaluaciones físicas' },
    { id: 'seguimiento', label: 'Seguimiento' },
    ...(authenticated ? [
      { id: 'jugadoras', label: 'Plantel' },
      { id: 'dt', label: 'Botonera DT' },
      { id: 'stats', label: 'Estadísticas' },
      { id: 'respaldo', label: 'Respaldo' },
      ...(canManageAccess ? [{ id: 'accesos', label: 'Accesos del cuerpo técnico' }] : [])
    ] : [])
  ];
}

// Navegación del club: pestañas para jugadoras, grupos desplegables para el cuerpo
// técnico y un menú lateral en pantallas chicas.
export default function WorkspaceNav({ club, view, sections, authenticated, onSelect, onLogin, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(false);
  // Al cambiar de sección (también desde los accesos del inicio) se cierran los menús.
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenGroup(false);
  }, [view]);
  const groups = STAFF_GROUPS.map(group => ({
    ...group,
    sections: group.sectionIds.map(id => sections.find(section => section.id === id)).filter(Boolean)
  })).filter(group => group.sections.length > 0);
  const activeGroup = groups.find(group => group.sections.some(section => section.id === view));
  const playerSections = PLAYER_SECTION_IDS.map(id => sections.find(section => section.id === id)).filter(Boolean);
  const matchGroups = groups.filter(group => group.id !== 'administracion');
  const adminGroups = groups.filter(group => group.id === 'administracion');
  const expandedGroup = groups.find(group => group.id === openGroup);

  function select(id) {
    setMobileMenuOpen(false);
    setOpenGroup(false);
    onSelect(id);
  }

  const groupToggle = group => (
    <button
      type="button"
      key={group.id}
      className={`workspace-nav-more${activeGroup?.id === group.id ? ' active' : ''}`}
      aria-expanded={openGroup === group.id}
      onClick={() => setOpenGroup(open => open === group.id ? false : group.id)}
    >{group.label} <span aria-hidden="true">{openGroup === group.id ? '−' : '+'}</span></button>
  );

  const mobileItem = section => (
    <button
      type="button"
      key={section.id}
      className={`mobile-menu-item${view === section.id ? ' active' : ''}`}
      aria-current={view === section.id ? 'page' : undefined}
      onClick={() => select(section.id)}
    >{section.label}<span aria-hidden="true">→</span></button>
  );

  const mobileGroups = list => list.map(group => (
    <Fragment key={group.id}>
      <p className="mobile-menu-group-label">{group.label.toLocaleUpperCase('es-AR')}</p>
      {group.sections.map(mobileItem)}
    </Fragment>
  ));

  return (
    <>
      <button
        type="button"
        className="mobile-menu-trigger secondary"
        aria-expanded={mobileMenuOpen}
        aria-controls="workspace-mobile-menu"
        onClick={() => setMobileMenuOpen(true)}
      >
        <span aria-hidden="true">☰</span> Menú <small>{sections.find(section => section.id === view)?.label}</small>
      </button>
      <nav className="workspace-nav" aria-label="Secciones del club">
        {!authenticated ? playerSections.map(section => (
          <button key={section.id} className={view === section.id ? 'active' : ''} onClick={() => select(section.id)}>{section.label}</button>
        )) : <>
          <button className={view === 'inicio' ? 'active' : ''} onClick={() => select('inicio')}>Inicio</button>
          {matchGroups.map(groupToggle)}
          <button className={view === 'torneo' ? 'active' : ''} onClick={() => select('torneo')}>Torneos</button>
          {adminGroups.map(groupToggle)}
        </>}
      </nav>
      {expandedGroup && (
        <nav className="workspace-nav-secondary" aria-label={expandedGroup.label}>
          {expandedGroup.sections.map(section => (
            <button key={section.id} className={view === section.id ? 'active' : ''} onClick={() => select(section.id)}>{section.label}</button>
          ))}
        </nav>
      )}
      {mobileMenuOpen && (
        <div className="mobile-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
          <nav id="workspace-mobile-menu" className="mobile-menu-drawer" aria-label="Menú del club">
            <div className="mobile-menu-heading">
              <div><span className="kicker">{club.shortName}</span><h2>Secciones</h2></div>
              <button type="button" className="secondary mobile-menu-close" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)}>×</button>
            </div>
            {!authenticated ? playerSections.map(mobileItem) : <>
              <p className="mobile-menu-group-label">GENERAL</p>
              {mobileItem({ id: 'inicio', label: 'Inicio' })}
              {mobileGroups(matchGroups)}
              <p className="mobile-menu-group-label">COMPETENCIA</p>
              {mobileItem({ id: 'torneo', label: 'Torneos' })}
              {mobileGroups(adminGroups)}
            </>}
            <div className="mobile-menu-footer">
              <button type="button" className="mobile-staff-access" onClick={() => { setMobileMenuOpen(false); authenticated ? onLogout() : onLogin(); }}>
                {authenticated ? 'Salir del cuerpo técnico' : 'Acceso cuerpo técnico'}
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
