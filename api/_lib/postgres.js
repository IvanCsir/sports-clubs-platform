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
      // Vercel can keep several function instances warm at once; keep each
      // instance's client pool small when using Supabase's transaction pooler.
      max: process.env.VERCEL ? 1 : 5,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}

async function listClubs() {
  const result = await getPool().query('SELECT config FROM club_catalog ORDER BY created_at ASC');
  return result.rows.map(row => row.config);
}

async function listDeletedClubSlugs() {
  const result = await getPool().query('SELECT slug FROM deleted_club_slugs');
  return result.rows.map(row => row.slug);
}

async function insertClub(config) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO club_catalog (slug, config) VALUES ($1, $2::jsonb) RETURNING config`,
      [config.slug, JSON.stringify(config)]
    );
    await client.query('DELETE FROM deleted_club_slugs WHERE slug = $1', [config.slug]);
    await client.query('COMMIT');
    return result.rows[0].config;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateClub(slug, config) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO club_catalog (slug, config)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (slug) DO UPDATE
         SET config = EXCLUDED.config, updated_at = NOW()
       RETURNING config`,
      [slug, JSON.stringify(config)]
    );
    await client.query('DELETE FROM deleted_club_slugs WHERE slug = $1', [slug]);
    await client.query('COMMIT');
    return result.rows[0].config;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteClub(slug) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO deleted_club_slugs (slug) VALUES ($1)
       ON CONFLICT (slug) DO UPDATE SET deleted_at = NOW()`, [slug]
    );
    const result = await client.query('DELETE FROM club_catalog WHERE slug = $1 RETURNING slug', [slug]);
    await client.query('COMMIT');
    return { deleted: result.rowCount > 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { isConfigured, getPool, listClubs, listDeletedClubSlugs, insertClub, updateClub, deleteClub };
