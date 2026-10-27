const postgres = require('./postgres');
const { mapDefinition } = require('./physical-tests');

function ensureDb() {
  if (!postgres.isConfigured()) throw new Error('DATABASE_URL no está configurada.');
  return postgres.getPool();
}

async function ensureSeasonId(slug, seasonName, tournamentKey) {
  const name = String(seasonName || new Date().getFullYear()).trim().slice(0, 60) || String(new Date().getFullYear());
  const db = ensureDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO sc_seasons (club_slug, name) VALUES ($1, $2)
       ON CONFLICT (club_slug, name) DO NOTHING RETURNING id`, [slug, name]
    );
    const season = inserted.rowCount
      ? inserted.rows[0]
      : (await client.query('SELECT id FROM sc_seasons WHERE club_slug = $1 AND name = $2', [slug, name])).rows[0];
    if (!season) throw new Error('No se pudo preparar la temporada activa.');

    // Los registros anteriores a la separación por temporadas pertenecen a la temporada activa inicial.
    for (const table of ['sc_matches', 'sc_physical_assessments', 'sc_player_wellness', 'sc_player_training_loads']) {
      await client.query(`UPDATE ${table} SET season_id = $2 WHERE club_slug = $1 AND season_id IS NULL`, [slug, season.id]);
    }
    if (tournamentKey !== undefined) {
      const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
      await client.query(
        `UPDATE sc_matches SET tournament_key = $3
         WHERE club_slug = $1 AND season_id = $2 AND tournament_key IS NULL`, [slug, season.id, competitionKey]
      );
    }
    await client.query('COMMIT');
    return season.id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getPhysicalTestDefinitions(slug, includeInactive = false) {
  const result = await ensureDb().query(
    `SELECT test_key, name, category, unit, direction, decimals, max_attempts, active,
            (SELECT COUNT(*) FROM sc_physical_test_results r
             JOIN sc_physical_assessments a ON a.id = r.assessment_id
             WHERE a.club_slug = definitions.club_slug AND r.test_key = definitions.test_key) AS data_count
     FROM sc_physical_test_definitions
     AS definitions
     WHERE club_slug = $1 AND ($2::boolean OR active = TRUE)
     ORDER BY name`, [slug, includeInactive]
  );
  return result.rows.map(mapDefinition);
}

async function savePhysicalTestDefinition(slug, input) {
  const name = String(input.name || '').trim();
  const unit = String(input.unit || '').trim();
  const category = String(input.category || 'personalizada').trim();
  const direction = ['higher', 'lower', 'neutral'].includes(input.direction) ? input.direction : 'neutral';
  const decimals = Number(input.decimals);
  const maxAttempts = Number(input.maxAttempts);
  if (!name || name.length > 80) throw new Error('Indicá un nombre de prueba de hasta 80 caracteres.');
  if (unit.length > 16) throw new Error('La unidad no puede superar los 16 caracteres.');
  if (!category || category.length > 40) throw new Error('Indicá una categoría de hasta 40 caracteres.');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 3) throw new Error('Los decimales deben estar entre 0 y 3.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error('La cantidad de evaluaciones anuales debe estar entre 1 y 10.');
  const definitions = await getPhysicalTestDefinitions(slug, true);
  if (definitions.some(test => test.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)) {
    throw new Error('Ya existe una prueba con ese nombre. Si está inactiva, podés reactivarla desde el catálogo.');
  }
  const baseKey = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56);
  const key = `custom-${baseKey || 'prueba'}`;
  const inserted = await ensureDb().query(
    `INSERT INTO sc_physical_test_definitions
       (club_slug, test_key, name, category, unit, direction, decimals, max_attempts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (club_slug, test_key) DO NOTHING
     RETURNING test_key`, [slug, key, name, category, unit, direction, decimals, maxAttempts]
  );
  if (!inserted.rowCount) throw new Error('Ya existe una prueba con ese nombre o clave.');
  return { saved: true, key };
}

async function deactivatePhysicalTestDefinition(slug, testKey) {
  const result = await ensureDb().query(
    `UPDATE sc_physical_test_definitions SET active = FALSE, updated_at = NOW()
     WHERE club_slug = $1 AND test_key = $2 AND active = TRUE`, [slug, testKey]
  );
  return { deactivated: result.rowCount > 0 };
}

async function reactivatePhysicalTestDefinition(slug, testKey) {
  const result = await ensureDb().query(
    `UPDATE sc_physical_test_definitions SET active = TRUE, updated_at = NOW()
     WHERE club_slug = $1 AND test_key = $2 AND active = FALSE`, [slug, testKey]
  );
  return { reactivated: result.rowCount > 0 };
}

async function deletePhysicalTestDefinition(slug, testKey) {
  const result = await ensureDb().query(
    `DELETE FROM sc_physical_test_definitions d
     WHERE d.club_slug = $1 AND d.test_key = $2
       AND NOT EXISTS (
         SELECT 1 FROM sc_physical_test_results r
         JOIN sc_physical_assessments a ON a.id = r.assessment_id
         WHERE a.club_slug = d.club_slug AND r.test_key = d.test_key
       )`, [slug, testKey]
  );
  return { deleted: result.rowCount > 0 };
}

async function getClubData(slug, seasonName, tournamentKey) {
  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const physicalTests = await getPhysicalTestDefinitions(slug, true);
  const [callups, assessments, events, roster] = await Promise.all([
    db.query(`SELECT t.category, m.provider_match_id AS callup_match_key, m.round_label, m.opponent, m.home_away, m.date_label,
                     m.call_time, m.match_time, m.venue, m.opponent_logo_url,
                     COALESCE(array_agg(p.display_name ORDER BY cp.position) FILTER (WHERE p.id IS NOT NULL), '{}') AS players
              FROM sc_teams t
              LEFT JOIN sc_callups c ON c.team_id = t.id
              LEFT JOIN sc_matches m ON m.id = c.match_id
              LEFT JOIN sc_callup_players cp ON cp.callup_id = c.id
              LEFT JOIN sc_players p ON p.id = cp.player_id
              WHERE t.club_slug = $1 AND (c.id IS NULL OR (m.season_id = $2 AND m.tournament_key = $3))
              GROUP BY t.category, m.id, c.updated_at
              ORDER BY c.updated_at DESC NULLS LAST`, [slug, seasonId, competitionKey]),
    db.query(`SELECT p.id, p.display_name, t.category, a.evaluated_on,
                     r.test_key, r.attempt, r.value, r.unit
              FROM sc_players p
              LEFT JOIN LATERAL (
                SELECT t.category FROM sc_team_players tp JOIN sc_teams t ON t.id = tp.team_id
                WHERE tp.player_id = p.id ORDER BY t.category LIMIT 1
              ) t ON TRUE
              LEFT JOIN LATERAL (
                SELECT pa.id, pa.evaluated_on FROM sc_physical_assessments pa
                WHERE pa.player_id = p.id AND pa.season_id = $2
                ORDER BY pa.evaluated_on DESC NULLS LAST, pa.created_at DESC LIMIT 1
              ) a ON TRUE
              LEFT JOIN sc_physical_test_results r ON r.assessment_id = a.id
              WHERE p.club_slug = $1 AND p.active = TRUE
              ORDER BY p.display_name, a.evaluated_on, r.test_key, r.attempt`, [slug, seasonId]),
      db.query(`SELECT e.id, e.external_id, e.occurred_at, e.quarter, e.team_side,
                     e.event_type, e.player_name, e.details, m.round_label, m.opponent, m.provider_match_id
              FROM sc_match_events e LEFT JOIN sc_matches m ON m.id = e.match_id
              WHERE e.club_slug = $1 AND m.season_id = $2 AND m.tournament_key = $3
              ORDER BY e.occurred_at, e.id`, [slug, seasonId, competitionKey]),
    db.query(`SELECT p.id, p.display_name, p.active,
                     COALESCE(array_agg(DISTINCT t.category ORDER BY t.category)
                       FILTER (WHERE t.category IS NOT NULL), '{}') AS categories
              FROM sc_players p
              LEFT JOIN sc_team_players tp ON tp.player_id = p.id
              LEFT JOIN sc_teams t ON t.id = tp.team_id AND t.club_slug = p.club_slug
              WHERE p.club_slug = $1
              GROUP BY p.id
              ORDER BY p.active DESC, p.display_name`, [slug])
  ]);

  const citations = { primera: { players: [], meta: {}, matchKey: '' }, intermedia: { players: [], meta: {}, matchKey: '' } };
  const seenCategory = new Set();
  for (const row of callups.rows) {
    const category = row.category;
    if (!category || seenCategory.has(category) || !citations[category]) continue;
    seenCategory.add(category);
    citations[category].players = row.players || [];
    citations[category].matchKey = row.callup_match_key || '';
    const meta = citations[category].meta;
    if (row.round_label) meta['fecha n°'] = row.round_label;
    if (row.opponent) meta.rival = row.opponent;
    if (row.date_label) meta.dia = row.date_label;
    if (row.home_away) meta.localia = row.home_away;
    if (row.venue) meta.cancha = row.venue;
    if (row.call_time) meta['horario citacion'] = row.call_time;
    if (row.match_time) meta['horario partido'] = row.match_time;
    if (row.opponent_logo_url) meta['url escudo rival'] = row.opponent_logo_url;
  }

  const physicalByPlayer = new Map();
  for (const row of assessments.rows) {
    let player = physicalByPlayer.get(row.id);
    if (!player) {
      const filterTag = row.category === 'intermedia' ? 'Inter' : row.category === '5ta' ? '5ta' : '1ra';
      const division = row.category === 'intermedia' ? 'Intermedia' : row.category === '5ta' ? '5ta División' : '1ra División';
      player = { id: `p_${row.id}`, name: row.display_name, evaluatedOn: row.evaluated_on, division, rama: row.category || '', divisionLabel: division, filterTag, tests: {} };
      physicalByPlayer.set(row.id, player);
    }
    if (row.test_key) {
      const test = player.tests[row.test_key] || (player.tests[row.test_key] = { evals: [] });
      test.evals.push({ round: Number(row.attempt), value: Number(row.value), unit: row.unit });
    }
  }
  for (const player of physicalByPlayer.values()) {
    for (const [key, test] of Object.entries(player.tests)) {
      test.evals.sort((a, b) => a.round - b.round);
      const first = test.evals[0]?.value;
      const last = test.evals.at(-1)?.value;
      test.diff = test.evals.length > 1 ? Number((last - first).toFixed(2)) : null;
      test.diffPct = test.evals.length > 1 && first !== 0 ? Number((test.diff / first * 100).toFixed(1)) : 0;
      const definition = physicalTests.find(item => item.key === key);
      test.improved = test.diff === null || !definition || definition.direction === 'neutral'
        ? null
        : definition.direction === 'higher' ? test.diff > 0 : test.diff < 0;
    }
  }

  const matchEvents = events.rows.map(row => ({
    ...(row.details || {}),
    id: row.external_id || String(row.id),
    match: row.round_label || 'amistoso',
    matchKey: row.provider_match_id || undefined,
    opponent: row.opponent || undefined,
    quarter: Number(row.quarter),
    team: row.team_side,
    type: row.event_type,
    player: row.player_name || undefined,
    at: row.occurred_at
  }));

  return {
    citations,
    physicalPlayers: Array.from(physicalByPlayer.values()),
    physicalTests,
    events: matchEvents,
    players: roster.rows.map(row => ({ id: String(row.id), name: row.display_name, active: row.active, categories: row.categories || [] }))
  };
}

async function getMatchPreparations(slug, seasonName, tournamentKey) {
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const result = await ensureDb().query(
    `SELECT t.category, m.provider_match_id AS match_key, m.round_label, m.opponent,
            m.home_away, m.date_label, m.preparation, m.updated_at
     FROM sc_matches m
     JOIN sc_teams t ON t.id = m.team_id AND t.club_slug = m.club_slug
     WHERE m.club_slug = $1 AND m.provider = 'preparation' AND m.season_id = $2 AND m.tournament_key = $3
     ORDER BY m.updated_at DESC`, [slug, seasonId, competitionKey]
  );
  return result.rows.map(row => ({
    category: row.category,
    matchKey: row.match_key,
    round: row.round_label,
    opponent: row.opponent,
    homeAway: row.home_away,
    date: row.date_label,
    preparation: row.preparation || { focus: '', videoUrls: [], plays: [] },
    updatedAt: row.updated_at
  }));
}

async function getPlayerMonitoring(slug, seasonName) {
  const seasonId = await ensureSeasonId(slug, seasonName);
  const [wellness, loads] = await Promise.all([
    ensureDb().query(
      `SELECT w.id, w.player_id, p.display_name AS player_name, w.team_category, w.response_date,
              w.sleep, w.fatigue, w.muscle_soreness, w.stress, w.mood, w.created_at
       FROM sc_player_wellness w
       JOIN sc_players p ON p.id = w.player_id AND p.club_slug = w.club_slug
       WHERE w.club_slug = $1 AND w.season_id = $2
       ORDER BY w.response_date DESC, p.display_name`, [slug, seasonId]
    ),
    ensureDb().query(
      `SELECT l.id, l.player_id, p.display_name AS player_name, l.team_category, l.training_date,
              l.duration_minutes, l.perceived_effort,
              l.duration_minutes * l.perceived_effort AS load, l.created_at
       FROM sc_player_training_loads l
       JOIN sc_players p ON p.id = l.player_id AND p.club_slug = l.club_slug
       WHERE l.club_slug = $1 AND l.season_id = $2
       ORDER BY l.training_date DESC, p.display_name`, [slug, seasonId]
    )
  ]);
  return {
    wellness: wellness.rows.map(row => ({ ...row, id: String(row.id), playerId: String(row.player_id) })),
    loads: loads.rows.map(row => ({ ...row, id: String(row.id), playerId: String(row.player_id), load: Number(row.load) }))
  };
}

async function getSeasonBackup(slug, seasonName, tournamentKey) {
  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const [roster, matches, callups, physicalAssessments, trackerEvents, monitoring] = await Promise.all([
    db.query(`SELECT p.id, p.display_name AS name, p.active,
                    COALESCE(array_agg(DISTINCT t.category ORDER BY t.category)
                      FILTER (WHERE t.category IS NOT NULL), '{}') AS categories
             FROM sc_players p
             LEFT JOIN sc_team_players tp ON tp.player_id = p.id
             LEFT JOIN sc_teams t ON t.id = tp.team_id AND t.club_slug = p.club_slug
             WHERE p.club_slug = $1 GROUP BY p.id ORDER BY p.display_name`, [slug]),
    db.query(`SELECT id, team_id, provider, provider_match_id AS match_key, round_label AS round,
                    opponent, home_away AS home_away, starts_at, date_label AS date,
                    call_time, match_time, venue, opponent_logo_url, status,
                    tournament_key, tournament_name, preparation, created_at, updated_at
             FROM sc_matches WHERE club_slug = $1 AND season_id = $2
             ORDER BY starts_at NULLS LAST, date_label, created_at`, [slug, seasonId]),
    db.query(`SELECT c.id, t.category, m.provider, m.provider_match_id AS match_key,
                    m.round_label AS round, m.opponent, m.home_away AS home_away,
                    m.date_label AS date, m.call_time, m.match_time, m.venue,
                    m.tournament_key, m.tournament_name, c.notes, c.updated_at,
                    COALESCE(json_agg(json_build_object('id', p.id, 'name', p.display_name, 'position', cp.position)
                      ORDER BY cp.position) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS players
             FROM sc_callups c
             JOIN sc_matches m ON m.id = c.match_id
             JOIN sc_teams t ON t.id = c.team_id
             LEFT JOIN sc_callup_players cp ON cp.callup_id = c.id
             LEFT JOIN sc_players p ON p.id = cp.player_id
             WHERE m.club_slug = $1 AND m.season_id = $2
             GROUP BY c.id, t.category, m.id
             ORDER BY m.starts_at NULLS LAST, m.date_label, t.category`, [slug, seasonId]),
    db.query(`SELECT a.id, a.player_id, p.display_name AS player_name, a.evaluated_on,
                    a.source_key, a.source_data, a.created_at,
                    COALESCE(json_agg(json_build_object('test', r.test_key, 'attempt', r.attempt,
                      'value', r.value, 'unit', r.unit) ORDER BY r.test_key, r.attempt)
                      FILTER (WHERE r.assessment_id IS NOT NULL), '[]'::json) AS results
             FROM sc_physical_assessments a
             JOIN sc_players p ON p.id = a.player_id
             LEFT JOIN sc_physical_test_results r ON r.assessment_id = a.id
             WHERE a.club_slug = $1 AND a.season_id = $2
             GROUP BY a.id, p.display_name ORDER BY a.evaluated_on, p.display_name`, [slug, seasonId]),
    db.query(`SELECT e.id, e.external_id, e.match_id, e.occurred_at, e.quarter,
                    e.team_side, e.event_type, e.player_name, e.details,
                    m.provider_match_id AS match_key, m.round_label AS round, m.opponent,
                    m.tournament_key, m.tournament_name
             FROM sc_match_events e
             JOIN sc_matches m ON m.id = e.match_id
             WHERE e.club_slug = $1 AND m.season_id = $2 AND m.provider = 'tracker'
             ORDER BY m.tournament_key, e.occurred_at, e.id`, [slug, seasonId]),
    getPlayerMonitoring(slug, seasonName)
  ]);
  return {
    season: String(seasonName || new Date().getFullYear()),
    exportedAt: new Date().toISOString(),
    physicalTests: await getPhysicalTestDefinitions(slug, true),
    players: roster.rows.map(row => ({ ...row, id: String(row.id) })),
    matches: matches.rows,
    callups: callups.rows,
    physicalAssessments: physicalAssessments.rows,
    trackerEvents: trackerEvents.rows,
    monitoring
  };
}

async function getTournamentStats(slug, seasonName, tournamentKey, tournamentName) {
  const activeSeasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const activeTournamentKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const activeKey = `${activeSeasonId}:${activeTournamentKey}`;
  const result = await ensureDb().query(
    `SELECT s.id AS season_id, s.name AS season_name, m.tournament_key, m.tournament_name,
            m.provider_match_id, m.round_label, m.opponent,
            e.id, e.external_id, e.occurred_at, e.quarter, e.team_side,
            e.event_type, e.player_name, e.details
     FROM sc_matches m
     JOIN sc_seasons s ON s.id = m.season_id
     JOIN sc_match_events e ON e.match_id = m.id
     WHERE m.club_slug = $1 AND m.provider = 'tracker'
     ORDER BY s.created_at DESC, s.name DESC, m.tournament_name, e.occurred_at, e.id`, [slug]
  );
  const tournaments = new Map();
  for (const row of result.rows) {
    const key = `${row.season_id}:${row.tournament_key || 'general'}`;
    if (!tournaments.has(key)) {
      const name = row.tournament_name || row.tournament_key || 'Torneo';
      tournaments.set(key, {
        key,
        name,
        seasonName: row.season_name,
        label: `${name} · Temporada ${row.season_name}`,
        events: []
      });
    }
    tournaments.get(key).events.push({
      ...(row.details || {}),
      id: row.external_id || String(row.id),
      match: row.round_label || 'amistoso',
      matchKey: row.provider_match_id || undefined,
      opponent: row.opponent || undefined,
      quarter: Number(row.quarter),
      team: row.team_side,
      type: row.event_type,
      player: row.player_name || undefined,
      at: row.occurred_at
    });
  }
  if (!tournaments.has(activeKey)) {
    const name = tournamentName || activeTournamentKey;
    tournaments.set(activeKey, {
      key: activeKey,
      name,
      seasonName: String(seasonName || new Date().getFullYear()),
      label: `${name} · Temporada ${seasonName || new Date().getFullYear()}`,
      events: []
    });
  }
  const options = [...tournaments.values()];
  options.sort((a, b) => a.key === activeKey ? -1 : b.key === activeKey ? 1 : b.seasonName.localeCompare(a.seasonName, 'es', { numeric: true }));
  return { tournaments: options, activeKey };
}

async function getPlayerPortalRoster(slug) {
  const result = await ensureDb().query(
    `SELECT p.id, p.display_name AS name,
            COALESCE(array_agg(t.category ORDER BY t.category) FILTER (WHERE t.category IS NOT NULL), '{}') AS categories
     FROM sc_players p
     LEFT JOIN sc_team_players tp ON tp.player_id = p.id
     LEFT JOIN sc_teams t ON t.id = tp.team_id AND t.club_slug = p.club_slug
     WHERE p.club_slug = $1 AND p.active = TRUE
     GROUP BY p.id
     ORDER BY p.display_name`, [slug]
  );
  return result.rows.map(row => ({ id: String(row.id), name: row.name, categories: row.categories || [] }));
}

async function savePlayerMonitoring(slug, input, seasonName) {
  const playerId = Number(input.playerId);
  const category = String(input.category || '');
  const date = String(input.date || '');
  const kind = String(input.kind || '');
  if (!Number.isSafeInteger(playerId) || playerId <= 0) throw new Error('Seleccioná una jugadora válida.');
  if (!['primera', 'intermedia', '5ta'].includes(category)) throw new Error('Seleccioná una categoría válida.');
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error('La fecha no es válida.');

  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName);
  const player = await db.query(
    `SELECT p.id FROM sc_players p
     JOIN sc_team_players tp ON tp.player_id = p.id
     JOIN sc_teams t ON t.id = tp.team_id AND t.club_slug = p.club_slug AND t.category = $3
     WHERE p.club_slug = $1 AND p.id = $2 AND p.active = TRUE LIMIT 1`, [slug, playerId, category]
  );
  if (!player.rowCount) throw new Error('La jugadora no pertenece a esa categoría del club.');

  if (kind === 'wellness') {
    const metrics = ['sleep', 'fatigue', 'muscleSoreness', 'stress', 'mood'];
    const values = metrics.map(key => Number(input[key]));
    if (values.some(value => !Number.isInteger(value) || value < 1 || value > 5)) throw new Error('Completá todas las métricas del wellness.');
    await db.query(
      `INSERT INTO sc_player_wellness
         (club_slug, player_id, team_category, response_date, sleep, fatigue, muscle_soreness, stress, mood, season_id)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (club_slug, player_id, response_date, season_id) DO UPDATE SET
         team_category = EXCLUDED.team_category, sleep = EXCLUDED.sleep, fatigue = EXCLUDED.fatigue,
         muscle_soreness = EXCLUDED.muscle_soreness, stress = EXCLUDED.stress, mood = EXCLUDED.mood,
          created_at = NOW()`, [slug, playerId, category, date, ...values, seasonId]
    );
    return { saved: true, kind };
  }

  if (kind === 'load') {
    const minutes = Number(input.durationMinutes);
    const effort = Number(input.perceivedEffort);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360 || !Number.isInteger(effort) || effort < 1 || effort > 10) {
      throw new Error('Indicá una duración válida y un esfuerzo entre 1 y 10.');
    }
    await db.query(
      `INSERT INTO sc_player_training_loads
         (club_slug, player_id, team_category, training_date, duration_minutes, perceived_effort, season_id)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7)
       ON CONFLICT (club_slug, player_id, training_date, season_id) DO UPDATE SET
         team_category = EXCLUDED.team_category, duration_minutes = EXCLUDED.duration_minutes,
         perceived_effort = EXCLUDED.perceived_effort, created_at = NOW()`,
      [slug, playerId, category, date, minutes, effort, seasonId]
    );
    return { saved: true, kind, load: minutes * effort };
  }
  throw new Error('Tipo de registro inválido.');
}

async function saveMatchPreparation(slug, input, seasonName, tournamentKey, tournamentName) {
  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const teamResult = await client.query(
      `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $3)
       ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [slug, input.category, input.category]
    );
    const result = await client.query(
      `INSERT INTO sc_matches (club_slug, team_id, provider, provider_match_id, round_label,
                               opponent, home_away, date_label, preparation, season_id, tournament_key, tournament_name)
       VALUES ($1, $2, 'preparation', $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id, season_id, tournament_key) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent,
         home_away = EXCLUDED.home_away, date_label = EXCLUDED.date_label,
         preparation = EXCLUDED.preparation, tournament_name = EXCLUDED.tournament_name, updated_at = NOW()
       RETURNING id`,
      [slug, teamResult.rows[0].id, input.matchKey, input.round, input.opponent,
        input.homeAway || 'Local', input.date || '', JSON.stringify(input.preparation), seasonId, competitionKey,
        tournamentName || competitionKey]
    );
    await client.query('COMMIT');
    return { id: String(result.rows[0].id), matchKey: input.matchKey };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMatchPreparation(slug, input, seasonName, tournamentKey) {
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const result = await ensureDb().query(
    `DELETE FROM sc_matches m
     USING sc_teams t
     WHERE m.club_slug = $1 AND m.team_id = t.id AND t.club_slug = m.club_slug
       AND t.category = $2 AND m.provider = 'preparation' AND m.provider_match_id = $3
       AND m.season_id = $4 AND m.tournament_key = $5`,
    [slug, input.category, input.matchKey, seasonId, competitionKey]
  );
  return result.rowCount > 0;
}

