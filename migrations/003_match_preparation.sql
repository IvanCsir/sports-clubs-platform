ALTER TABLE sc_matches
  ADD COLUMN IF NOT EXISTS preparation JSONB NOT NULL DEFAULT '{}'::jsonb;
