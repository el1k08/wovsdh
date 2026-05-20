-- =============================================================================
-- Migration: 001_initial_schema
-- Description: Unified initial schema for nail service booking system
--              with Atomic 15-Minute Slot System and Race Condition Protection.
-- Timezone: Asia/Jerusalem (all timestamps stored as UTC TIMESTAMPTZ)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Custom Enum Types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE slot_status AS ENUM ('available', 'booked', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE email_type AS ENUM ('confirmation', 'cancellation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Common Functions & Triggers
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
CREATE TABLE IF NOT EXISTS studios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  google_calendar_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_updated_at_studios
  BEFORE UPDATE ON studios
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Table: services
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id TEXT REFERENCES studios(id) ON DELETE CASCADE,
  icon TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes % 15 = 0 AND duration_minutes >= 15),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_updated_at_services
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Table: studio_schedule_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT true,
  work_start TIME NOT NULL,
  work_end TIME NOT NULL,
  UNIQUE (studio_id, day_of_week),
  CONSTRAINT chk_work_times CHECK (work_end > work_start)
);

-- ---------------------------------------------------------------------------
-- 6. Table: slots (Atomic 15-Minute Blocks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id TEXT NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  status slot_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (studio_id, start_at)
);

CREATE INDEX IF NOT EXISTS idx_slots_studio_start_status ON slots (studio_id, start_at, status);
CREATE INDEX IF NOT EXISTS idx_slots_start_at ON slots (start_at);

