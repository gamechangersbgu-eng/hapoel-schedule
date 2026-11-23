-- Fitness-coach flag, room booking requests, and the 75-minute training length.
-- Additive only. Does not change existing migrations or existing rows' roles.
-- is_fitness_coach: מאמן כושר. Default false. Assigned on /admin/users.
-- room_booking_requests: a pending request is not a schedule row. Approval inserts
-- into gym_bookings / video_room_bookings, which keep the one-team exclusion constraint.
-- 75 minutes (שעה ורבע) is a club-wide training length, same as 60 / 90 / 105 / 120.

ALTER TABLE "admin_users" ADD COLUMN IF NOT EXISTS "is_fitness_coach" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "room_booking_requests" (
  "id" serial PRIMARY KEY,
  "room" text NOT NULL,
  "requester_id" integer NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "start_time" text NOT NULL,
  "duration_minutes" integer NOT NULL,
  "dates" text NOT NULL,
  "recurrence" text,
  "note" text,
  "status" text NOT NULL DEFAULT 'pending',
  "decided_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "decided_at" text,
  "reason" text,
  "created_at" text NOT NULL,
  CONSTRAINT "room_booking_requests_room_check" CHECK ("room" IN ('gym', 'video')),
  CONSTRAINT "room_booking_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "room_booking_requests_duration_check" CHECK ("duration_minutes" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_booking_requests_status_idx" ON "room_booking_requests" ("room", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_booking_requests_requester_idx" ON "room_booking_requests" ("requester_id");
--> statement-breakpoint
INSERT INTO "training_session_durations" ("minutes", "label_he")
VALUES (75, 'שעה ורבע')
ON CONFLICT ("minutes") DO UPDATE SET "label_he" = EXCLUDED."label_he";
