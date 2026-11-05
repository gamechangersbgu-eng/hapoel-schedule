CREATE TABLE "schedule_revision" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "slot_game_details_source_external_idx" ON "slot_game_details" ("source","external_id");--> statement-breakpoint
INSERT INTO "schedule_revision" ("id", "version", "updated_at") VALUES (1, 1, '1970-01-01T00:00:00.000Z');