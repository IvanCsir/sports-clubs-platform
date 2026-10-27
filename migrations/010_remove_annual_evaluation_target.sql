ALTER TABLE sc_physical_test_definitions
  DROP COLUMN IF EXISTS evaluations_per_year,
  DROP COLUMN IF EXISTS max_attempts;
