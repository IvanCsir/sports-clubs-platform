-- Índices en las columnas que apuntan a otras tablas (foreign keys). Postgres no los crea
-- solo y, sin ellos, borrar una jugadora, un partido o una temporada recorre toda la tabla hija.
CREATE INDEX IF NOT EXISTS sc_team_players_player_idx ON sc_team_players (player_id);
CREATE INDEX IF NOT EXISTS sc_matches_season_idx ON sc_matches (season_id);
CREATE INDEX IF NOT EXISTS sc_matches_team_idx ON sc_matches (team_id);
CREATE INDEX IF NOT EXISTS sc_callups_team_idx ON sc_callups (team_id);
CREATE INDEX IF NOT EXISTS sc_callup_players_player_idx ON sc_callup_players (player_id);
CREATE INDEX IF NOT EXISTS sc_physical_assessments_season_idx ON sc_physical_assessments (season_id);
CREATE INDEX IF NOT EXISTS sc_match_events_match_idx ON sc_match_events (match_id);
CREATE INDEX IF NOT EXISTS sc_player_wellness_player_idx ON sc_player_wellness (player_id);
CREATE INDEX IF NOT EXISTS sc_player_wellness_season_idx ON sc_player_wellness (season_id);
CREATE INDEX IF NOT EXISTS sc_player_training_loads_player_idx ON sc_player_training_loads (player_id);
CREATE INDEX IF NOT EXISTS sc_player_training_loads_season_idx ON sc_player_training_loads (season_id);
