-- Parent/player web push for the public "הקבוצות שלי" bells.
-- Coach WhatsApp/SMS is a separate track and does not use this table.
-- Additive only: creates push_subscriptions. Does not read or change schedule rows.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" serial PRIMARY KEY,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "team_ids" integer[] NOT NULL DEFAULT '{}',
  "schedule_path" text NOT NULL DEFAULT '/',
  "user_agent" text,
  "updated_at" text NOT NULL,
  CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
);
