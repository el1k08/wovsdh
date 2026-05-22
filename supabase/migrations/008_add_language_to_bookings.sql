-- Add language preference to bookings so confirmation emails can be sent
-- in the client's language (uk | en | he). Defaults to 'uk' for all existing rows.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS language varchar(2) NOT NULL DEFAULT 'uk';
