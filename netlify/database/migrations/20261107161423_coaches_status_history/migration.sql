CREATE TABLE "schedule_changes" (
	"id" serial PRIMARY KEY,
	"at" text NOT NULL,
	"admin_user_id" integer,
	"admin_name" text NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"team_id" integer,
	"slot_id" integer,
	"date" text
);
--> statement-breakpoint
ALTER TABLE "team_coaches" ADD COLUMN "staff_id" integer;--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "status_note" text;--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "substitute_staff_id" integer;--> statement-breakpoint
CREATE INDEX "schedule_changes_at_idx" ON "schedule_changes" ("at");--> statement-breakpoint
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_substitute_staff_id_staff_id_fkey" FOREIGN KEY ("substitute_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL;