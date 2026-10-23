const { Pool } = require('pg');

let pool;

function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isConfigured()) throw new Error('DATABASE_URL no está configurada.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

async function listClubs() {
  const result = await getPool().query('SELECT config FROM club_catalog ORDER BY created_at ASC');
  return result.rows.map(row => row.config);
}

async function insertClub(config) {
  const result = await getPool().query(
    `INSERT INTO club_catalog (slug, config) VALUES ($1, $2::jsonb) RETURNING config`,
    [config.slug, JSON.stringify(config)]
  );
  return result.rows[0].config;
}

async function updateClub(slug, config) {
  const result = await getPool().query(
    `INSERT INTO club_catalog (slug, config)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (slug) DO UPDATE
       SET config = EXCLUDED.config, updated_at = NOW()
     RETURNING config`,
    [slug, JSON.stringify(config)]
  );
  return result.rows[0].config;
}

module.exports = { isConfigured, listClubs, insertClub, updateClub };
