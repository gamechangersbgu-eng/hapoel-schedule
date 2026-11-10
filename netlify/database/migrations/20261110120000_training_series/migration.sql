-- Recurring trainings: one series row, each occurrence is a slots row.
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS "training_series" (
  "id" serial PRIMARY KEY,
  "team_id" integer NOT NULL,
  "weekdays" text,
  "until_date" text,
  "created_at" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "training_series"
    ADD CONSTRAINT "training_series_team_id_teams_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN IF NOT EXISTS "series_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "slots"
    ADD CONSTRAINT "slots_series_id_training_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "training_series"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slots_series_id_idx" ON "slots" ("series_id");
