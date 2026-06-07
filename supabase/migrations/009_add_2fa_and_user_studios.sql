-- Add 2FA code columns to user table (Better Auth managed table)
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS two_factor_code TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_expires_at TIMESTAMPTZ;

-- Add role and telegram fields managed by Better Auth (idempotent)
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

-- Master-to-studio assignments
CREATE TABLE IF NOT EXISTS user_studios (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  studio_id TEXT NOT NULL,
  PRIMARY KEY (user_id, studio_id)
);
