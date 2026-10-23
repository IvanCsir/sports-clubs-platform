import { useEffect, useState } from 'react';

export default function TournamentPanel({ club }) {
  const [division, setDivision] = useState('primera');
  const [matchesTab, setMatchesTab] = useState('pending');
  const [data, setData] = useState({ primera: null, intermedia: null });
  const [status, setStatus] = useState('Cargando torneo...');

  async function loadTournament() {
    setStatus('Actualizando torneo...');
    try {
      const loadDivision = async (key, id) => {
        const [standingsResponse, matchesResponse] = await Promise.all([
          fetch(`/api/torneo?club=${encodeURIComponent(club.slug)}&division=${id}`, { cache: 'no-store' }),
          fetch(`/api/torneo/matches?club=${encodeURIComponent(club.slug)}&division=${id}`, { cache: 'no-store' })
        ]);
        const standings = await standingsResponse.json();
        const matches = await matchesResponse.json();
        if (!standingsResponse.ok) throw new Error(standings.error || 'No se pudo cargar la tabla.');
        if (!matchesResponse.ok) throw new Error(matches.error || 'No se pudo cargar el fixture.');
        return [key, { ...standings, ...matches }];
      };
      const [primera, intermedia] = await Promise.all([
        loadDivision('primera', '1'),
        loadDivision('intermedia', '2')
      ]);
      setData(Object.fromEntries([primera, intermedia]));
      setStatus(`Actualizado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadTournament();
  }, [club.slug, club.tournament?.tournamentId]);

  const current = data[division] || { standings: [], scorers: [], playedMatches: [], pendingMatches: [] };
  const teamTokens = [club.shortName, club.name, club.teamName]
    .filter(Boolean)
    .map(name => name.toUpperCase().replace(/\s+[AB]\s*$/, '').replace(/\s+PS[A-Z]*\s*$/, '').trim())
    .sort((a, b) => b.length - a.length);
  const isBranchA = (club.slug && club.slug.includes('-a')) || (club.shortName && club.shortName.toUpperCase().includes(' A')) || (club.teamName && club.teamName.toUpperCase().includes(' A'));
  const isBranchB = (club.slug && (club.slug.includes('-b') || club.slug === 'regatas-andino')) || (club.shortName && club.shortName.toUpperCase().includes(' B')) || (club.teamName && club.teamName.toUpperCase().includes(' B'));

  const matchesClub = row => {
    const rowTeam = (row.team || '').toUpperCase();
    if (isBranchA && rowTeam.includes('REGATAS')) {
      return rowTeam.includes('- A') || rowTeam.includes('(A)') || rowTeam.endsWith(' A');
    }
    if (isBranchB && rowTeam.includes('REGATAS')) {
      return rowTeam.includes('- B') || rowTeam.includes('(B)') || rowTeam.endsWith(' B');
    }
    return teamTokens.some(token => token && rowTeam.includes(token));
  };
  const clubRow = current.standings.find(matchesClub) || {};
  const matches = matchesTab === 'played' ? current.playedMatches || [] : current.pendingMatches || [];
  const scorers = (current.scorers || []).slice(0, 10);

  return (
    <section className="tournament-panel">
      <div className="tournament-hero">
        <span className="kicker">TORNEO · {current.tournament || club.tournament?.name || 'COMPETENCIA'}</span>
        <h2>Tabla de posiciones y fixture</h2>
        <p>Resultados oficiales, próximos partidos y posiciones de {club.shortName || club.name}.</p>
      </div>
      <div className="tournament-actions">
        <div className="tournament-tabs">
          <button
            className={division === 'primera' ? 'active' : ''}
            onClick={() => setDivision('primera')}
          >
            1ra División
          </button>
          <button
            className={division === 'intermedia' ? 'active' : ''}
            onClick={() => setDivision('intermedia')}
          >
            Intermedia
          </button>
        </div>
        <div className="sync-status">
          {status}
          <button className="refresh" onClick={loadTournament}>
            Actualizar
          </button>
        </div>
      </div>
      <div className="tournament-summary">
        <div className="tournament-summary-title">
          <img src={club.logoUrl || '/escudo-regatas-andino.png'} alt="" />
          <div>
            <strong>{club.shortName || club.name}</strong>
            <small>{clubRow.team || (division === 'primera' ? '1ra División' : 'Intermedia')}</small>
          </div>
          <b>#{clubRow.pos || '-'}</b>
        </div>
        <div className="tournament-stats">
          {[
            ['pts', 'Puntos'],
            ['pj', 'PJ'],
            ['pg', 'PG'],
            ['pe', 'PE'],
            ['pp', 'PP'],
            ['gf', 'GF'],
            ['ge', 'GE'],
            ['dif', 'DIF']
          ].map(([key, label]) => (
            <div key={key}>
              <strong>{clubRow[key] ?? 0}</strong>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="tournament-grid">
        <section className="tournament-card">
          <div className="section-heading">
            <div>
              <h3>Partidos</h3>
              <small>{matchesTab === 'played' ? 'Resultados jugados' : 'Fixture pendiente'}</small>
            </div>
            <div className="matches-tabs">
              <button
                className={matchesTab === 'pending' ? 'active' : ''}
                onClick={() => setMatchesTab('pending')}
              >
                Por jugar ({(current.pendingMatches || []).length})
              </button>
              <button
                className={matchesTab === 'played' ? 'active' : ''}
                onClick={() => setMatchesTab('played')}
              >
                Jugados ({(current.playedMatches || []).length})
              </button>
            </div>
          </div>
          <div className="matches-list-react">
            {matches.length ? (
              matches.map((match, index) => (
                <article className="match-row" key={`${match.round}-${match.rival}-${index}`}>
                  <span className="match-round">{match.round}</span>
                  <div>
                    <strong>{match.rival || 'Rival pendiente'}</strong>
                    <small>{match.fecha || 'Fecha pendiente'} · {match.homeAway || ''}</small>
                  </div>
                  <b className={`match-result ${match.result || 'pending'}`}>
                    {match.played ? `${match.score} (${match.result === 'win' ? 'Victoria' : match.result === 'draw' ? 'Empate' : 'Derrota'})` : 'Pendiente'}
                  </b>
                </article>
              ))
            ) : (
              <p className="empty-state">No hay partidos para mostrar.</p>
            )}
          </div>
        </section>
        <section className="tournament-card">
          <div className="section-heading">
            <div>
              <h3>Tabla de posiciones</h3>
              <small>{current.divisionName || 'Competencia oficial'}</small>
            </div>
          </div>
          <div className="standings-wrap">
            <table className="standings-react">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Equipo</th>
                  <th>PTS</th>
                  <th>PJ</th>
                  <th>DG</th>
                </tr>
              </thead>
              <tbody>
                {current.standings.length ? (
                  current.standings.map((row, index) => (
                    <tr className={matchesClub(row) ? 'highlight' : ''} key={`${row.team}-${index}`}>
                      <td>{row.pos || index + 1}</td>
                      <td>{row.team}</td>
                      <td>{row.pts ?? 0}</td>
                      <td>{row.pj ?? 0}</td>
                      <td>{row.dif ?? 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">No hay posiciones disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="tournament-card scorers-card">
        <div className="section-heading">
          <div>
            <h3>Goleadoras</h3>
            <small>Registro oficial del torneo</small>
          </div>
        </div>
        {scorers.length ? (
          <div className="scorers-list">
            {scorers.map((scorer, index) => (
              <div key={`${scorer.player}-${index}`}>
                <span>#{index + 1}</span>
                <strong>{scorer.player}</strong>
                <small>{scorer.club}</small>
                <b>
                  {scorer.goals} {scorer.goals === 1 ? 'gol' : 'goles'}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No hay goleadoras disponibles.</p>
        )}
      </section>
    </section>
  );
}

