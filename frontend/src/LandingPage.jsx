import { useEffect, useState } from 'react';
import './landing.css';

const whatsAppLink = 'https://wa.me/5492615410198?text=Hola%2C%20quiero%20conocer%20Blue%20Hockey.';

const DEMO_ACTIONS = [
  ['entry', 'Ingreso al área'],
  ['corner', 'Córner corto'],
  ['stroke', 'Penal'],
  ['fieldGoal', 'Gol de jugada']
];

const PLAYERS = ['C. Ruiz', 'L. Paz', 'M. Soto', 'A. Díaz', 'V. Gil', 'J. Mora', 'F. Luna', 'R. Vera', 'S. Ríos', 'P. Cruz', 'N. Sosa', 'E. Ortiz', 'T. Rey', 'B. Lima'];

const FEED = [
  { q: 4, team: 'home', text: 'Gol de jugada · Gol: L. Paz' },
  { q: 4, team: 'away', text: 'Ingreso al área' },
  { q: 3, team: 'away', text: 'Córner corto' },
  { q: 2, team: 'home', text: 'Gol de córner corto · Gol: C. Ruiz' },
  { q: 2, team: 'home', text: 'Córner corto · Generó: M. Soto' }
];

const QUARTERS = [
  { q: '1°', home: 5, away: 2 },
  { q: '2°', home: 7, away: 3 },
  { q: '3°', home: 3, away: 6 },
  { q: '4°', home: 6, away: 3 }
];

const MORE = [
  ['Torneos de AMH', 'Fixture, resultados y tabla de posiciones de AMH para 1ra División e Intermedia.'],
  ['Para las jugadoras', 'Ven su citación y el plan del partido, y completan wellness y cargas desde el celular.'],
  ['Plantel y accesos', 'Sumá jugadoras por categoría y dale acceso a cada integrante del cuerpo técnico con su cuenta de Google.'],
  ['Temporadas y respaldo', 'Los datos quedan ordenados por temporada y torneo, y podés descargar un respaldo cuando quieras.']
];

const WELLNESS_TODAY = [
  { name: 'C. Ruiz', value: 86 },
  { name: 'L. Paz', value: 74 },
  { name: 'M. Soto', value: 58, alert: true },
  { name: 'A. Díaz', value: 81 }
];

const LOAD_WEEK = [
  { day: 'lun', value: 420 }, { day: 'mar', value: 520 }, { day: 'mié', value: 0 }, { day: 'jue', value: 610 },
  { day: 'vie', value: 380 }, { day: 'sáb', value: 700 }, { day: 'dom', value: 0 }
];

// Líneas del campo: línea de fondo, arco del círculo de tiro, su borde punteado, punto de penal y arco.
function Pitch({ className }) {
  return (
    <svg className={className} viewBox="0 0 1200 800" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M0 40 H1200" />
        <path d="M520 40 A440 440 0 0 0 1400 40" />
        <path d="M440 40 A520 520 0 0 0 1480 40" strokeDasharray="14 12" />
        <path d="M0 729 H1200" />
        <rect x="930" y="0" width="60" height="40" />
        <circle cx="960" cy="232" r="6" fill="currentColor" />
      </g>
    </svg>
  );
}

