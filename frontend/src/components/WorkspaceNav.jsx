import { Fragment, useEffect, useState } from 'react';
import { ClipboardList, House, Menu, Trophy, X } from 'lucide-react';

const PLAYER_SECTION_IDS = ['inicio', 'citaciones', 'preparacion', 'torneo', 'seguimiento', 'fisico'];
// Orden del cuerpo técnico: lo que se usa todos los días queda a un toque, el resto va agrupado.
const STAFF_ITEMS = [
  { type: 'link', id: 'inicio' },
  { type: 'link', id: 'citaciones' },
  { type: 'group', id: 'partido', label: 'Partido', sectionIds: ['preparacion', 'dt', 'stats'] },
  { type: 'link', id: 'torneo' },
  { type: 'group', id: 'equipo', label: 'Equipo', sectionIds: ['jugadoras', 'fisico', 'seguimiento'] },
  { type: 'group', id: 'administracion', label: 'Administración', sectionIds: ['accesos', 'respaldo'] }
];
const BOTTOM_BAR = [
  { id: 'inicio', label: 'Inicio', Icon: House },
  { id: 'citaciones', label: 'Citaciones', Icon: ClipboardList },
  { id: 'torneo', label: 'Torneos', Icon: Trophy }
];

export function workspaceSections(authenticated, canManageAccess) {
  return [
    { id: 'inicio', label: 'Inicio' },
    { id: 'citaciones', label: 'Citaciones' },
    { id: 'preparacion', label: 'Plan de partido' },
    { id: 'torneo', label: 'Torneos' },
    { id: 'fisico', label: 'Evaluaciones físicas' },
    { id: 'seguimiento', label: 'Seguimiento' },
    ...(authenticated ? [
      { id: 'jugadoras', label: 'Plantel' },
      { id: 'dt', label: 'Botonera' },
      { id: 'stats', label: 'Estadísticas' },
      { id: 'respaldo', label: 'Respaldo' },
      ...(canManageAccess ? [{ id: 'accesos', label: 'Accesos' }] : [])
    ] : [])
  ];
}

// Navegación del club: pestañas para jugadoras, grupos desplegables para el cuerpo
// técnico y, en pantallas chicas, barra inferior con los destinos frecuentes más un menú.
export default function WorkspaceNav({ club, view, sections, authenticated, onSelect, onLogin, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(false);
  // Al cambiar de sección (también desde los accesos del inicio) se cierran los menús.
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenGroup(false);
  }, [view]);
  const byId = id => sections.find(section => section.id === id);
  const items = STAFF_ITEMS.map(item => item.type === 'group'
    ? { ...item, sections: item.sectionIds.map(byId).filter(Boolean) }
    : { ...item, section: byId(item.id) }
  ).filter(item => item.type === 'group' ? item.sections.length > 0 : item.section);
  const groups = items.filter(item => item.type === 'group');
  const activeGroup = groups.find(group => group.sections.some(section => section.id === view));
  const playerSections = PLAYER_SECTION_IDS.map(byId).filter(Boolean);
  // El submenú del grupo activo queda visible para saber en qué sección se está; abrir otro grupo lo reemplaza.
  const expandedGroup = groups.find(group => group.id === openGroup) || activeGroup;
  const inBottomBar = BOTTOM_BAR.some(item => item.id === view);

  function select(id) {
    setMobileMenuOpen(false);
    setOpenGroup(false);
    onSelect(id);
  }

  const tab = section => (
    <button
      type="button"
      key={section.id}
      className={view === section.id ? 'active' : ''}
      aria-current={view === section.id ? 'page' : undefined}
      onClick={() => select(section.id)}
    >{section.label}</button>
  );

  const groupToggle = group => (
    <button
      type="button"
      key={group.id}
      className={`workspace-nav-more${activeGroup?.id === group.id ? ' active' : ''}`}
      aria-expanded={expandedGroup?.id === group.id}
      onClick={() => setOpenGroup(open => open === group.id ? false : group.id)}
    >{group.label} <span aria-hidden="true">{expandedGroup?.id === group.id ? '−' : '+'}</span></button>
  );

  const mobileItem = section => (
    <button
      type="button"
      key={section.id}
      className={`mobile-menu-item${view === section.id ? ' active' : ''}`}
      aria-current={view === section.id ? 'page' : undefined}
      onClick={() => select(section.id)}
    >{section.label}</button>
  );

  return (
    <>
      <nav className="workspace-nav" aria-label="Secciones del club">
        {!authenticated
          ? playerSections.map(tab)
          : items.map(item => item.type === 'group' ? groupToggle(item) : tab(item.section))}
      </nav>
      {expandedGroup && (
        <nav className="workspace-nav-secondary" aria-label={expandedGroup.label}>
          {expandedGroup.sections.map(tab)}
        </nav>
      )}
      <nav className="bottom-bar" aria-label="Accesos rápidos">
        {BOTTOM_BAR.map(({ id, label, Icon }) => (
          <button
            type="button"
            key={id}
            className={view === id ? 'active' : ''}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => select(id)}
          ><Icon aria-hidden="true" /><span>{label}</span></button>
        ))}
        <button
          type="button"
          className={!inBottomBar ? 'active' : ''}
          aria-expanded={mobileMenuOpen}
          aria-controls="workspace-mobile-menu"
          onClick={() => setMobileMenuOpen(true)}
        ><Menu aria-hidden="true" /><span>Más</span></button>
      </nav>
      {mobileMenuOpen && (
        <div className="mobile-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
          <nav id="workspace-mobile-menu" className="mobile-menu-drawer" aria-label="Menú del club">
            <div className="mobile-menu-heading">
              <div><span className="kicker">{club.shortName}</span><h2>Secciones</h2></div>
              <button type="button" className="secondary mobile-menu-close" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)}><X aria-hidden="true" /></button>
            </div>
            {!authenticated ? playerSections.map(mobileItem) : <>
              {items.filter(item => item.type === 'link').map(item => mobileItem(item.section))}
              {groups.map(group => (
                <Fragment key={group.id}>
                  <p className="mobile-menu-group-label">{group.label}</p>
                  {group.sections.map(mobileItem)}
                </Fragment>
              ))}
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
