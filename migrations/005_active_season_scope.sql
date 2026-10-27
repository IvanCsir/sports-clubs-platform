ALTER TABLE sc_physical_assessments
  ADD COLUMN IF NOT EXISTS season_id BIGINT REFERENCES sc_seasons(id) ON DELETE SET NULL;

ALTER TABLE sc_player_wellness
  ADD COLUMN IF NOT EXISTS season_id BIGINT REFERENCES sc_seasons(id) ON DELETE SET NULL;

ALTER TABLE sc_player_training_loads
  ADD COLUMN IF NOT EXISTS season_id BIGINT REFERENCES sc_seasons(id) ON DELETE SET NULL;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
  WHERE conrelid = 'sc_matches'::regclass AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%(club_slug, team_id, provider, provider_match_id)%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sc_matches DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sc_matches_season_identity_idx
  ON sc_matches (club_slug, team_id, provider, provider_match_id, season_id) NULLS NOT DISTINCT;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
  WHERE conrelid = 'sc_physical_assessments'::regclass AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%(club_slug, player_id, evaluated_on, source_key)%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE sc_physical_assessments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sc_assessments_season_identity_idx
  ON sc_physical_assessments (club_slug, player_id, evaluated_on, source_key, season_id) NULLS NOT DISTINCT;

ALTER TABLE sc_player_wellness
  DROP CONSTRAINT IF EXISTS sc_player_wellness_club_slug_player_id_response_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS sc_player_wellness_season_identity_idx
  ON sc_player_wellness (club_slug, player_id, response_date, season_id) NULLS NOT DISTINCT;

ALTER TABLE sc_player_training_loads
  DROP CONSTRAINT IF EXISTS sc_player_training_loads_club_slug_player_id_training_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS sc_player_training_loads_season_identity_idx
  ON sc_player_training_loads (club_slug, player_id, training_date, season_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS sc_matches_season_date_idx ON sc_matches (club_slug, season_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS sc_assessments_season_player_idx ON sc_physical_assessments (club_slug, season_id, player_id, evaluated_on DESC);
CREATE INDEX IF NOT EXISTS sc_wellness_season_date_idx ON sc_player_wellness (club_slug, season_id, response_date DESC);
CREATE INDEX IF NOT EXISTS sc_loads_season_date_idx ON sc_player_training_loads (club_slug, season_id, training_date DESC);