// Botonera de demostración: replica el comportamiento real (nosotras en azul, el rival en ámbar).
function BotoneraDemo() {
  const [events, setEvents] = useState([]);
  const [quarter, setQuarter] = useState(1);
  const [flash, setFlash] = useState('');
  const [touched, setTouched] = useState(false);

  const countQuarter = (team, type) => events.filter(e => e.team === team && e.type === type && e.q === quarter).length;
  const count = (team, type) => events.filter(e => e.team === team && e.type === type).length;
  const score = team => count(team, 'fieldGoal');

  function add(team, type) {
    setTouched(true);
    setEvents(current => [...current, { team, type, q: quarter }]);
    setFlash(`${team}-${type}`);
    window.setTimeout(() => setFlash(''), 400);
  }

  const column = (team, name) => (
    <div className={`demo-team ${team}`}>
      <h3>{name}</h3>
      {DEMO_ACTIONS.map(([type, label]) => (
        <button
          type="button"
          key={type}
          className={`demo-btn${flash === `${team}-${type}` ? ' flash' : ''}${!touched && team === 'home' && type === 'entry' ? ' hint' : ''}`}
          onClick={() => add(team, type)}
          aria-label={`${name}: ${label}, ${quarter}° cuarto: ${countQuarter(team, type)}. Sumar uno`}
        >
          <strong>{label}</strong>
          <small>Total {count(team, type)}</small>
          <b>{countQuarter(team, type)}</b>
        </button>
      ))}
    </div>
  );

  return (
    <div className="landing-phone">
      <div className="demo" role="group" aria-label="Botonera de demostración">
        <div className="demo-score" aria-live="polite">
          <span>Mi club</span>
          <b>{score('home')} - {score('away')}</b>
          <span>Rival</span>
        </div>
        <div className="demo-controls">
          <div className="demo-quarters" role="group" aria-label="Cuarto">
            {[1, 2, 3, 4].map(item => (
              <button type="button" key={item} className={quarter === item ? 'active' : ''} aria-pressed={quarter === item} onClick={() => setQuarter(item)}>{item}°</button>
            ))}
          </div>
          <button type="button" className="demo-undo" disabled={!events.length} onClick={() => setEvents(current => current.slice(0, -1))}>Deshacer</button>
        </div>
        <div className="demo-grid">
          {column('home', 'Mi club')}
          {column('away', 'Rival')}
        </div>
      </div>
      <p className="landing-phone-note">Es la botonera real. Probala: tocá los botones.</p>
    </div>
  );
}

function CitacionShot() {
  return (
    <figure className="landing-shot" aria-label="Vista de ejemplo de una citación">
      <div className="shot-head"><strong>Citación · vs Rival (B)</strong><span>Sáb 7/11 · 16:45 · Local</span></div>
      <div className="shot-subhead"><span>Jugadoras citadas</span><b>{PLAYERS.length}</b></div>
      <ul className="shot-chips">{PLAYERS.map(name => <li key={name}>{name}</li>)}</ul>
      <div className="shot-actions"><span className="shot-pill">Guardar citación</span><span className="shot-pill ghost">Precarga en AMH</span></div>
      <figcaption>Datos de ejemplo</figcaption>
    </figure>
  );
}

function IncidenciasShot() {
  return (
    <figure className="landing-shot" aria-label="Vista de ejemplo de las incidencias del partido">
      <div className="shot-head"><strong>Incidencias del partido (5)</strong><span>Deshacer última acción</span></div>
      <ul className="shot-feed">
        {FEED.map((item, index) => (
          <li key={index} className={item.team}>
            <span>{item.q}°</span>
            <strong>{item.team === 'home' ? 'Mi club' : 'Rival'}</strong>
            <em>{item.text}</em>
          </li>
        ))}
      </ul>
      <figcaption>Datos de ejemplo</figcaption>
    </figure>
  );
}

function EstadisticasShot() {
  const max = Math.max(...QUARTERS.flatMap(item => [item.home, item.away]));
  return (
    <figure className="landing-shot" aria-label="Vista de ejemplo de estadísticas por cuarto">
      <div className="shot-head"><strong>Ingresos al área por cuarto</strong><span className="shot-legend"><i className="home" />Mi club <i className="away" />Rival</span></div>
      <div className="shot-bars">
        {QUARTERS.map(item => (
          <div key={item.q}>
            <div className="shot-pair">
              <span className="home" style={{ height: `${(item.home / max) * 100}%` }}><b>{item.home}</b></span>
              <span className="away" style={{ height: `${(item.away / max) * 100}%` }}><b>{item.away}</b></span>
            </div>
            <small>{item.q}</small>
          </div>
        ))}
      </div>
      <ul className="shot-highlights">
        <li><span>Mejor cuarto ofensivo</span><strong>4° · 2 goles</strong></li>
        <li><span>Cuarto más exigido en defensa</span><strong>3° · 6 ingresos rivales</strong></li>
      </ul>
      <figcaption>Datos de ejemplo</figcaption>
    </figure>
  );
}

