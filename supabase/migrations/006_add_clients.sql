-- =============================================================================
-- Migration: 006_add_clients
-- Description: Adds the clients table for storing client profiles identified
--              by a unique normalized phone number (+972 format).
--              Also adds an optional client_id FK on bookings so historical
--              bookings can be linked to a client record post-creation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: clients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  email       TEXT,
  city        TEXT        NOT NULL,
  consent     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_clients_phone UNIQUE (phone)
);

CREATE OR REPLACE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);

-- ---------------------------------------------------------------------------
-- 2. Link bookings → clients (optional, nullable FK)
-- ---------------------------------------------------------------------------
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings (client_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Service-role (admin) has full access; anon has no direct access.
-- All client operations go through Next.js API routes using the service key.
CREATE POLICY clients_service_role_all ON clients
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
