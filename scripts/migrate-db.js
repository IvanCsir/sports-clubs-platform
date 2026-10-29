const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

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

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error('Configurá DATABASE_URL antes de migrar.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client = await pool.connect();
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      const folder = path.resolve(__dirname, '..', 'migrations');
      const files = fs.readdirSync(folder).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
      for (const filename of files) {
        const exists = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
        if (exists.rowCount) continue;
        await client.query('BEGIN');
        try {
          await client.query(fs.readFileSync(path.join(folder, filename), 'utf8'));
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
          await client.query('COMMIT');
          process.stdout.write(`Aplicada ${filename}\n`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
      const { readConfiguredClubs } = require('../api/_lib/club-config');
      for (const club of readConfiguredClubs()) {
        club.auth = { ...(club.auth || {}) };
        if (!club.auth.secret) club.auth.secret = crypto.randomBytes(32).toString('base64url');
        delete club.auth.password;
        await client.query(
          `INSERT INTO club_catalog (slug, config) VALUES ($1, $2::jsonb)
           ON CONFLICT (slug) DO UPDATE SET config = CASE
             WHEN COALESCE(club_catalog.config->'auth'->>'secret', '') = ''
             THEN jsonb_set(club_catalog.config, '{auth}',
               COALESCE(club_catalog.config->'auth', '{}'::jsonb) || jsonb_build_object('secret', $3::text), true)
             ELSE club_catalog.config
           END`,
          [club.slug, JSON.stringify(club), club.auth.secret]
        );
      }
      process.stdout.write('Catálogo de clubes preparado.\n');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function formatError(error) {
  if (!error) return 'Error desconocido.';
  const summary = [error.name, error.message, error.code].filter(Boolean).join(': ');
  const nested = Array.isArray(error.errors) ? error.errors.map(formatError).join('\n') : '';
  return [summary || 'Error sin detalles.', nested].filter(Boolean).join('\n');
}

main().catch(error => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
