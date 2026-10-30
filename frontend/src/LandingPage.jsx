import { Activity, ArrowDown, ArrowRight, CalendarDays, ChartNoAxesCombined, ClipboardCheck, ClipboardList, ShieldCheck, Trophy, UsersRound, Video, Zap } from 'lucide-react';

const features = [
  { icon: CalendarDays, eyebrow: 'ORGANIZACIÓN', title: 'Citaciones y calendario', copy: 'Prepará cada fecha, compartí la convocatoria y tené a mano los próximos partidos del plantel.' },
  { icon: Zap, eyebrow: 'DURANTE EL PARTIDO', title: 'Botonera en vivo', copy: 'Registrá las acciones del partido desde el celular y consultá el desarrollo del juego.' },
  { icon: ChartNoAxesCombined, eyebrow: 'DESPUÉS DEL PARTIDO', title: 'Estadísticas deportivas', copy: 'Revisá los datos del equipo por partido y torneo para acompañar el análisis del cuerpo técnico.' },
  { icon: Video, eyebrow: 'PREPARACIÓN', title: 'Plan de partido', copy: 'Organizá videos, objetivos y jugadas tácticas para preparar el próximo encuentro.' },
  { icon: Activity, eyebrow: 'DESARROLLO', title: 'Evaluaciones físicas', copy: 'Guardá pruebas y mediciones para seguir la evolución física de las jugadoras.' },
  { icon: ClipboardCheck, eyebrow: 'ACOMPAÑAMIENTO', title: 'Seguimiento de jugadoras', copy: 'Centralizá observaciones y registros de wellness del plantel en un espacio deportivo.' },
  { icon: UsersRound, eyebrow: 'PLANTEL Y EQUIPO', title: 'Plantel y accesos', copy: 'Administrá jugadoras, categorías y las cuentas del cuerpo técnico con permisos claros.' },
  { icon: ShieldCheck, eyebrow: 'CONTINUIDAD', title: 'Temporadas y respaldo', copy: 'Mantené la información organizada por temporada y descargá un respaldo de los datos.' },
];

