CREATE TABLE IF NOT EXISTS sc_staff_users (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  email TEXT NOT NULL,
  google_sub TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (club_slug, email),
  UNIQUE (club_slug, google_sub)
);

CREATE TABLE IF NOT EXISTS sc_staff_invites (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sc_staff_invites_email_idx
  ON sc_staff_invites (club_slug, email, expires_at DESC);

UPDATE club_catalog
SET config = jsonb_set(config, '{auth}', (config->'auth') - 'password', true)
WHERE config ? 'auth' AND (config->'auth') ? 'password';