function SeguimientoShot() {
  const max = Math.max(...LOAD_WEEK.map(item => item.value));
  return (
    <figure className="landing-shot" aria-label="Vista de ejemplo del seguimiento del plantel">
      <div className="shot-head"><strong>Wellness, cargas y disponibilidad</strong><span>Categoría: Todas</span></div>
      <div className="shot-tiles">
        <div><span>Wellness hoy</span><b>16/18</b></div>
        <div><span>Disposición promedio</span><b>76%</b></div>
        <div><span>Cargas hoy</span><b>14/18</b></div>
      </div>
      <h4 className="shot-title">Respuestas de wellness de hoy</h4>
      <ul className="shot-responses">
        {WELLNESS_TODAY.map(item => (
          <li key={item.name} className={item.alert ? 'alert' : ''}>
            <span>{item.name}<small>disposición</small></span>
            <b>{item.value}%</b>
          </li>
        ))}
      </ul>
      <div className="shot-trend-head"><h4 className="shot-title">Carga percibida, últimos 7 días</h4><span>+120 UA vs. semana anterior</span></div>
      <div className="shot-trend">
        {LOAD_WEEK.map(item => (
          <div key={item.day}>
            <span style={{ height: item.value ? `${(item.value / max) * 100}%` : '4px' }} className={item.value ? '' : 'empty'} />
            <small>{item.day}</small>
          </div>
        ))}
      </div>
      <figcaption>Datos de ejemplo</figcaption>
    </figure>
  );
}
export default function LandingPage() {
  const [showChat, setShowChat] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowChat(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <Pitch className="landing-pitch" />
        <header className="landing-nav landing-wrap">
          <a className="landing-brand" href="/inicio" aria-label="Blue Hockey, inicio"><img src="/blue-hockey-icon.png" alt="" /><span>Blue Hockey</span></a>
          <nav aria-label="Secciones"><a href="#momentos">Cómo funciona</a><a href="#preparacion-fisica">Preparación física</a><a href="#ademas">Y además</a></nav>
          <a className="landing-nav-link" href="/">Ingresar a mi club</a>
        </header>
        <div className="landing-hero-grid landing-wrap">
          <div className="landing-hero-copy">
            <h1>Anotá el partido mientras se juega.</h1>
            <p>Blue Hockey es la plataforma del cuerpo técnico: citaciones, plan de partido, botonera en vivo, estadísticas por cuarto, wellness y control de cargas, en un solo lugar y pensada para el celular.</p>
            <div className="landing-actions">
              <a className="landing-btn" href="/">Ingresar a mi club</a>
              <a className="landing-btn ghost" href={whatsAppLink} target="_blank" rel="noreferrer">Sumar mi club</a>
            </div>
          </div>
          <BotoneraDemo />
        </div>
      </section>

      <section className="landing-moments landing-wrap" id="momentos" aria-labelledby="momentos-title">
        <h2 id="momentos-title">Antes, durante y después del partido</h2>

        <article className="landing-moment">
          <div className="landing-moment-copy">
            <h3>Antes</h3>
            <p>Armá la citación con las jugadoras del plantel, mirá el fixture y la tabla de AMH y dejá el plan del partido con videos y jugadas. Cuando la citación está lista, la precarga en AMH se hace desde acá.</p>
            <ul>
              <li>Citaciones por categoría</li>
              <li>Fixture y tabla de posiciones de AMH</li>
              <li>Plan de partido con videos y jugadas</li>
            </ul>
          </div>
          <CitacionShot />
        </article>

        <article className="landing-moment">
          <div className="landing-moment-copy">
            <h3>Durante</h3>
            <p>Tocá un botón por cada ingreso al área, córner corto, penal o gol. Ves a tu equipo en azul y al rival en ámbar, y si te equivocás, deshacés la última acción. Cada toque se guarda al instante.</p>
            <ul>
              <li>Los dos equipos en la misma pantalla</li>
              <li>Registro por cuarto, con quién hizo el gol y quién generó el córner</li>
              <li>Funciona desde el celular, de pie, al costado del campo</li>
            </ul>
          </div>
          <IncidenciasShot />
        </article>

        <article className="landing-moment">
          <div className="landing-moment-copy">
            <h3>Después</h3>
            <p>Las estadísticas muestran el marcador, los ingresos, los córners y los penales de cada cuarto, y cuál fue el mejor cuarto del equipo. También queda registrado quién hizo los goles y quién generó los córners.</p>
            <ul>
              <li>Resumen por partido o por todo el torneo</li>
              <li>Primer y segundo tiempo lado a lado</li>
              <li>Goles y córners generados por jugadora</li>
            </ul>
          </div>
          <EstadisticasShot />
        </article>
      </section>

      <section className="landing-pf" id="preparacion-fisica" aria-labelledby="pf-title">
        <div className="landing-wrap">
          <h2 id="pf-title">El preparador físico también tiene su lugar</h2>
          <div className="landing-pf-grid">
            <SeguimientoShot />
            <div className="landing-pf-copy">
              <div>
                <h3>Wellness todos los días</h3>
                <p>Cada jugadora responde desde el celular, eligiendo su nombre y sin crear una cuenta: calidad del sueño, fatiga, dolor muscular, estrés y estado de ánimo. Vos ves la disposición de cada una y quién necesita atención ese día.</p>
              </div>
              <div>
                <h3>Control de cargas</h3>
                <p>Después de cada entrenamiento cargan los minutos y el esfuerzo percibido (RPE). La carga de la sesión se calcula sola: minutos por esfuerzo.</p>
              </div>
              <div>
                <h3>La semana, de un vistazo</h3>
                <p>Comparás los últimos 7 días con la semana anterior, por categoría, para ver si el plantel viene cargado o descansado.</p>
              </div>
              <div>
                <h3>Evaluaciones físicas</h3>
                <p>Armá las pruebas que usa tu club, cargá las mediciones y mirá promedios, el Top 10 y la evolución de cada jugadora a lo largo del año.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="landing-more landing-wrap" id="ademas" aria-labelledby="ademas-title">
        <h2 id="ademas-title">Y todo lo demás del cuerpo técnico</h2>
        <dl>
          {MORE.map(([title, copy]) => (
            <div key={title}><dt>{title}</dt><dd>{copy}</dd></div>
          ))}
        </dl>
      </section>

      <section className="landing-closing">
        <Pitch className="landing-pitch landing-pitch-closing" />
        <div className="landing-wrap landing-closing-inner">
          <h2>Hecha por entrenadores, para entrenadores.</h2>
          <p>Si tu club todavía no está en Blue Hockey, escribime y lo dejamos listo para la próxima fecha. Si ya está, entrá con el enlace que te compartió el cuerpo técnico.</p>
          <div className="landing-actions">
            <a className="landing-btn" href="/">Ingresar a mi club</a>
            <a className="landing-btn ghost" href={whatsAppLink} target="_blank" rel="noreferrer">Escribime por WhatsApp</a>
          </div>
        </div>
      </section>

      <footer className="landing-footer landing-wrap">
        <a className="landing-brand dark" href="/inicio"><img src="/blue-hockey-icon.png" alt="" /><span>Blue Hockey</span></a>
        <span>Gestión deportiva para equipos de hockey.</span>
        <small>Desarrollado por Iván Freiberg · © {new Date().getFullYear()} Blue Hockey. Todos los derechos reservados.</small>
      </footer>

      <a className={`landing-whatsapp${showChat ? ' visible' : ''}`} href={whatsAppLink} target="_blank" rel="noreferrer" aria-label="Escribile a Blue Hockey por WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16.04 3.2A12.7 12.7 0 0 0 5.1 22.35L3.4 28.6l6.4-1.68A12.7 12.7 0 1 0 16.04 3.2Zm0 23.05a10.3 10.3 0 0 1-5.25-1.44l-.38-.23-3.8 1 .99-3.7-.25-.4a10.3 10.3 0 1 1 8.7 4.77Zm5.65-7.72c-.31-.16-1.84-.91-2.13-1.02-.29-.1-.5-.15-.71.16-.2.31-.81 1.02-.99 1.23-.18.2-.36.23-.67.08-.31-.16-1.3-.48-2.47-1.52-.92-.82-1.54-1.84-1.72-2.15-.18-.31-.02-.48.13-.64.14-.13.31-.36.46-.54.16-.18.21-.31.31-.52.1-.2.05-.38-.02-.54-.08-.15-.71-1.7-.97-2.33-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.56 0 1.52 1.1 2.98 1.26 3.19.15.2 2.17 3.31 5.26 4.64.73.32 1.3.51 1.75.65.74.24 1.42.2 1.95.12.59-.09 1.84-.75 2.1-1.47.26-.72.26-1.33.18-1.47-.08-.13-.28-.21-.59-.36Z" /></svg>
        <span>Escribime</span>
      </a>
    </main>
  );
}
