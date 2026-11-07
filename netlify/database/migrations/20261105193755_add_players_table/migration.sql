CREATE TABLE "players" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"display_name" text NOT NULL,
	"birth_date" text,
	"parent_phone" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "players_team_idx" ON "players" ("team_id");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;