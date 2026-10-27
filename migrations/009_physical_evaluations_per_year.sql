DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sc_physical_test_definitions'
      AND column_name = 'max_attempts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'sc_physical_test_definitions'
      AND column_name = 'evaluations_per_year'
  ) THEN
    ALTER TABLE sc_physical_test_definitions RENAME COLUMN max_attempts TO evaluations_per_year;
  ELSE
    ALTER TABLE sc_physical_test_definitions
      ADD COLUMN IF NOT EXISTS evaluations_per_year SMALLINT NOT NULL DEFAULT 3;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sc_physical_test_definitions'
        AND column_name = 'max_attempts'
    ) THEN
      UPDATE sc_physical_test_definitions
      SET evaluations_per_year = max_attempts;
      ALTER TABLE sc_physical_test_definitions DROP COLUMN max_attempts;
    END IF;
  END IF;
END $$;

ALTER TABLE sc_physical_test_definitions
  DROP CONSTRAINT IF EXISTS sc_physical_test_definitions_evaluations_per_year_check;

ALTER TABLE sc_physical_test_definitions
  ADD CONSTRAINT sc_physical_test_definitions_evaluations_per_year_check
  CHECK (evaluations_per_year BETWEEN 1 AND 10);
