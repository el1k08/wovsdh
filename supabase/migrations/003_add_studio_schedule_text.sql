-- Migration: 003_add_studio_schedule_text_and_image
-- Description: Add schedule text description and photo URL to studios table

ALTER TABLE studios ADD COLUMN IF NOT EXISTS schedule_text TEXT NOT NULL DEFAULT '';
ALTER TABLE studios ADD COLUMN IF NOT EXISTS image_url TEXT;
