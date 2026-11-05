CREATE TABLE "cities" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"travel_minutes_from_beer_sheva" integer NOT NULL,
	"north_of_hadera_line" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_events" (
	"id" serial PRIMARY KEY,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"pitch_id" integer,
	"medic_id" integer,
	"driver_id" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "football_school_schedule_rules" (
	"id" serial PRIMARY KEY,
	"rule_key" text NOT NULL UNIQUE,
	"weekdays" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"allowed_subdivisions" text NOT NULL,
	"biweekly" boolean DEFAULT false NOT NULL,
	"note_he" text
);
--> statement-breakpoint
CREATE TABLE "medics" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitch_reserved_locks" (
	"id" serial PRIMARY KEY,
	"pitch_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "pitch_subdivisions" (
	"code" text PRIMARY KEY,
	"label_he" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitch_weekly_status" (
	"id" serial PRIMARY KEY,
	"pitch_id" integer NOT NULL,
	"week_start_date" text NOT NULL,
	"status" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "pitches" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"name_he" text NOT NULL,
	"color_key" text NOT NULL,
	"surface_type" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_name_locked" boolean DEFAULT false NOT NULL,
	"is_reserved_lock" boolean DEFAULT false NOT NULL,
	"allows_home_games" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotation_template_times" (
	"id" serial PRIMARY KEY,
	"rotation_template_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"start_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotation_templates" (
	"id" serial PRIMARY KEY,
	"rotation_number" integer NOT NULL,
	"weekday" integer,
	"label_he" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduling_rules" (
	"rule_key" text PRIMARY KEY,
	"value_minutes" integer,
	"value_text" text,
	"label_he" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_game_details" (
	"slot_id" integer PRIMARY KEY,
	"game_kind" text NOT NULL,
	"opponent" text,
	"pitch_id" integer,
	"medic_id" integer,
	"driver_id" integer,
	"city_id" integer,
	"kickoff_time" text,
	"departure_time" text,
	"travel_minutes" integer,
	"coordination_note" text
);
--> statement-breakpoint
CREATE TABLE "slot_training_details" (
	"slot_id" integer PRIMARY KEY,
	"pitch_id" integer,
	"subdivision_code" text,
	"duration_minutes" integer,
	"rotation_template_id" integer
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY,
	"display_name" text NOT NULL,
	"role_label" text,
	"phone" text,
	"email" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "staff_unavailability" (
	"id" serial PRIMARY KEY,
	"staff_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"unavailability_type" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "staff_work_days" (
	"id" serial PRIMARY KEY,
	"staff_id" integer NOT NULL,
	"weekday" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_age_band_subdivisions" (
	"age_band_code" text NOT NULL,
	"subdivision_code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_age_bands" (
	"code" text PRIMARY KEY,
	"label_he" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_coaches" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"coach_name" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_constraints" (
	"id" serial PRIMARY KEY,
	"team_id" integer NOT NULL,
	"constraint_type" text NOT NULL,
	"coach_names" text,
	"conflicting_coach_names" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "training_session_durations" (
	"minutes" integer PRIMARY KEY,
	"label_he" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "age_band_code" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "doc_list_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "is_calendar_name_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "external_events_date_idx" ON "external_events" ("date");--> statement-breakpoint
CREATE INDEX "pitch_reserved_locks_pitch_idx" ON "pitch_reserved_locks" ("pitch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pitch_weekly_status_pitch_week_idx" ON "pitch_weekly_status" ("pitch_id","week_start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_template_times_seq_idx" ON "rotation_template_times" ("rotation_template_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "rotation_templates_number_idx" ON "rotation_templates" ("rotation_number");--> statement-breakpoint
CREATE INDEX "staff_unavailability_staff_idx" ON "staff_unavailability" ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_work_days_staff_weekday_idx" ON "staff_work_days" ("staff_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "team_age_band_subdivisions_pk" ON "team_age_band_subdivisions" ("age_band_code","subdivision_code");--> statement-breakpoint
CREATE INDEX "team_coaches_team_idx" ON "team_coaches" ("team_id");--> statement-breakpoint
CREATE INDEX "team_constraints_team_idx" ON "team_constraints" ("team_id");--> statement-breakpoint
ALTER TABLE "external_events" ADD CONSTRAINT "external_events_pitch_id_pitches_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id");--> statement-breakpoint
ALTER TABLE "external_events" ADD CONSTRAINT "external_events_medic_id_medics_id_fkey" FOREIGN KEY ("medic_id") REFERENCES "medics"("id");--> statement-breakpoint
ALTER TABLE "external_events" ADD CONSTRAINT "external_events_driver_id_drivers_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");--> statement-breakpoint
ALTER TABLE "pitch_reserved_locks" ADD CONSTRAINT "pitch_reserved_locks_pitch_id_pitches_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pitch_weekly_status" ADD CONSTRAINT "pitch_weekly_status_pitch_id_pitches_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rotation_template_times" ADD CONSTRAINT "rotation_template_times_vYwjE5JgM7kd_fkey" FOREIGN KEY ("rotation_template_id") REFERENCES "rotation_templates"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD CONSTRAINT "slot_game_details_slot_id_slots_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD CONSTRAINT "slot_game_details_pitch_id_pitches_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id");--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD CONSTRAINT "slot_game_details_medic_id_medics_id_fkey" FOREIGN KEY ("medic_id") REFERENCES "medics"("id");--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD CONSTRAINT "slot_game_details_driver_id_drivers_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");--> statement-breakpoint
ALTER TABLE "slot_game_details" ADD CONSTRAINT "slot_game_details_city_id_cities_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id");--> statement-breakpoint
ALTER TABLE "slot_training_details" ADD CONSTRAINT "slot_training_details_slot_id_slots_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "slot_training_details" ADD CONSTRAINT "slot_training_details_pitch_id_pitches_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id");--> statement-breakpoint
ALTER TABLE "slot_training_details" ADD CONSTRAINT "slot_training_details_sTJjVJplrixo_fkey" FOREIGN KEY ("subdivision_code") REFERENCES "pitch_subdivisions"("code");--> statement-breakpoint
ALTER TABLE "slot_training_details" ADD CONSTRAINT "slot_training_details_L3QYmN4GYrCb_fkey" FOREIGN KEY ("duration_minutes") REFERENCES "training_session_durations"("minutes");--> statement-breakpoint
ALTER TABLE "slot_training_details" ADD CONSTRAINT "slot_training_details_1SgjeiRe14KD_fkey" FOREIGN KEY ("rotation_template_id") REFERENCES "rotation_templates"("id");--> statement-breakpoint
ALTER TABLE "staff_unavailability" ADD CONSTRAINT "staff_unavailability_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_work_days" ADD CONSTRAINT "staff_work_days_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_age_band_subdivisions" ADD CONSTRAINT "team_age_band_subdivisions_PYxMccZJ8PwP_fkey" FOREIGN KEY ("age_band_code") REFERENCES "team_age_bands"("code") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_age_band_subdivisions" ADD CONSTRAINT "team_age_band_subdivisions_9QQNom7q22mY_fkey" FOREIGN KEY ("subdivision_code") REFERENCES "pitch_subdivisions"("code") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_constraints" ADD CONSTRAINT "team_constraints_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_age_band_code_team_age_bands_code_fkey" FOREIGN KEY ("age_band_code") REFERENCES "team_age_bands"("code");