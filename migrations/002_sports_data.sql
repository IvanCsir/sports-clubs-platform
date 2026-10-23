CREATE TABLE IF NOT EXISTS sc_teams (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, category)
);

CREATE TABLE IF NOT EXISTS sc_players (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  source_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, display_name)
);

CREATE TABLE IF NOT EXISTS sc_team_players (
  team_id BIGINT NOT NULL REFERENCES sc_teams(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES sc_players(id) ON DELETE CASCADE,
  joined_at DATE,
  left_at DATE,
  PRIMARY KEY (team_id, player_id)
);

CREATE TABLE IF NOT EXISTS sc_seasons (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, name)
);

CREATE TABLE IF NOT EXISTS sc_matches (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  team_id BIGINT REFERENCES sc_teams(id) ON DELETE SET NULL,
  season_id BIGINT REFERENCES sc_seasons(id) ON DELETE SET NULL,
  provider TEXT,
  provider_match_id TEXT,
  round_label TEXT NOT NULL DEFAULT 'Amistoso',
  opponent TEXT NOT NULL DEFAULT 'Rival',
  home_away TEXT NOT NULL DEFAULT 'Local' CHECK (home_away IN ('Local', 'Visitante')),
  starts_at TIMESTAMPTZ,
  date_label TEXT,
  call_time TEXT,
  match_time TEXT,
  venue TEXT,
  opponent_logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'played', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (club_slug, team_id, provider, provider_match_id)
);

CREATE TABLE IF NOT EXISTS sc_callups (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES sc_matches(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES sc_teams(id) ON DELETE CASCADE,
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, team_id)
);

CREATE TABLE IF NOT EXISTS sc_callup_players (
  callup_id BIGINT NOT NULL REFERENCES sc_callups(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES sc_players(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (callup_id, player_id),
  UNIQUE (callup_id, position)
);

CREATE TABLE IF NOT EXISTS sc_physical_assessments (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES sc_players(id) ON DELETE CASCADE,
  evaluated_on DATE,
  source_key TEXT,
  source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, player_id, evaluated_on, source_key)
);

CREATE TABLE IF NOT EXISTS sc_physical_test_results (
  assessment_id BIGINT NOT NULL REFERENCES sc_physical_assessments(id) ON DELETE CASCADE,
  test_key TEXT NOT NULL,
  attempt SMALLINT NOT NULL CHECK (attempt BETWEEN 1 AND 10),
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (assessment_id, test_key, attempt)
);

CREATE TABLE IF NOT EXISTS sc_match_events (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  match_id BIGINT REFERENCES sc_matches(id) ON DELETE SET NULL,
  external_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quarter SMALLINT NOT NULL DEFAULT 1 CHECK (quarter BETWEEN 1 AND 10),
  team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away', 'both')),
  event_type TEXT NOT NULL,
  player_name TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, external_id)
);

CREATE INDEX IF NOT EXISTS sc_players_club_idx ON sc_players (club_slug, active, display_name);
CREATE INDEX IF NOT EXISTS sc_matches_club_date_idx ON sc_matches (club_slug, starts_at DESC);
CREATE INDEX IF NOT EXISTS sc_events_club_match_time_idx ON sc_match_events (club_slug, match_id, occurred_at);
CREATE INDEX IF NOT EXISTS sc_assessments_player_date_idx ON sc_physical_assessments (player_id, evaluated_on DESC);
