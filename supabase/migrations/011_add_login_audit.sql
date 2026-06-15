-- Admin authentication audit log.
-- event ∈ LOGIN_SUCCESS | LOGIN_FAILED | OTP_SENT |
--         TWO_FACTOR_SUCCESS | TWO_FACTOR_FAILED | LOGOUT
CREATE TABLE IF NOT EXISTS admin_login_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event           TEXT NOT NULL,
  email           TEXT,
  user_id         TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  country         TEXT,
  city            TEXT,
  is_new_location BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_login_audit_created_at_idx ON admin_login_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_login_audit_event_idx ON admin_login_audit (event);
CREATE INDEX IF NOT EXISTS admin_login_audit_user_id_idx ON admin_login_audit (user_id);
