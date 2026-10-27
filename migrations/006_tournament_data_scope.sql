ALTER TABLE sc_matches
  ADD COLUMN IF NOT EXISTS tournament_key TEXT;

DROP INDEX IF EXISTS sc_matches_season_identity_idx;
CREATE UNIQUE INDEX IF NOT EXISTS sc_matches_tournament_identity_idx
  ON sc_matches (club_slug, team_id, provider, provider_match_id, season_id, tournament_key) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS sc_matches_tournament_date_idx
  ON sc_matches (club_slug, season_id, tournament_key, starts_at DESC);
