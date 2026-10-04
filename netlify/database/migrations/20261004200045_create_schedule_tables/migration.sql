CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"club_name" text NOT NULL,
	"season_start_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"date" text NOT NULL,
	"end_date" text,
	"start_time" text,
	"type" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_comments" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "slots_date_idx" ON "slots" ("date");--> statement-breakpoint
CREATE INDEX "slots_team_id_date_idx" ON "slots" ("team_id","date");--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;