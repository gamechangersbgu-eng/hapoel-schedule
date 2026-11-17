-- Temporary manual pitch for home games the association gave no venue for
-- (services/notifications/MAINTENANCE.md). Removed automatically once the association,
-- or an admin on the games screen, gives the place. Additive only.

CREATE TABLE IF NOT EXISTS "maintenance_pitch_overrides" (
  "slot_id" integer PRIMARY KEY REFERENCES "slots"("id") ON DELETE CASCADE,
  "pitch_code" text NOT NULL,
  "set_by" text,
  "set_at" text NOT NULL
);
