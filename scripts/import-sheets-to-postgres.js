const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const TESTS = [
  ['broadJump', 'm'], ['cmj', 'cm'], ['agility', 'seg'], ['sprint', 'seg'], ['yoyo', 'm'],
  ['bench', 'kg'], ['deadlift', 'kg'], ['squat', 'kg'], ['platform', '']
];
const TEST_COLUMNS = [3, 6, 9, 12, 15, 18, 21, 24, 27];

function loadEnv() {
  const file = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0 && !process.env[line.slice(0, index).trim()]) {
      process.env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
}

function cell(row, index) {
  const item = row?.c?.[index];
  return String(item?.f ?? item?.v ?? '').trim();
}

async function fetchSheet(id, sheet) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  if (sheet) {
    url.searchParams.set('range', 'A:L');
    url.searchParams.set('sheet', sheet);
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Sheets respondió HTTP ${response.status}.`);
  const body = await response.text();
  const match = body.match(/setResponse\(([\s\S]+)\);/);
  if (!match) throw new Error('No se pudo interpretar una hoja de Google Sheets.');
  const parsed = JSON.parse(match[1]);
  if (parsed.status !== 'ok') throw new Error('Google Sheets rechazó la consulta.');
  return parsed.table;
}

function sheetMetadata(table) {
  const meta = {};
  for (const row of table?.rows || []) {
    const label = cell(row, 7).toLowerCase();
    const value = cell(row, 8);
    if (label && value) meta[label] = value;
  }
  return meta;
}

function parseNumber(value) {
  const parsed = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

async function importCitations(db, slug, club) {
  if (!club.spreadsheetId) return 0;
  const tabs = await Promise.all(['primera', 'intermedia'].map(sheet => fetchSheet(club.spreadsheetId, sheet)));
  const allMeta = tabs.map(sheetMetadata);
  let imported = 0;
  const shared = allMeta[0] || {};
  const other = allMeta[1] || {};
  const metadataValue = (...keys) => keys.map(key => shared[key] || other[key]).find(Boolean) || '';
  const roundLabel = metadataValue('fecha n°', 'fecha n', 'n° fecha', 'fecha') || 'Amistoso';
  const opponent = metadataValue('rival') || 'Rival';
  const dateLabel = metadataValue('dia', 'día');
  const venue = metadataValue('cancha');
  const opponentLogo = metadataValue('url escudo rival', 'escudo rival', 'url escudo', 'escudo');
  for (const [index, category] of ['primera', 'intermedia'].entries()) {
    const teamResult = await db.query(
      `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $3)
       ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [slug, category === 'primera' ? 'Primera' : 'Intermedia', category]
    );
    const teamId = teamResult.rows[0].id;
    const meta = allMeta[index] || {};
    const matchKey = `${roundLabel}-${category}`;
    const match = await db.query(
      `INSERT INTO sc_matches (club_slug, team_id, provider, provider_match_id, round_label, opponent,
                           date_label, venue, opponent_logo_url, call_time, match_time)
       VALUES ($1, $2, 'sheets-import', $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id) DO UPDATE SET
         round_label = EXCLUDED.round_label, opponent = EXCLUDED.opponent, date_label = EXCLUDED.date_label,
         venue = EXCLUDED.venue, opponent_logo_url = EXCLUDED.opponent_logo_url,
         call_time = EXCLUDED.call_time, match_time = EXCLUDED.match_time, updated_at = NOW()
       RETURNING id`,
      [slug, teamId, matchKey, roundLabel, opponent, dateLabel, venue, opponentLogo,
        meta['horario citacion'] || meta['horario citación'] || meta.citacion || meta['citación'] || '',
        meta['horario partido'] || meta.partido || '']
    );
    const callup = await db.query(
      `INSERT INTO sc_callups (match_id, team_id) VALUES ($1, $2)
       ON CONFLICT (match_id, team_id) DO UPDATE SET updated_at = NOW() RETURNING id`,
      [match.rows[0].id, teamId]
    );
    await db.query('DELETE FROM sc_callups WHERE team_id = $1 AND id <> $2', [teamId, callup.rows[0].id]);
    const names = [...new Set((tabs[index]?.rows || []).map(row => cell(row, 5))
      .filter(name => name && name.toLowerCase() !== 'jugadoras citadas'))];
    await db.query('DELETE FROM sc_callup_players WHERE callup_id = $1', [callup.rows[0].id]);
    for (const [position, name] of names.entries()) {
      const player = await db.query(
        `INSERT INTO sc_players (club_slug, display_name) VALUES ($1, $2)
         ON CONFLICT (club_slug, display_name) DO UPDATE SET active = TRUE, updated_at = NOW()
         RETURNING id`, [slug, name]
      );
      await db.query('INSERT INTO sc_team_players (team_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [teamId, player.rows[0].id]);
      await db.query('INSERT INTO sc_callup_players (callup_id, player_id, position) VALUES ($1, $2, $3)',
        [callup.rows[0].id, player.rows[0].id, position]);
      imported += 1;
    }
  }
  return imported;
}