-- ---------------------------------------------------------------------------
-- 7. Table: bookings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id TEXT NOT NULL REFERENCES studios(id),
  service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
  service_snapshot JSONB NOT NULL DEFAULT '{}',
  client_first_name TEXT NOT NULL,
  client_last_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT NOT NULL,
  comment TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  status booking_status NOT NULL DEFAULT 'PENDING',
  cancellation_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  google_calendar_event_id TEXT,
  telegram_message_id BIGINT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_studio_created ON bookings (studio_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. Table: booking_slots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_slots (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  PRIMARY KEY (booking_id, slot_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slots_slot ON booking_slots (slot_id);

-- ---------------------------------------------------------------------------
-- 9. Table: allowed_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allowed_users_chat_id ON allowed_users (telegram_chat_id);

-- ---------------------------------------------------------------------------
-- 10. Table: email_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  email_type email_type NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_logs_booking_id ON email_logs (booking_id);

-- ---------------------------------------------------------------------------
-- 11. Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY studios_read_all ON studios FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY slots_read_available ON slots FOR SELECT TO anon USING (status = 'available');
CREATE POLICY slots_authenticated_read_all ON slots FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY sst_read_all ON studio_schedule_templates FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY services_read_active ON services FOR SELECT TO anon USING (is_active = true);
CREATE POLICY services_read_all ON services FOR SELECT TO authenticated USING (TRUE);

-- ---------------------------------------------------------------------------
-- 12. Business Logic Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_available_start_times(
  p_studio_id        TEXT,
  p_date             DATE,
  p_duration_minutes INT
)
RETURNS TABLE (start_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_slots_needed INT := p_duration_minutes / 15;
BEGIN
  RETURN QUERY
  WITH available_slots AS (
    SELECT
      s.start_at,
      s.start_at - (ROW_NUMBER() OVER (ORDER BY s.start_at) * INTERVAL '15 minutes') AS grp
    FROM slots s
    WHERE s.studio_id = p_studio_id
      AND s.start_at >= (p_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Jerusalem')
      AND s.start_at <  (p_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Jerusalem') + INTERVAL '1 day'
      AND s.status = 'available'
  ),
  contiguous_groups AS (
    SELECT
      id_s.start_at,
      COUNT(*) OVER (PARTITION BY grp) AS group_size,
      ROW_NUMBER() OVER (PARTITION BY grp ORDER BY id_s.start_at) AS pos_in_group
    FROM available_slots id_s
  )
  SELECT cg.start_at
  FROM contiguous_groups cg
  WHERE cg.group_size >= v_slots_needed
    AND cg.pos_in_group <= cg.group_size - v_slots_needed + 1
  ORDER BY cg.start_at;
END;
$$;

CREATE OR REPLACE FUNCTION lock_booking_slots(
  p_booking_id       UUID,
  p_studio_id        TEXT,
  p_start_at         TIMESTAMPTZ,
  p_duration_minutes INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slots_needed INT := p_duration_minutes / 15;
  v_locked_count INT;
BEGIN
  WITH target_slots AS (
    SELECT id
    FROM slots
    WHERE studio_id = p_studio_id
      AND start_at >= p_start_at
      AND start_at <  p_start_at + (v_slots_needed * INTERVAL '15 minutes')
      AND status = 'available'
    ORDER BY start_at
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE slots
    SET status = 'booked'
    WHERE id IN (SELECT id FROM target_slots)
    RETURNING id
  ),
  inserted AS (
    INSERT INTO booking_slots (booking_id, slot_id)
    SELECT p_booking_id, id FROM updated
    RETURNING slot_id
  )
  SELECT COUNT(*) INTO v_locked_count FROM inserted;

  IF v_locked_count < v_slots_needed THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: only % of % required slots could be locked',
      v_locked_count, v_slots_needed
      USING ERRCODE = '23505';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION release_booking_slots(
  p_booking_id UUID,
  p_keep_slots INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_keep_slots = 0 THEN
    UPDATE slots
    SET status = 'available'
    WHERE id IN (SELECT slot_id FROM booking_slots WHERE booking_id = p_booking_id);

    DELETE FROM booking_slots WHERE booking_id = p_booking_id;
  ELSE
    WITH all_slots AS (
      SELECT bs.slot_id, s.start_at
      FROM booking_slots bs
      JOIN slots s ON s.id = bs.slot_id
      WHERE bs.booking_id = p_booking_id
      ORDER BY s.start_at
    ),
    slots_to_release AS (
      SELECT slot_id FROM all_slots OFFSET p_keep_slots
    )
    UPDATE slots
    SET status = 'available'
    WHERE id IN (SELECT slot_id FROM slots_to_release);

    DELETE FROM booking_slots
    WHERE booking_id = p_booking_id
      AND slot_id IN (
        SELECT bs.slot_id
        FROM booking_slots bs
        JOIN slots s ON s.id = bs.slot_id
        WHERE bs.booking_id = p_booking_id
        ORDER BY s.start_at
        OFFSET p_keep_slots
      );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Seed Data
-- ---------------------------------------------------------------------------
INSERT INTO studios (id, name, city, google_calendar_id, timezone) VALUES
  ('rishon', 'Студия маникюра Ришон-ле-Цион', 'Ришон-ле-Цион', NULL, 'Asia/Jerusalem'),
  ('ashdod', 'Студия маникюра Ашдод', 'Ашдод', NULL, 'Asia/Jerusalem')
ON CONFLICT (id) DO NOTHING;

INSERT INTO studio_schedule_templates (studio_id, day_of_week, is_working, work_start, work_end) VALUES
  ('rishon', 0, true,  '09:00', '20:00'),
  ('rishon', 1, true,  '09:00', '20:00'),
  ('rishon', 2, true,  '09:00', '20:00'),
  ('rishon', 3, true,  '09:00', '20:00'),
  ('rishon', 4, true,  '09:00', '20:00'),
  ('rishon', 5, true,  '09:00', '14:00'),
  ('rishon', 6, false, '09:00', '20:00'),
  ('ashdod', 0, true,  '09:00', '20:00'),
  ('ashdod', 1, true,  '09:00', '20:00'),
  ('ashdod', 2, true,  '09:00', '20:00'),
  ('ashdod', 3, true,  '09:00', '20:00'),
  ('ashdod', 4, true,  '09:00', '20:00'),
  ('ashdod', 5, true,  '09:00', '14:00'),
  ('ashdod', 6, false, '09:00', '20:00')
ON CONFLICT (studio_id, day_of_week) DO NOTHING;

INSERT INTO services (icon, name, description, price, duration_minutes, sort_order) VALUES
  ('💅', 'Маникюр',            'Классический маникюр с покрытием гель-лаком', 120.00,  60,  1),
  ('🦶', 'Педикюр',            'Классический педикюр с покрытием гель-лаком', 150.00,  90,  2),
  ('✨', 'Маникюр + Педикюр', 'Комплексный уход — руки и ноги',               250.00, 150,  3),
  ('💎', 'Наращивание',        'Наращивание гелевых ногтей',                   200.00, 120,  4)
ON CONFLICT DO NOTHING;