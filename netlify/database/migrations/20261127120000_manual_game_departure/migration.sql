-- Away games may store a manual departure time that overrides the suggested one.
-- Existing rows stay null and keep showing departure_time. Nothing is deleted or re-seeded.

ALTER TABLE "slot_game_details"
  ADD COLUMN IF NOT EXISTS "manual_departure_time" text;
