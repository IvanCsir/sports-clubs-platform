ALTER TABLE sc_matches
  ADD COLUMN IF NOT EXISTS tournament_name TEXT;

UPDATE sc_matches m
SET tournament_name = COALESCE(c.config #>> '{tournament,name}', m.tournament_key)
FROM club_catalog c
WHERE c.slug = m.club_slug
  AND m.tournament_name IS NULL
  AND m.tournament_key = c.config #>> '{tournament,tournamentId}';
