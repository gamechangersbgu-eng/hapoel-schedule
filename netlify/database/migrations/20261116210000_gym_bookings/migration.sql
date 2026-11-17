-- Internal gym schedule (admin + TV only). One team at a time: the database refuses overlaps.
-- Additive only. btree_gist lets the exclusion constraint compare the text date with =.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_bookings" (
  "id" serial PRIMARY KEY,
  "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "date" text NOT NULL,
  "start_min" integer NOT NULL,
  "end_min" integer NOT NULL,
  "note" text,
  "series_id" text,
  "created_by" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  CONSTRAINT "gym_bookings_time_check" CHECK ("start_min" >= 0 AND "end_min" > "start_min" AND "end_min" <= 1440),
  CONSTRAINT "gym_bookings_no_overlap" EXCLUDE USING gist ("date" WITH =, int4range("start_min", "end_min") WITH &&)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_bookings_date_idx" ON "gym_bookings" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_bookings_series_idx" ON "gym_bookings" ("series_id");
