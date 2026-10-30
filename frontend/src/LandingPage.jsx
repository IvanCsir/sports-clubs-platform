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

const whatsAppLink = 'https://wa.me/5492615410198?text=Hola%2C%20quiero%20conocer%20Blue%20Hockey.';

function MiniMatchBoard() {
  return (
    <div className="landing-board" aria-label="Vista ilustrativa de análisis de partido">
      <div className="landing-board-top"><span><i /> VISTA DE EJEMPLO</span><span>1RA DIVISIÓN</span></div>
      <div className="landing-board-score"><div><small>LOCAL</small><b>2</b></div><div className="landing-board-vs">VS</div><div><small>VISITANTE</small><b>1</b></div></div>
      <div className="landing-board-clock"><span>3° CUARTO</span><b>08:42</b></div>
      <div className="landing-board-events"><span>ACCIONES REGISTRADAS</span><div><b>18</b><b>12</b><b>6</b></div><small><i /> Datos guardados para este partido</small></div>
      <div className="landing-board-glow" />
    </div>
  );
}

function ProductPreviews() {
  return (
    <section className="landing-product-preview" aria-labelledby="landing-preview-title">
      <div className="landing-section-label">ASÍ SE VE POR DENTRO</div>
      <div className="landing-preview-heading"><h2 id="landing-preview-title">Las herramientas del equipo,<br /><span>a simple vista.</span></h2><p>Vistas de ejemplo basadas en la app. Los datos se muestran de forma genérica.</p></div>
      <div className="landing-preview-grid">
        <article className="landing-preview-card landing-preview-dashboard"><div className="landing-preview-caption"><span>01 / INICIO</span><b>Todo el club en contexto</b></div><div className="preview-app-window"><div className="preview-app-header"><span className="preview-crest">C</span><div><b>CLUB</b><small>PLANTEL SUPERIOR</small></div><span className="preview-menu">☰</span></div><div className="preview-app-meta">Hockey · Temporada actual · Torneo</div><div className="preview-tabs"><b>1ra División</b><span>Intermedia</span></div><div className="preview-section-label">PRÓXIMO PARTIDO</div><div className="preview-fixture"><div><small>FECHA 04</small><b>Club <i>vs</i> Rival</b><span>Fecha y horario</span></div><span className="preview-pill">Ver citación →</span></div><div className="preview-shortcuts"><span>Citaciones</span><span>Plan partido</span><span>Torneos</span></div></div></article>
        <article className="landing-preview-card landing-preview-tracker"><div className="landing-preview-caption"><span>02 / PARTIDO</span><b>La botonera, en acción</b></div><div className="preview-app-window preview-tracker-window"><div className="preview-match-header"><div><small>FECHA 04</small><b>CLUB <i>vs</i> RIVAL</b><span>Fecha · Local</span></div><strong>0 - 0</strong></div><div className="preview-quarter-tabs"><b>1° cuarto</b><span>2° cuarto</span><span>3° cuarto</span><span>4° cuarto</span></div><div className="preview-team-tabs"><b>Club</b><span>Rival</span><span>Ambos</span></div><div className="preview-team-columns"><section><b>CLUB</b><strong>0</strong><div><span>↘ <b>Ingreso al área</b><i>+1</i></span><span>◎ <b>Córner corto</b><i>+1</i></span><span>◉ <b>Penal</b><i>+1</i></span><span>○ <b>Gol de jugada</b><i>+1</i></span></div><small>Tarjetas　 🟩 0　🟨 0</small></section><section><b>RIVAL</b><strong>0</strong><div><span>↘ <b>Ingreso al área</b><i>+1</i></span><span>◎ <b>Córner corto</b><i>+1</i></span><span>◉ <b>Penal</b><i>+1</i></span><span>○ <b>Gol de jugada</b><i>+1</i></span></div><small>Tarjetas　 🟩 0　🟨 0</small></section></div></div></article>
        <article className="landing-preview-card landing-preview-analytics"><div className="landing-preview-caption"><span>03 / ANÁLISIS</span><b>Información para revisar</b></div><div className="preview-app-window preview-stats-window"><div className="preview-stats-top"><div><small>ESTADÍSTICAS</small><b>Resumen del equipo</b></div><span>TORNEO ACTUAL⌄</span></div><div className="preview-chart"><div><small>8</small><i style={{height:'39%'}} /></div><div><small>12</small><i style={{height:'68%'}} /></div><div><small>9</small><i style={{height:'51%'}} /></div><div><small>15</small><i style={{height:'84%'}} /></div><div><small>11</small><i style={{height:'61%'}} /></div></div><div className="preview-chart-labels"><span>F01</span><span>F02</span><span>F03</span><span>F04</span><span>F05</span></div><div className="preview-stats-foot"><span><i /> Evolución por partido</span><b>Ver estadísticas →</b></div></div></article>
      </div>
    </section>
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

      <section className="landing-phases" aria-label="El trabajo deportivo en tres momentos">
        <article><span>01</span><div><CalendarDays size={19} /><b>Prepará</b></div><p>Convocá al plantel y organizá el próximo encuentro.</p></article>
        <i aria-hidden="true" />
        <article><span>02</span><div><Zap size={19} /><b>Registrá</b></div><p>Usá la botonera durante el partido desde el celular.</p></article>
        <i aria-hidden="true" />
        <article><span>03</span><div><ChartNoAxesCombined size={19} /><b>Analizá</b></div><p>Revisá estadísticas y evolución por torneo y temporada.</p></article>
      </section>

      <ProductPreviews />

      <section className="landing-features" id="funcionalidades"><div className="landing-features-heading"><div><div className="landing-section-label">HERRAMIENTAS DEL CUERPO TÉCNICO</div><h2>De la planificación<br />al análisis del partido.</h2></div><p>Todo lo que usás para acompañar al equipo, reunido en una experiencia simple y accesible.</p></div><div className="landing-feature-grid">{features.map(({ icon: Icon, eyebrow, title, copy }, index) => <article className={`landing-feature-card landing-feature-card-${index + 1}`} key={title}><div className="landing-feature-top"><span className="landing-feature-icon"><Icon size={20} /></span><span className="landing-feature-number">0{index + 1}</span></div><small>{eyebrow}</small><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="landing-workflow"><div className="landing-workflow-copy"><div className="landing-section-label">TODO EN SU CONTEXTO</div><h2>La información sigue<br />el ritmo de la temporada.</h2><p>Organizá los datos deportivos por temporada y torneo. Así, las citaciones, las estadísticas, las evaluaciones y el seguimiento acompañan el recorrido del equipo.</p><a href="#funcionalidades">Explorar funcionalidades <ArrowRight size={16} /></a></div><div className="landing-season-card"><div className="landing-season-top"><span>TEMPORADA</span><b>ACTIVA</b><i>POR CLUB</i></div><div className="landing-season-rule" /><div className="landing-season-tournament"><span className="landing-season-ball"><Trophy size={19} /></span><div><small>TORNEO</small><b>Datos por competencia</b></div><ArrowRight size={17} /></div><div className="landing-season-stats"><div><b>01</b><span>Plantel</span></div><div><b>02</b><span>Partidos</span></div><div><b>03</b><span>Evolución</span></div></div><div className="landing-season-footer"><span><i /> INFORMACIÓN DEPORTIVA ORGANIZADA</span><ClipboardList size={18} /></div></div></section>

      <section className="landing-final-cta"><div className="landing-final-glow" /><span className="landing-section-label">BLUE HOCKEY</span><h2>El próximo partido<br />empieza con una buena preparación.</h2><p>Entrá al espacio de tu club y encontrá todo listo para el trabajo del cuerpo técnico.</p><a className="landing-primary-cta" href="/">Ingresar a mi club <ArrowRight size={17} /></a><small>El ingreso se realiza desde el enlace de tu club.</small></section>

      <footer className="landing-footer"><a className="landing-brand" href="/inicio"><span className="landing-brand-mark"><span /></span><span>blue<span>hockey</span></span></a><span>Gestión deportiva para equipos de hockey.</span><a href="/">Acceso al club <ArrowRight size={14} /></a><small>Desarrollado por Iván Freiberg · © {new Date().getFullYear()} Blue Hockey. Todos los derechos reservados.</small></footer>
      <a className="landing-whatsapp" href={whatsAppLink} target="_blank" rel="noreferrer" aria-label="Escribile a Blue Hockey por WhatsApp"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.04 3.2A12.7 12.7 0 0 0 5.1 22.35L3.4 28.6l6.4-1.68A12.7 12.7 0 1 0 16.04 3.2Zm0 23.05a10.3 10.3 0 0 1-5.25-1.44l-.38-.23-3.8 1 .99-3.7-.25-.4a10.3 10.3 0 1 1 8.7 4.77Zm5.65-7.72c-.31-.16-1.84-.91-2.13-1.02-.29-.1-.5-.15-.71.16-.2.31-.81 1.02-.99 1.23-.18.2-.36.23-.67.08-.31-.16-1.3-.48-2.47-1.52-.92-.82-1.54-1.84-1.72-2.15-.18-.31-.02-.48.13-.64.14-.13.31-.36.46-.54.16-.18.21-.31.31-.52.1-.2.05-.38-.02-.54-.08-.15-.71-1.7-.97-2.33-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.56 0 1.52 1.1 2.98 1.26 3.19.15.2 2.17 3.31 5.26 4.64.73.32 1.3.51 1.75.65.74.24 1.42.2 1.95.12.59-.09 1.84-.75 2.1-1.47.26-.72.26-1.33.18-1.47-.08-.13-.28-.21-.59-.36Z"/></svg><span>Escribime</span></a>
    </main>
  );
}
