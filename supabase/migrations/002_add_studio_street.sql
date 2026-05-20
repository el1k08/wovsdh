-- Migration: 002_add_studio_street
-- Description: Add street address field to studios table

ALTER TABLE studios ADD COLUMN IF NOT EXISTS street TEXT NOT NULL DEFAULT '';
