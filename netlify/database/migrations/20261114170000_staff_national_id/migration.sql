-- Israeli ID (ת"ז) on coaches, like the medic and driver banks. Admin only: not part of the
-- public snapshot or the coach data sent to the pitch board. Safe to run again.
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "national_id" text;
