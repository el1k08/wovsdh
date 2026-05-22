-- Stage 3: Add translations JSONB columns to services and studios tables.
-- Backward compatible: existing name/description/schedule_text columns remain unchanged.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE studios
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed translations from existing English-based content (used as fallback for all locales).
UPDATE services
SET translations = jsonb_build_object(
  'uk', jsonb_build_object('name', name, 'description', COALESCE(description, '')),
  'en', jsonb_build_object('name', name, 'description', COALESCE(description, '')),
  'he', jsonb_build_object('name', name, 'description', COALESCE(description, ''))
)
WHERE translations = '{}'::jsonb;

UPDATE studios
SET translations = jsonb_build_object(
  'uk', jsonb_build_object('name', name, 'schedule_text', COALESCE(schedule_text, '')),
  'en', jsonb_build_object('name', name, 'schedule_text', COALESCE(schedule_text, '')),
  'he', jsonb_build_object('name', name, 'schedule_text', COALESCE(schedule_text, ''))
)
WHERE translations = '{}'::jsonb;
