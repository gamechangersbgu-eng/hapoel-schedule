-- Pitch mowing + marking tasks (services/notifications/MAINTENANCE.md).
-- Additive only: creates maintenance_tasks. Does not read or change schedule rows.

CREATE TABLE IF NOT EXISTS "maintenance_tasks" (
  "id" serial PRIMARY KEY,
  "pitch_id" integer NOT NULL REFERENCES "pitches"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "period_key" text NOT NULL,
  "date" text NOT NULL,
  "start_time" text,
  "end_time" text,
  "show_from" text NOT NULL,
  "slot_ids" integer[] NOT NULL DEFAULT '{}',
  "summary" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "done_by" text,
  "done_at" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_tasks_pitch_kind_period_idx"
  ON "maintenance_tasks" ("pitch_id", "kind", "period_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_tasks_date_idx" ON "maintenance_tasks" ("date");
