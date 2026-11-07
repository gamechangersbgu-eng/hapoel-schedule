import { boolean, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

import { slots } from "./game";
import { pitchSubdivisions, pitches } from "./pitch";
import { teamAgeBands } from "./team";

export const trainingSessionDurations = pgTable("training_session_durations", {
  minutes: integer().primaryKey(),
  labelHe: text("label_he").notNull(),
});

export const rotationTemplates = pgTable(
  "rotation_templates",
  {
    id: serial().primaryKey(),
    rotationNumber: integer("rotation_number").notNull(),
    weekday: integer(),
    labelHe: text("label_he").notNull(),
  },
  (table) => [uniqueIndex("rotation_templates_number_idx").on(table.rotationNumber)],
);

export const rotationTemplateTimes = pgTable(
  "rotation_template_times",
  {
    id: serial().primaryKey(),
    rotationTemplateId: integer("rotation_template_id")
      .notNull()
      .references(() => rotationTemplates.id, { onDelete: "cascade" }),
    sequence: integer().notNull(),
    startTime: text("start_time").notNull(),
  },
  (table) => [
    uniqueIndex("rotation_template_times_seq_idx").on(
      table.rotationTemplateId,
      table.sequence,
    ),
  ],
);

/** Practice allocation: which pitch subdivisions each age band may use (`pitch.pitchSubdivisions`). */
export const teamAgeBandSubdivisions = pgTable(
  "team_age_band_subdivisions",
  {
    ageBandCode: text("age_band_code")
      .notNull()
      .references(() => teamAgeBands.code, { onDelete: "cascade" }),
    subdivisionCode: text("subdivision_code")
      .notNull()
      .references(() => pitchSubdivisions.code, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("team_age_band_subdivisions_pk").on(
      table.ageBandCode,
      table.subdivisionCode,
    ),
  ],
);

/** Football-school program windows (team band `football_school`). */
export const footballSchoolScheduleRules = pgTable("football_school_schedule_rules", {
  id: serial().primaryKey(),
  ruleKey: text("rule_key").notNull().unique(),
  weekdays: text().notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  allowedSubdivisions: text("allowed_subdivisions").notNull(),
  biweekly: boolean().notNull().default(false),
  noteHe: text("note_he"),
});

/** 1:1 extension for training slots on `game.slots`. */
export const slotTrainingDetails = pgTable(
  "slot_training_details",
  {
    slotId: integer("slot_id")
      .primaryKey()
      .references(() => slots.id, { onDelete: "cascade" }),
    pitchId: integer("pitch_id").references(() => pitches.id),
    subdivisionCode: text("subdivision_code").references(() => pitchSubdivisions.code),
    durationMinutes: integer("duration_minutes").references(
      () => trainingSessionDurations.minutes,
    ),
    rotationTemplateId: integer("rotation_template_id").references(
      () => rotationTemplates.id,
    ),
  },
);
