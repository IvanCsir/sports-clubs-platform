import { CalendarClock, ChevronRight, ClipboardList, Goal, MapPin, Megaphone, Timer, Trophy, UsersRound, Zap } from 'lucide-react';
import OpponentBadge from './OpponentBadge';

function citationSummary(citationLoadState, callup) {
  if (citationLoadState.loading) return 'Cargando citaciones…';
  if (citationLoadState.error) return 'No se pudieron cargar las citaciones';
  return callup.players.length ? `${callup.players.length} jugadoras citadas` : 'Todavía no hay jugadoras citadas';
}

export default function ClubHome({
  club, category, matchInfo, hasNextMatch, matchLoadState, onRetryMatches,
  callup, citationLoadState, latestResult, authenticated, activePlayerCount, onSelect
}) {
  return (
    <section className="club-home">
      <header className="club-home-heading">
        <div><span className="kicker">PANEL DEL CLUB</span><h2>Hola, {club.shortName || club.name}</h2><p>Resumen de {category === 'primera' ? '1ra División' : 'Intermedia'}</p></div>
      </header>
      <section className="home-next-match">
        {matchLoadState.loading ? (
          <div className="home-data-notice" role="status">Cargando fixture desde AMH…</div>
        ) : matchLoadState.error ? (
          <div className="home-data-notice is-error" role="alert">
            <span>No se pudo cargar el fixture de AMH: {matchLoadState.error}</span>
            <button type="button" className="home-retry-button" onClick={onRetryMatches}>Reintentar</button>
          </div>
        ) : !hasNextMatch ? (
          <div className="home-data-notice" role="status">No hay próximos partidos disponibles en AMH.</div>
        ) : null}
        <div className="home-match-content">
          <span className="home-match-label"><CalendarClock aria-hidden="true" />{matchInfo.round}</span>
          <div className="home-match-opponent">
            <div className="home-match-title">
              <div className="home-match-title-row">
                <h2>vs {matchInfo.rival || 'Rival pendiente'}</h2>
                <OpponentBadge key={matchInfo.rival} name={matchInfo.rival} />
              </div>
              <p>{matchInfo.date}</p>
            </div>
          </div>
          <div className="home-match-facts">
            {matchInfo.callTime && <span><Megaphone aria-hidden="true" /> Citación: {matchInfo.callTime}</span>}
            <span><Timer aria-hidden="true" /> {matchInfo.matchTime}</span>
            <span><MapPin aria-hidden="true" /> {matchInfo.venue}</span>
          </div>
        </div>
        <button type="button" onClick={() => onSelect('citaciones')}>Ver citación <ChevronRight aria-hidden="true" /></button>
      </section>
      <div className="home-dashboard-grid">
        <button type="button" className="home-dashboard-card" onClick={() => onSelect('citaciones')}>
          <span className="home-card-icon" aria-hidden="true"><ClipboardList /></span>
          <span className="home-card-copy"><strong>Citaciones</strong><small>{citationSummary(citationLoadState, callup)}</small>
            {callup.players.length > 0 && <small className="home-card-preview">{callup.players.slice(0, 3).join(' · ')}{callup.players.length > 3 ? ` · +${callup.players.length - 3}` : ''}</small>}
          </span><ChevronRight className="home-card-chevron" aria-hidden="true" />
        </button>
        <button type="button" className="home-dashboard-card" onClick={() => onSelect('preparacion')}>
          <span className="home-card-icon" aria-hidden="true"><Goal /></span>
          <span className="home-card-copy"><strong>Plan partido</strong><small>Foco semanal, videos y jugadas del equipo</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
        </button>
        <button type="button" className="home-dashboard-card" onClick={() => onSelect('torneo')}>
          <span className="home-card-icon" aria-hidden="true"><Trophy /></span>
          <span className="home-card-copy"><strong>Torneos y resultados</strong><small>{latestResult ? `${latestResult.round}: ${latestResult.score} vs ${latestResult.rival}` : 'Fixture y tabla de posiciones'}</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
        </button>
        <button type="button" className="home-dashboard-card" onClick={() => onSelect('fisico')}>
          <span className="home-card-icon" aria-hidden="true"><Zap /></span>
          <span className="home-card-copy"><strong>Evaluaciones físicas</strong><small>Consultá las mediciones y su evolución</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
        </button>
        {authenticated && <button type="button" className="home-dashboard-card" onClick={() => onSelect('jugadoras')}>
          <span className="home-card-icon" aria-hidden="true"><UsersRound /></span>
          <span className="home-card-copy"><strong>Plantel</strong><small>{activePlayerCount} jugadoras activas</small></span><ChevronRight className="home-card-chevron" aria-hidden="true" />
        </button>}
      </div>
    </section>
  );
}
