ALTER TABLE sc_staff_users
  ADD COLUMN IF NOT EXISTS can_manage_access BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sc_staff_invites
  ADD COLUMN IF NOT EXISTS can_manage_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Keep current clubs manageable by assigning one active staff member if needed.
WITH first_active_staff AS (
  SELECT DISTINCT ON (club_slug) club_slug, id
  FROM sc_staff_users
  WHERE revoked_at IS NULL
  ORDER BY club_slug, created_at, id
)
UPDATE sc_staff_users AS staff
SET can_manage_access = TRUE
FROM first_active_staff AS first_staff
WHERE staff.id = first_staff.id
  AND NOT EXISTS (
    SELECT 1 FROM sc_staff_users AS manager
    WHERE manager.club_slug = staff.club_slug
      AND manager.revoked_at IS NULL
      AND manager.can_manage_access = TRUE
  );