async function importPhysicalData(db, slug, club) {
  if (!club.physicalSpreadsheetId) return 0;
  const table = await fetchSheet(club.physicalSpreadsheetId);
  let count = 0;
  for (const row of table?.rows || []) {
    const division = cell(row, 0) || 'PS';
    const branch = cell(row, 1) || 'B';
    const name = cell(row, 2);
    if (!name || /apellido/i.test(name) || name.length <= 1 || /promedio|categoria/i.test(division)) continue;
    const category = /5ta|quinta/i.test(division) ? '5ta' : /inter/i.test(branch) ? 'intermedia' : 'primera';
    const team = await db.query(
      `INSERT INTO sc_teams (club_slug, name, category) VALUES ($1, $2, $3)
       ON CONFLICT (club_slug, category) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [slug, division, category]
    );
    const player = await db.query(
      `INSERT INTO sc_players (club_slug, display_name) VALUES ($1, $2)
       ON CONFLICT (club_slug, display_name) DO UPDATE SET active = TRUE, updated_at = NOW()
       RETURNING id`, [slug, name]
    );
    await db.query('INSERT INTO sc_team_players (team_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [team.rows[0].id, player.rows[0].id]);
    let assessment = await db.query(
      `SELECT id FROM sc_physical_assessments WHERE club_slug = $1 AND player_id = $2 AND source_key = 'sheets-current' LIMIT 1`,
      [slug, player.rows[0].id]
    );
    if (!assessment.rowCount) {
      assessment = await db.query(
        `INSERT INTO sc_physical_assessments (club_slug, player_id, source_key, source_data)
         VALUES ($1, $2, 'sheets-current', $3::jsonb) RETURNING id`,
        [slug, player.rows[0].id, JSON.stringify({ division, branch })]
      );
    }
    await db.query('DELETE FROM sc_physical_test_results WHERE assessment_id = $1', [assessment.rows[0].id]);
    for (const [testIndex, [testKey, unit]] of TESTS.entries()) {
      const base = TEST_COLUMNS[testIndex];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const value = parseNumber(cell(row, base + attempt - 1));
        if (value !== null) {
          await db.query('INSERT INTO sc_physical_test_results (assessment_id, test_key, attempt, value, unit) VALUES ($1, $2, $3, $4, $5)',
            [assessment.rows[0].id, testKey, attempt, value, unit]);
        }
      }
    }
    count += 1;
  }
  return count;
}

async function importTrackerEvents(db, slug, club) {
  const webhookUrl = process.env.DT_IMPORT_WEBHOOK_URL;
  if (!webhookUrl) return 0;
  const response = await fetch(webhookUrl);
  if (!response.ok) throw new Error('No se pudo consultar el archivo histórico de la botonera DT.');
  const index = await response.json();
  let count = 0;
  for (const sheetName of index.sheets || []) {
    const url = new URL(webhookUrl);
    url.searchParams.set('sheet', sheetName);
    const sheetResponse = await fetch(url);
    if (!sheetResponse.ok) continue;
    const data = await sheetResponse.json();
    const parts = String(sheetName).split(' - ');
    const round = parts[0] || 'Fecha';
    const opponent = parts.slice(1).join(' - ') || 'Rival';
    const match = await db.query(
      `INSERT INTO sc_matches (club_slug, provider, provider_match_id, round_label, opponent)
       VALUES ($1, 'sheets-import', $2, $3, $4)
       ON CONFLICT (club_slug, team_id, provider, provider_match_id) DO UPDATE SET opponent = EXCLUDED.opponent RETURNING id`,
      [slug, `tracker-${sheetName}`, round, opponent]
    );
    for (const [eventIndex, event] of (data.events || []).entries()) {
      const externalId = `${sheetName}:${event.id || `row-${eventIndex + 1}`}`;
      await db.query(
        `INSERT INTO sc_match_events (club_slug, match_id, external_id, quarter, team_side, event_type, player_name, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (club_slug, external_id) DO NOTHING`,
        [slug, match.rows[0].id, externalId, Number(event.quarter) || 1,
          event.team === 'away' ? 'away' : 'home', event.type || 'entry', event.player || null, JSON.stringify(event)]
      );
      count += 1;
    }
  }
  return count;
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error('Configurá DATABASE_URL antes de importar.');
  const slugArg = process.argv.find(arg => arg.startsWith('--club='));
  if (!slugArg) throw new Error('Indicá el club con --club=slug.');
  const slug = slugArg.slice('--club='.length);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query('SELECT config FROM club_catalog WHERE slug = $1', [slug]);
    if (!result.rowCount) throw new Error(`No existe configuración en club_catalog para ${slug}.`);
    const club = result.rows[0].config;
    const citations = await importCitations(pool, slug, club);
    const players = await importPhysicalData(pool, slug, club);
    const events = await importTrackerEvents(pool, slug, club);
    process.stdout.write(`Importación terminada para ${slug}: ${citations} citaciones, ${players} fichas físicas y ${events} incidencias.\n`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
