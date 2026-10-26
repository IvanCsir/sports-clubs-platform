const postgres = require('./postgres');

function ensureDb() {
  if (!postgres.isConfigured()) throw new Error('DATABASE_URL no está configurada.');
  return postgres.getPool();
}

async function getClubData(slug) {
  const db = ensureDb();
  const [callups, assessments, events, roster] = await Promise.all([
    db.query(`SELECT t.category, m.provider_match_id AS callup_match_key, m.round_label, m.opponent, m.home_away, m.date_label,
                     m.call_time, m.match_time, m.venue, m.opponent_logo_url,
                     COALESCE(array_agg(p.display_name ORDER BY cp.position) FILTER (WHERE p.id IS NOT NULL), '{}') AS players
              FROM sc_teams t
              LEFT JOIN sc_callups c ON c.team_id = t.id
              LEFT JOIN sc_matches m ON m.id = c.match_id
              LEFT JOIN sc_callup_players cp ON cp.callup_id = c.id
              LEFT JOIN sc_players p ON p.id = cp.player_id
              WHERE t.club_slug = $1
              GROUP BY t.category, m.id, c.updated_at
              ORDER BY c.updated_at DESC NULLS LAST`, [slug]),
    db.query(`SELECT p.id, p.display_name, t.category, a.evaluated_on,
                     r.test_key, r.attempt, r.value, r.unit
              FROM sc_players p
              LEFT JOIN LATERAL (
                SELECT t.category FROM sc_team_players tp JOIN sc_teams t ON t.id = tp.team_id
                WHERE tp.player_id = p.id ORDER BY t.category LIMIT 1
              ) t ON TRUE
              LEFT JOIN LATERAL (
                SELECT pa.id, pa.evaluated_on FROM sc_physical_assessments pa
                WHERE pa.player_id = p.id ORDER BY pa.evaluated_on DESC NULLS LAST, pa.created_at DESC LIMIT 1
              ) a ON TRUE
              LEFT JOIN sc_physical_test_results r ON r.assessment_id = a.id
              WHERE p.club_slug = $1 AND p.active = TRUE
              ORDER BY p.display_name, a.evaluated_on, r.test_key, r.attempt`, [slug]),
      db.query(`SELECT e.id, e.external_id, e.occurred_at, e.quarter, e.team_side,
                     e.event_type, e.player_name, e.details, m.round_label, m.opponent, m.provider_match_id
              FROM sc_match_events e LEFT JOIN sc_matches m ON m.id = e.match_id
              WHERE e.club_slug = $1 ORDER BY e.occurred_at, e.id`, [slug]),
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
      const higherIsBetter = ['broadJump', 'cmj', 'yoyo', 'bench', 'deadlift', 'squat', 'platform'].includes(key);
      test.improved = test.diff === null ? null : higherIsBetter ? test.diff > 0 : test.diff < 0;
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
    events: matchEvents,
    players: roster.rows.map(row => ({ id: String(row.id), name: row.display_name, active: row.active, categories: row.categories || [] }))
  };
}

async function getMatchPreparations(slug) {
  const result = await ensureDb().query(
    `SELECT t.category, m.provider_match_id AS match_key, m.round_label, m.opponent,
            m.home_away, m.date_label, m.preparation, m.updated_at
     FROM sc_matches m
     JOIN sc_teams t ON t.id = m.team_id AND t.club_slug = m.club_slug
     WHERE m.club_slug = $1 AND m.provider = 'preparation'
     ORDER BY m.updated_at DESC`, [slug]
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

async function saveMatchPreparation(slug, input) {
  const db = ensureDb();
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
                               opponent, home_away, date_label, preparation)
       VALUES ($1, $2, 'preparation', $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent,
         home_away = EXCLUDED.home_away, date_label = EXCLUDED.date_label,
         preparation = EXCLUDED.preparation, updated_at = NOW()
       RETURNING id`,
      [slug, teamResult.rows[0].id, input.matchKey, input.round, input.opponent,
        input.homeAway || 'Local', input.date || '', JSON.stringify(input.preparation)]
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

async function saveCallup(slug, input) {
  const players = [...new Set((input.players || []).map(name => String(name).trim()).filter(Boolean))];
  if (players.length > 60 || players.some(name => name.length > 120)) throw new Error('La convocatoria supera los límites permitidos.');
  if (!String(input.matchKey || '').trim()) throw new Error('Falta identificar el partido de la convocatoria.');
  const db = ensureDb();
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
                           home_away, date_label, call_time, match_time, venue, opponent_logo_url)
       VALUES ($1, $2, 'club-data', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent, home_away = EXCLUDED.home_away,
         date_label = EXCLUDED.date_label, call_time = EXCLUDED.call_time, match_time = EXCLUDED.match_time,
         venue = EXCLUDED.venue, opponent_logo_url = EXCLUDED.opponent_logo_url, updated_at = NOW()
       RETURNING id`,
      [slug, teamId, input.matchKey || 'current', input.round || 'Amistoso', input.opponent || 'Rival',
        input.homeAway || 'Local', input.date || '', input.callTime || '', input.matchTime || '',
        input.venue || '', input.opponentLogoUrl || '']
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
    await client.query('DELETE FROM sc_callups WHERE team_id = $1 AND id <> $2', [teamId, callupId]);
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

async function saveEvent(slug, input) {
  const db = ensureDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const round = String(input.match || 'Amistoso');
    const matchKey = String(input.matchKey || round.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    const matchResult = await client.query(
      `INSERT INTO sc_matches (club_slug, provider, provider_match_id, round_label, opponent)
       VALUES ($1, 'tracker', $2, $3, $4)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id) DO UPDATE SET round_label = EXCLUDED.round_label
       RETURNING id`, [slug, matchKey, round, input.opponent || 'Rival']
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

async function replaceMatchEvents(slug, input) {
  if (input.events.length > 1000) throw new Error('El partido supera el máximo de incidencias permitido.');
  const db = ensureDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const round = String(input.match || 'Amistoso');
    const matchKey = String(input.matchKey || round.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    const matchResult = await client.query(
      `INSERT INTO sc_matches (club_slug, provider, provider_match_id, round_label, opponent)
       VALUES ($1, 'tracker', $2, $3, $4)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent, updated_at = NOW()
       RETURNING id`, [slug, matchKey, round, input.opponent || 'Rival']
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

async function savePhysicalAssessment(slug, input) {
  if (!input.name || !Array.isArray(input.results)) throw new Error('Faltan datos de la evaluación.');
  const db = ensureDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const category = ['primera', 'intermedia', '5ta'].includes(input.category) ? input.category : 'primera';
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
    let assessment = await client.query(
      `SELECT id FROM sc_physical_assessments WHERE club_slug = $1 AND player_id = $2 AND evaluated_on IS NOT DISTINCT FROM $3::date AND source_key = 'manual' LIMIT 1`,
      [slug, player.rows[0].id, input.evaluatedOn || null]
    );
    if (assessment.rowCount) {
      await client.query('DELETE FROM sc_physical_test_results WHERE assessment_id = $1', [assessment.rows[0].id]);
    } else {
      assessment = await client.query(
        `INSERT INTO sc_physical_assessments (club_slug, player_id, evaluated_on, source_key)
         VALUES ($1, $2, $3::date, 'manual') RETURNING id`,
        [slug, player.rows[0].id, input.evaluatedOn || null]
      );
    }
    for (const result of input.results) {
      if (!['broadJump', 'cmj', 'agility', 'sprint', 'yoyo', 'bench', 'deadlift', 'squat', 'platform'].includes(result.testKey) ||
          !Number.isFinite(Number(result.value)) || !Number.isInteger(Number(result.attempt)) || Number(result.attempt) < 1 || Number(result.attempt) > 3) continue;
      await client.query(
        `INSERT INTO sc_physical_test_results (assessment_id, test_key, attempt, value, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [assessment.rows[0].id, result.testKey, result.attempt, result.value, result.unit || '']
      );
    }
    await client.query('COMMIT');
    return { playerId: player.rows[0].id, assessmentId: assessment.rows[0].id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { getClubData, getMatchPreparations, saveMatchPreparation, savePlayer, updatePlayer, saveCallup, saveEvent, replaceMatchEvents, deleteEvent, savePhysicalAssessment };