function MiniMatchBoard() {
  return (
    <div className="landing-board" aria-label="Vista ilustrativa de análisis de partido">
      <div className="landing-board-top"><span><i /> PARTIDO EN CURSO</span><span>1RA DIVISIÓN</span></div>
      <div className="landing-board-score"><div><small>LOCAL</small><b>2</b></div><div className="landing-board-vs">VS</div><div><small>VISITANTE</small><b>1</b></div></div>
      <div className="landing-board-clock"><span>3° CUARTO</span><b>08:42</b></div>
      <div className="landing-board-events"><span>ACCIONES REGISTRADAS</span><div><b>18</b><b>12</b><b>6</b></div><small><i /> Datos guardados para este partido</small></div>
      <div className="landing-board-glow" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="/inicio" aria-label="Blue Hockey, inicio"><span className="landing-brand-mark"><span /></span><span>blue<span>hockey</span></span></a>
        <nav><a href="#funcionalidades">Funcionalidades</a><a href="#para-quien">Para el cuerpo técnico</a></nav>
        <a className="landing-nav-cta" href="/">Ingresar a mi club <ArrowRight size={16} /></a>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><i /> GESTIÓN DEPORTIVA PARA HOCKEY</span>
          <h1>Todo el equipo.<br /><em>En la misma jugada.</em></h1>
          <p>Organizá el plantel, prepará los partidos y seguí el rendimiento de tu equipo desde un solo lugar.</p>
          <div className="landing-hero-actions"><a className="landing-primary-cta" href="#funcionalidades">Conocé la plataforma <ArrowDown size={17} /></a><a className="landing-text-cta" href="/">Ingresar a mi club <ArrowRight size={16} /></a></div>
          <div className="landing-proof"><span><i>✓</i> Hecha para el trabajo deportivo</span><span><i>✓</i> Lista para usar desde el celular</span></div>
        </div>
        <div className="landing-hero-visual"><div className="landing-visual-orbit landing-visual-orbit-one" /><div className="landing-visual-orbit landing-visual-orbit-two" /><MiniMatchBoard /><div className="landing-float-card"><span><Activity size={17} /></span><div><b>Una temporada, todo conectado</b><small>Plantel · partidos · evolución</small></div></div><div className="landing-visual-tag">JUEGO · DATOS · EQUIPO</div></div>
        <div className="landing-hero-scroll"><span>UNA MIRADA COMPLETA AL EQUIPO</span><ArrowDown size={15} /></div>
      </section>

      <section className="landing-intro" id="para-quien"><div className="landing-section-label">EL DEPORTE, EN EL CENTRO</div><h2>Menos planillas dispersas.<br /><span>Más tiempo para el juego.</span></h2><p>Blue Hockey reúne las herramientas que necesita el cuerpo técnico para trabajar antes, durante y después de cada partido. La información del club queda organizada por plantel y temporada.</p><div className="landing-intro-line"><span /><b>UNA PLATAFORMA PARA EL DÍA A DÍA DEPORTIVO</b><span /></div></section>

      <section className="landing-features" id="funcionalidades"><div className="landing-features-heading"><div><div className="landing-section-label">HERRAMIENTAS DEL CUERPO TÉCNICO</div><h2>De la planificación<br />al análisis del partido.</h2></div><p>Todo lo que usás para acompañar al equipo, reunido en una experiencia simple y accesible.</p></div><div className="landing-feature-grid">{features.map(({ icon: Icon, eyebrow, title, copy }, index) => <article className={`landing-feature-card landing-feature-card-${index + 1}`} key={title}><div className="landing-feature-top"><span className="landing-feature-icon"><Icon size={20} /></span><span className="landing-feature-number">0{index + 1}</span></div><small>{eyebrow}</small><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-workflow"><div className="landing-workflow-copy"><div className="landing-section-label">TODO EN SU CONTEXTO</div><h2>La información sigue<br />el ritmo de la temporada.</h2><p>Organizá los datos deportivos por temporada y torneo. Así, las citaciones, las estadísticas, las evaluaciones y el seguimiento acompañan el recorrido del equipo.</p><a href="#funcionalidades">Explorar funcionalidades <ArrowRight size={16} /></a></div><div className="landing-season-card"><div className="landing-season-top"><span>TEMPORADA</span><b>2026</b><i>ACTIVA</i></div><div className="landing-season-rule" /><div className="landing-season-tournament"><span className="landing-season-ball"><Trophy size={19} /></span><div><small>TORNEO</small><b>Torneo del plantel</b></div><ArrowRight size={17} /></div><div className="landing-season-stats"><div><b>01</b><span>Plantel</span></div><div><b>02</b><span>Partidos</span></div><div><b>03</b><span>Evolución</span></div></div><div className="landing-season-footer"><span><i /> INFORMACIÓN DEPORTIVA ORGANIZADA</span><ClipboardList size={18} /></div></div></section>

      <section className="landing-final-cta"><div className="landing-final-glow" /><span className="landing-section-label">BLUE HOCKEY</span><h2>El próximo partido<br />empieza con una buena preparación.</h2><p>Entrá al espacio de tu club y encontrá todo listo para el trabajo del cuerpo técnico.</p><a className="landing-primary-cta" href="/">Ingresar a mi club <ArrowRight size={17} /></a><small>El ingreso se realiza desde el enlace de tu club.</small></section>

      <footer className="landing-footer"><a className="landing-brand" href="/inicio"><span className="landing-brand-mark"><span /></span><span>blue<span>hockey</span></span></a><span>Gestión deportiva para equipos de hockey.</span><a href="/">Acceso al club <ArrowRight size={14} /></a></footer>
    </main>
  );
}
