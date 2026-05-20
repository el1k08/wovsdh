-- Migration: 004_add_studio_sort_order
-- Description: Add sort_order for controllable display ordering of studios

ALTER TABLE studios ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

UPDATE studios s
SET sort_order = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1) AS rn
  FROM studios
) sub
WHERE s.id = sub.id;
