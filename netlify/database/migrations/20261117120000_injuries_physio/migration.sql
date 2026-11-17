-- Injury tracking and a first physio schedule (Nov 2026). Idempotent: safe to run more than once.
-- 1. Each player gets a personal coach (players.coach_staff_id). Filled once from the team's
--    head coach; managers change it on /admin/players. The coach sees only the injury status.
-- 2. A login can belong to a staff person (admin_users.staff_id), for the new "coach" and
--    "physio" roles. Existing users are untouched (staff_id stays null).
-- 3. New tables: injuries, injury_status_changes, physio_sessions.

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "coach_staff_id" integer REFERENCES "staff"("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "players" AS p
SET "coach_staff_id" = (
  SELECT tc."staff_id"
  FROM "team_coaches" AS tc
  WHERE tc."team_id" = p."team_id" AND tc."staff_id" IS NOT NULL
  ORDER BY tc."is_primary" DESC, tc."id" ASC
  LIMIT 1
)
WHERE p."coach_staff_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "staff_id" integer REFERENCES "staff"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "injuries" (
  "id" serial PRIMARY KEY,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "injured_at" text NOT NULL,
  "body_part" text NOT NULL,
  "status" text NOT NULL DEFAULT 'injured',
  "expected_return" text,
  "note" text,
  "created_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "closed_at" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "injuries_player_idx" ON "injuries" ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "injuries_status_idx" ON "injuries" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "injury_status_changes" (
  "id" serial PRIMARY KEY,
  "injury_id" integer NOT NULL REFERENCES "injuries"("id") ON DELETE CASCADE,
  "from_status" text,
  "to_status" text NOT NULL,
  "at" text NOT NULL,
  "changed_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "changed_by_name" text NOT NULL,
  "note" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "injury_status_changes_injury_idx" ON "injury_status_changes" ("injury_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "physio_sessions" (
  "id" serial PRIMARY KEY,
  "injury_id" integer NOT NULL REFERENCES "injuries"("id") ON DELETE CASCADE,
  "physio_user_id" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "physio_name" text NOT NULL,
  "date" text NOT NULL,
  "start_time" text NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 30,
  "status" text NOT NULL DEFAULT 'scheduled',
  "note" text,
  "created_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "physio_sessions_date_idx" ON "physio_sessions" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "physio_sessions_injury_idx" ON "physio_sessions" ("injury_id");
