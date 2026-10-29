-- Keep a lightweight tombstone so clubs defined by deployment configuration
-- do not reappear after their catalog row and related data are deleted.
CREATE TABLE IF NOT EXISTS deleted_club_slugs (
  slug TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
