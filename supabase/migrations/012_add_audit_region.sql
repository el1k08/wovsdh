-- Add region (state/province/oblast) to the admin login audit log.
ALTER TABLE admin_login_audit ADD COLUMN IF NOT EXISTS region TEXT;
