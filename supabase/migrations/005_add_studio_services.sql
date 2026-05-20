-- =============================================================================
-- Migration: 005_add_studio_services
-- Description: Add studio_services junction table for many-to-many relationship
--              between studios and services. Seeds existing studio_id assignments.
-- =============================================================================

CREATE TABLE IF NOT EXISTS studio_services (
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (studio_id, service_id)
);

-- RLS: allow service_role full access (same pattern as other tables)
ALTER TABLE studio_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on studio_services"
  ON studio_services FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed: preserve existing studio_id assignments from services table
INSERT INTO studio_services (studio_id, service_id)
SELECT studio_id, id FROM services WHERE studio_id IS NOT NULL
ON CONFLICT DO NOTHING;
