CREATE TABLE IF NOT EXISTS sc_physical_test_definitions (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  test_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'personalizada',
  unit TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'neutral' CHECK (direction IN ('higher', 'lower', 'neutral')),
  decimals SMALLINT NOT NULL DEFAULT 2 CHECK (decimals BETWEEN 0 AND 3),
  max_attempts SMALLINT NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, test_key)
);

CREATE INDEX IF NOT EXISTS sc_physical_test_definitions_club_active_idx
  ON sc_physical_test_definitions (club_slug, active, name);
