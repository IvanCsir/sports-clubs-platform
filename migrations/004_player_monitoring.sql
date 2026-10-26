CREATE TABLE IF NOT EXISTS sc_player_wellness (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES sc_players(id) ON DELETE CASCADE,
  team_category TEXT NOT NULL CHECK (team_category IN ('primera', 'intermedia', '5ta')),
  response_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep SMALLINT NOT NULL CHECK (sleep BETWEEN 1 AND 5),
  fatigue SMALLINT NOT NULL CHECK (fatigue BETWEEN 1 AND 5),
  muscle_soreness SMALLINT NOT NULL CHECK (muscle_soreness BETWEEN 1 AND 5),
  stress SMALLINT NOT NULL CHECK (stress BETWEEN 1 AND 5),
  mood SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, player_id, response_date)
);

CREATE TABLE IF NOT EXISTS sc_player_training_loads (
  id BIGSERIAL PRIMARY KEY,
  club_slug TEXT NOT NULL REFERENCES club_catalog(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES sc_players(id) ON DELETE CASCADE,
  team_category TEXT NOT NULL CHECK (team_category IN ('primera', 'intermedia', '5ta')),
  training_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 360),
  perceived_effort SMALLINT NOT NULL CHECK (perceived_effort BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_slug, player_id, training_date)
);

CREATE INDEX IF NOT EXISTS sc_player_wellness_club_date_idx
  ON sc_player_wellness (club_slug, response_date DESC, team_category);
CREATE INDEX IF NOT EXISTS sc_player_load_club_date_idx
  ON sc_player_training_loads (club_slug, training_date DESC, team_category);