async function savePlayer(slug, input) {
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  const category = String(input.category || '');
  if (!name || name.length > 120) throw new Error('El nombre debe tener entre 1 y 120 caracteres.');
  if (!['primera', 'intermedia', '5ta'].includes(category)) throw new Error('Categoría inválida.');
  const db = ensureDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const team = await client.query(
      `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $3)
       ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [slug, category, category]
    );
    const player = await client.query(
      `INSERT INTO sc_players (club_slug, display_name) VALUES ($1, $2)
       ON CONFLICT (club_slug, display_name) DO UPDATE SET active = TRUE, updated_at = NOW()
       RETURNING id, display_name`, [slug, name]
    );
    await client.query('INSERT INTO sc_team_players (team_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [team.rows[0].id, player.rows[0].id]);
    await client.query('COMMIT');
    return { id: String(player.rows[0].id), name: player.rows[0].display_name, category, active: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updatePlayer(slug, input) {
  const id = Number(input.id);
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  const categories = [...new Set(Array.isArray(input.categories) ? input.categories : [])];
  const allowedCategories = ['primera', 'intermedia', '5ta'];
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('La jugadora seleccionada no es válida.');
  if (!name || name.length > 120) throw new Error('El nombre debe tener entre 1 y 120 caracteres.');
  if (!categories.length || categories.some(category => !allowedCategories.includes(category))) {
    throw new Error('Seleccioná al menos una categoría válida.');
  }

  const db = ensureDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE sc_players SET display_name = $3, updated_at = NOW()
       WHERE club_slug = $1 AND id = $2 RETURNING id, display_name`, [slug, id, name]
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      throw new Error('No se encontró la jugadora en este club.');
    }
    await client.query('DELETE FROM sc_team_players WHERE player_id = $1', [id]);
    for (const category of categories) {
      const team = await client.query(
        `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $2)
         ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [slug, category]
      );
      await client.query('INSERT INTO sc_team_players (team_id, player_id) VALUES ($1, $2)', [team.rows[0].id, id]);
    }
    await client.query('COMMIT');
    return { id: String(updated.rows[0].id), name: updated.rows[0].display_name, categories, active: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new Error('Ya existe otra jugadora con ese nombre en este club.');
    throw error;
  } finally {
    client.release();
  }
}

async function saveCallup(slug, input, seasonName, tournamentKey, tournamentName) {
  const players = [...new Set((input.players || []).map(name => String(name).trim()).filter(Boolean))];
  if (players.length > 60 || players.some(name => name.length > 120)) throw new Error('La convocatoria supera los límites permitidos.');
  if (!String(input.matchKey || '').trim()) throw new Error('Falta identificar el partido de la convocatoria.');
  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const teamResult = await client.query(
      `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $3)
       ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [slug, input.teamName || input.category, input.category]
    );
    const teamId = teamResult.rows[0].id;
    const matchResult = await client.query(
      `INSERT INTO sc_matches (club_slug, team_id, provider, provider_match_id, round_label, opponent,
                           home_away, date_label, call_time, match_time, venue, opponent_logo_url, season_id, tournament_key, tournament_name)
       VALUES ($1, $2, 'club-data', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id, season_id, tournament_key) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent, home_away = EXCLUDED.home_away,
         date_label = EXCLUDED.date_label, call_time = EXCLUDED.call_time, match_time = EXCLUDED.match_time,
          venue = EXCLUDED.venue, opponent_logo_url = EXCLUDED.opponent_logo_url,
          tournament_name = EXCLUDED.tournament_name, updated_at = NOW()
       RETURNING id`,
       [slug, teamId, input.matchKey || 'current', input.round || 'Amistoso', input.opponent || 'Rival',
        input.homeAway || 'Local', input.date || '', input.callTime || '', input.matchTime || '',
         input.venue || '', input.opponentLogoUrl || '', seasonId, competitionKey, tournamentName || competitionKey]
    );
    const matchId = matchResult.rows[0].id;
    const callupResult = await client.query(
      `INSERT INTO sc_callups (match_id, team_id) VALUES ($1, $2)
       ON CONFLICT (match_id, team_id) DO UPDATE SET updated_at = NOW() RETURNING id`, [matchId, teamId]
    );
    const callupId = callupResult.rows[0].id;
    const roster = players.length
      ? await client.query(
        `SELECT id, display_name FROM sc_players
         WHERE club_slug = $1 AND active = TRUE AND display_name = ANY($2::text[])`, [slug, players]
      )
      : { rows: [] };
    if (roster.rows.length !== players.length) {
      throw new Error('La citación solo puede incluir jugadoras activas cargadas en el plantel del club.');
    }
    const rosterByName = new Map(roster.rows.map(player => [player.display_name, player.id]));
    await client.query(
      `DELETE FROM sc_callups c USING sc_matches m
       WHERE c.match_id = m.id AND c.team_id = $1 AND c.id <> $2
         AND m.season_id = $3 AND m.tournament_key = $4`,
      [teamId, callupId, seasonId, competitionKey]
    );
    await client.query('DELETE FROM sc_callup_players WHERE callup_id = $1', [callupId]);
    for (const [position, displayName] of players.entries()) {
      await client.query('INSERT INTO sc_callup_players (callup_id, player_id, position) VALUES ($1, $2, $3)',
        [callupId, rosterByName.get(displayName), position]);
    }
    await client.query('COMMIT');
    return { matchId, callupId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function saveEvent(slug, input, seasonName, tournamentKey, tournamentName) {
  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const round = String(input.match || 'Amistoso');
    const matchKey = String(input.matchKey || round.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    const matchResult = await client.query(
      `INSERT INTO sc_matches (club_slug, provider, provider_match_id, round_label, opponent, season_id, tournament_key, tournament_name)
       VALUES ($1, 'tracker', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id, season_id, tournament_key) DO UPDATE SET
         round_label = EXCLUDED.round_label, tournament_name = EXCLUDED.tournament_name
       RETURNING id`, [slug, matchKey, round, input.opponent || 'Rival', seasonId, competitionKey, tournamentName || competitionKey]
    );
    const event = input.event || input;
    const result = await client.query(
      `INSERT INTO sc_match_events (club_slug, match_id, external_id, occurred_at, quarter, team_side, event_type, player_name, details)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (club_slug, external_id) DO UPDATE SET
         match_id = EXCLUDED.match_id,
         occurred_at = CASE WHEN $4::timestamptz IS NULL THEN sc_match_events.occurred_at ELSE EXCLUDED.occurred_at END,
         quarter = EXCLUDED.quarter,
         team_side = EXCLUDED.team_side, event_type = EXCLUDED.event_type, player_name = EXCLUDED.player_name,
         details = EXCLUDED.details RETURNING id`,
      [slug, matchResult.rows[0].id, String(event.id || `${Date.now()}-${Math.random()}`), event.at || null,
        event.quarter || 1, event.team || 'home', event.type || 'entry', event.player || null,
        JSON.stringify(event)]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function replaceMatchEvents(slug, input, seasonName, tournamentKey, tournamentName) {
  if (input.events.length > 1000) throw new Error('El partido supera el máximo de incidencias permitido.');
  const db = ensureDb();
  const seasonId = await ensureSeasonId(slug, seasonName, tournamentKey);
  const competitionKey = String(tournamentKey || 'general').trim().slice(0, 120) || 'general';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const round = String(input.match || 'Amistoso');
    const matchKey = String(input.matchKey || round.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    const matchResult = await client.query(
      `INSERT INTO sc_matches (club_slug, provider, provider_match_id, round_label, opponent, season_id, tournament_key, tournament_name)
       VALUES ($1, 'tracker', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id, season_id, tournament_key) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent,
         tournament_name = EXCLUDED.tournament_name, updated_at = NOW()
       RETURNING id`, [slug, matchKey, round, input.opponent || 'Rival', seasonId, competitionKey, tournamentName || competitionKey]
    );
    const matchId = matchResult.rows[0].id;
    const eventIds = input.events.map(event => String(event.id || '')).filter(Boolean);
    await client.query(
      `DELETE FROM sc_match_events WHERE club_slug = $1 AND match_id = $2
       AND NOT (external_id = ANY($3::text[]))`, [slug, matchId, eventIds]
    );
    for (const event of input.events) {
      await client.query(
        `INSERT INTO sc_match_events (club_slug, match_id, external_id, occurred_at, quarter, team_side, event_type, player_name, details)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (club_slug, external_id) DO UPDATE SET
           match_id = EXCLUDED.match_id,
           occurred_at = CASE WHEN $4::timestamptz IS NULL THEN sc_match_events.occurred_at ELSE EXCLUDED.occurred_at END,
           quarter = EXCLUDED.quarter,
           team_side = EXCLUDED.team_side, event_type = EXCLUDED.event_type, player_name = EXCLUDED.player_name,
           details = EXCLUDED.details`,
        [slug, matchId, String(event.id || `${Date.now()}-${Math.random()}`), event.at || null,
          event.quarter || 1, event.team || 'home', event.type || 'entry', event.player || null,
          JSON.stringify(event)]
      );
    }
    await client.query('COMMIT');
    return { matchId, saved: input.events.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteEvent(slug, id) {
  const result = await ensureDb().query('DELETE FROM sc_match_events WHERE club_slug = $1 AND external_id = $2', [slug, String(id)]);
  return result.rowCount > 0;
}

async function deleteEvents(slug, ids) {
  const externalIds = [...new Set(ids.map(id => String(id)))];
  const result = await ensureDb().query(
    'DELETE FROM sc_match_events WHERE club_slug = $1 AND external_id = ANY($2::text[])',
    [slug, externalIds]
  );
  return result.rowCount;
}

async function savePhysicalAssessment(slug, input, seasonName) {
  if ((!input.playerId && !input.name) || !Array.isArray(input.results)) throw new Error('Seleccioná una jugadora del plantel y completá sus mediciones.');
  const db = ensureDb();
  const testDefinitions = await getPhysicalTestDefinitions(slug);
  const testsByKey = new Map(testDefinitions.map(test => [test.key, test]));
  const seasonId = await ensureSeasonId(slug, seasonName);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const category = ['primera', 'intermedia', '5ta'].includes(input.category) ? input.category : 'primera';
    let playerId;
    if (input.playerId) {
      const selectedPlayerId = Number(input.playerId);
      if (!Number.isSafeInteger(selectedPlayerId) || selectedPlayerId <= 0) throw new Error('Seleccioná una jugadora válida del plantel.');
      const player = await client.query(
        `SELECT p.id FROM sc_players p
         JOIN sc_team_players tp ON tp.player_id = p.id
         JOIN sc_teams t ON t.id = tp.team_id AND t.club_slug = p.club_slug
         WHERE p.club_slug = $1 AND p.id = $2 AND p.active = TRUE AND t.category = $3
         LIMIT 1`, [slug, selectedPlayerId, category]
      );
      if (!player.rowCount) throw new Error('La jugadora seleccionada no pertenece a esta categoría del plantel.');
      playerId = player.rows[0].id;
    } else {
      const team = await client.query(
        `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $3)
         ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [slug, input.teamName || category, category]
      );
      const player = await client.query(
        `INSERT INTO sc_players (club_slug, display_name) VALUES ($1, $2)
         ON CONFLICT (club_slug, display_name) DO UPDATE SET active = TRUE, updated_at = NOW() RETURNING id`,
        [slug, String(input.name).trim()]
      );
      await client.query('INSERT INTO sc_team_players (team_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [team.rows[0].id, player.rows[0].id]);
      playerId = player.rows[0].id;
    }
    let assessment = await client.query(
      `SELECT id FROM sc_physical_assessments WHERE club_slug = $1 AND player_id = $2 AND evaluated_on IS NOT DISTINCT FROM $3::date AND source_key = 'manual' AND season_id = $4 LIMIT 1`,
      [slug, playerId, input.evaluatedOn || null, seasonId]
    );
    if (assessment.rowCount) {
      await client.query('DELETE FROM sc_physical_test_results WHERE assessment_id = $1', [assessment.rows[0].id]);
    } else {
      assessment = await client.query(
        `INSERT INTO sc_physical_assessments (club_slug, player_id, evaluated_on, source_key, season_id)
         VALUES ($1, $2, $3::date, 'manual', $4) RETURNING id`,
        [slug, playerId, input.evaluatedOn || null, seasonId]
      );
    }
    for (const result of input.results) {
      const definition = testsByKey.get(String(result.testKey || ''));
      const attempt = Number(result.attempt);
      const value = Number(result.value);
      if (!definition || !Number.isFinite(value) || !Number.isInteger(attempt) || attempt < 1 || attempt > definition.maxAttempts) {
        throw new Error('Una medición no coincide con las pruebas activas o su cantidad de evaluaciones anuales.');
      }
      await client.query(
        `INSERT INTO sc_physical_test_results (assessment_id, test_key, attempt, value, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [assessment.rows[0].id, definition.key, attempt, value, definition.unit || '']
      );
    }
    await client.query('COMMIT');
    return { playerId, assessmentId: assessment.rows[0].id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { getClubData, getMatchPreparations, getPlayerMonitoring, getSeasonBackup, getTournamentStats, getPlayerPortalRoster, getPhysicalTestDefinitions, savePhysicalTestDefinition, deactivatePhysicalTestDefinition, reactivatePhysicalTestDefinition, deletePhysicalTestDefinition, savePlayerMonitoring, saveMatchPreparation, deleteMatchPreparation, savePlayer, updatePlayer, saveCallup, saveEvent, replaceMatchEvents, deleteEvent, deleteEvents, savePhysicalAssessment };
