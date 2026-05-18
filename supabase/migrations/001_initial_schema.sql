-- =============================================================================
-- Migration: 001_initial_schema
-- Description: Initial schema for nail service booking system
-- Timezone: Asia/Jerusalem (all timestamps stored as UTC TIMESTAMPTZ)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Custom Enum Types
-- ---------------------------------------------------------------------------

CREATE TYPE slot_status AS ENUM ('available', 'booked', 'blocked');

CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

CREATE TYPE email_type AS ENUM ('confirmation', 'cancellation');

-- ---------------------------------------------------------------------------
-- 2. updated_at Trigger Function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. Table: studios
-- ---------------------------------------------------------------------------

CREATE TABLE studios (
  id                  TEXT        PRIMARY KEY,                  -- e.g. 'rishon', 'ashdod'
  name                TEXT        NOT NULL,
  city                TEXT        NOT NULL,
  google_calendar_id  TEXT,                                     -- nullable until GCal is configured
  timezone            TEXT        NOT NULL DEFAULT 'Asia/Jerusalem',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  studios                   IS 'Reference data for each physical studio location.';
COMMENT ON COLUMN studios.id               IS 'Human-readable slug used as FK target and in query params.';
COMMENT ON COLUMN studios.google_calendar_id IS 'Google Calendar resource ID linked to this studio; NULL until configured.';
COMMENT ON COLUMN studios.timezone         IS 'IANA timezone string; always Asia/Jerusalem for this deployment.';

-- ---------------------------------------------------------------------------
-- 4. Table: slots
-- ---------------------------------------------------------------------------

CREATE TABLE slots (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   TEXT          NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  start_at    TIMESTAMPTZ   NOT NULL,
  end_at      TIMESTAMPTZ   NOT NULL,
  status      slot_status   NOT NULL DEFAULT 'available',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_slots_end_after_start CHECK (end_at > start_at)
);

COMMENT ON TABLE  slots          IS 'Pre-generated bookable time windows per studio.';
COMMENT ON COLUMN slots.status   IS 'available: visible to clients. booked: has an active booking. blocked: admin-reserved.';
COMMENT ON COLUMN slots.start_at IS 'Slot start time stored as UTC TIMESTAMPTZ.';
COMMENT ON COLUMN slots.end_at   IS 'Slot end time stored as UTC TIMESTAMPTZ.';

-- Indexes for slots
CREATE INDEX idx_slots_studio_start_status
  ON slots (studio_id, start_at, status);
-- Rationale: primary query for GET /api/slots filters on all three columns.
-- The composite order matches the WHERE clause: studio_id = $1 AND start_at >= $2 AND start_at < $3 AND status = 'available'.

CREATE INDEX idx_slots_start_at
  ON slots (start_at);
-- Rationale: admin range scans and conflict detection across all studios.

-- ---------------------------------------------------------------------------
-- 5. Table: bookings
-- ---------------------------------------------------------------------------

CREATE TABLE bookings (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id                  UUID           NOT NULL REFERENCES slots(id),
  studio_id                TEXT           NOT NULL REFERENCES studios(id),
  client_first_name        TEXT           NOT NULL,
  client_last_name         TEXT           NOT NULL,
  client_phone             TEXT           NOT NULL,
  client_email             TEXT           NOT NULL,
  status                   booking_status NOT NULL DEFAULT 'PENDING',
  cancellation_token       UUID           NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- ^ Separate from booking id: rotating this token invalidates old cancellation links
  --   without changing the booking record itself.
  google_calendar_event_id TEXT,          -- populated after CONFIRMED
  telegram_message_id      BIGINT,        -- used to edit the staff Telegram notification
  confirmed_at             TIMESTAMPTZ,   -- set when status transitions to CONFIRMED
  cancelled_at             TIMESTAMPTZ,   -- set when status transitions to CANCELLED
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  bookings                       IS 'Client booking records. Cancelled bookings are retained (soft delete).';
COMMENT ON COLUMN bookings.cancellation_token    IS 'UUID embedded in the email cancellation URL. Independent of booking id.';
COMMENT ON COLUMN bookings.studio_id             IS 'Denormalized from slot for convenience; avoids JOIN on every read.';
COMMENT ON COLUMN bookings.telegram_message_id   IS 'Message ID of the staff Telegram notification; used to edit/delete the message.';

-- updated_at auto-maintenance trigger
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- Indexes for bookings
CREATE INDEX idx_bookings_slot_id
  ON bookings (slot_id);
-- Rationale: needed for lookups during confirm/cancel operations and for the partial unique index below.

CREATE INDEX idx_bookings_status
  ON bookings (status);
-- Rationale: filter active/pending bookings in admin views and Telegram webhook handlers.

CREATE INDEX idx_bookings_studio_created
  ON bookings (studio_id, created_at DESC);
-- Rationale: admin list view fetches recent bookings per studio.

-- Race condition prevention: partial unique index
-- Guarantees at most one non-cancelled booking per slot at the DB level.
-- Two concurrent inserts for the same slot_id will result in exactly one
-- unique_violation (PG error 23505); the loser receives a 409 from the API layer.
CREATE UNIQUE INDEX uq_bookings_slot_active
  ON bookings (slot_id)
  WHERE status != 'CANCELLED';

COMMENT ON INDEX uq_bookings_slot_active IS
  'Prevents double-booking: at most one PENDING or CONFIRMED booking per slot. '
  'CANCELLED rows are excluded so the slot can be re-booked after cancellation.';

-- ---------------------------------------------------------------------------
-- 6. Table: allowed_users
-- ---------------------------------------------------------------------------

CREATE TABLE allowed_users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT      NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  allowed_users                    IS 'Telegram chat_id whitelist for staff who can confirm/cancel bookings via bot.';
COMMENT ON COLUMN allowed_users.telegram_chat_id   IS 'Numeric Telegram user or group chat ID.';
COMMENT ON COLUMN allowed_users.is_active          IS 'Soft-disable: FALSE means the user is rejected even if present in the table.';

CREATE INDEX idx_allowed_users_chat_id
  ON allowed_users (telegram_chat_id);
-- Rationale: every incoming Telegram webhook must verify authorization; must be O(1).

-- ---------------------------------------------------------------------------
-- 7. Table: email_logs
-- ---------------------------------------------------------------------------

CREATE TABLE email_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID        NOT NULL REFERENCES bookings(id),
  email_type      email_type  NOT NULL,
  recipient_email TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error           TEXT        -- NULL on success; SMTP error string on failure
);

COMMENT ON TABLE  email_logs             IS 'Append-only audit log of all emails sent by the system.';
COMMENT ON COLUMN email_logs.error       IS 'NULL means successful delivery. Non-NULL contains the SMTP or transport error message.';
COMMENT ON COLUMN email_logs.recipient_email IS 'Snapshot of the address at send time; retained even if booking data changes.';

CREATE INDEX idx_email_logs_booking_id
  ON email_logs (booking_id);
-- Rationale: fetch full email history for a booking during admin debugging.

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE studios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs    ENABLE ROW LEVEL SECURITY;

-- studios: public read
CREATE POLICY studios_read_all
  ON studios
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- slots: anonymous users see only available slots
CREATE POLICY slots_read_available
  ON slots
  FOR SELECT
  TO anon
  USING (status = 'available');

CREATE POLICY slots_authenticated_read_all
  ON slots
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- slots: only service_role writes (INSERT/UPDATE/DELETE)
-- service_role bypasses RLS entirely, so no explicit write policy is needed.
-- The following comment documents the intent:
-- service_role has BYPASSRLS=true in Supabase; all mutations go through Next.js
-- API routes using the SUPABASE_SERVICE_ROLE_KEY.

-- bookings: no anon or authenticated access; service_role only
-- (No policies defined for anon/authenticated = implicit DENY)

-- allowed_users: service_role only (no policies for others = implicit DENY)

-- email_logs: service_role only (no policies for others = implicit DENY)

-- ---------------------------------------------------------------------------
-- 9. Seed Data: Studios
-- ---------------------------------------------------------------------------

INSERT INTO studios (id, name, city, google_calendar_id, timezone) VALUES
  (
    'rishon',
    'Студия маникюра Ришон-ле-Цион',
    'Ришон-ле-Цион',
    NULL, -- set via admin after GCal OAuth setup
    'Asia/Jerusalem'
  ),
  (
    'ashdod',
    'Студия маникюра Ашдод',
    'Ашдод',
    NULL, -- set via admin after GCal OAuth setup
    'Asia/Jerusalem'
  );

-- ---------------------------------------------------------------------------
-- End of migration 001_initial_schema
-- ---------------------------------------------------------------------------
