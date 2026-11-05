import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  clubName: text("club_name").notNull(),
  seasonStartDate: text("season_start_date").notNull(),
});

export const teamAgeBands = pgTable("team_age_bands", {
  code: text().primaryKey(),
  labelHe: text("label_he").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const teams = pgTable("teams", {
  id: serial().primaryKey(),
  name: text().notNull(),
  sortOrder: integer("sort_order").notNull(),
  isComments: boolean("is_comments").notNull().default(false),
  ageBandCode: text("age_band_code").references(() => teamAgeBands.code),
  docListName: text("doc_list_name"),
  isCalendarNameLocked: boolean("is_calendar_name_locked").notNull().default(false),
});

export const pitchSubdivisions = pgTable("pitch_subdivisions", {
  code: text().primaryKey(),
  labelHe: text("label_he").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const pitches = pgTable("pitches", {
  id: serial().primaryKey(),
  code: text().notNull().unique(),
  nameHe: text("name_he").notNull(),
  colorKey: text("color_key").notNull(),
  surfaceType: text("surface_type").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isNameLocked: boolean("is_name_locked").notNull().default(false),
  isReservedLock: boolean("is_reserved_lock").notNull().default(false),
  allowsHomeGames: boolean("allows_home_games").notNull().default(false),
});

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

export const staff = pgTable("staff", {
  id: serial().primaryKey(),
  displayName: text("display_name").notNull(),
  roleLabel: text("role_label"),
  phone: text(),
  email: text(),
  notes: text(),
});

export const staffWorkDays = pgTable(
  "staff_work_days",
  {
    id: serial().primaryKey(),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: integer().notNull(),
  },
  (table) => [
    uniqueIndex("staff_work_days_staff_weekday_idx").on(table.staffId, table.weekday),
  ],
);

export const staffUnavailability = pgTable(
  "staff_unavailability",
  {
    id: serial().primaryKey(),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    unavailabilityType: text("unavailability_type").notNull(),
    note: text(),
  },
  (table) => [index("staff_unavailability_staff_idx").on(table.staffId)],
);

export const teamCoaches = pgTable(
  "team_coaches",
  {
    id: serial().primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    coachName: text("coach_name").notNull(),
    isPrimary: boolean("is_primary").notNull().default(true),
  },
  (table) => [index("team_coaches_team_idx").on(table.teamId)],
);

export const medics = pgTable("medics", {
  id: serial().primaryKey(),
  name: text().notNull(),
  phone: text(),
  isActive: boolean("is_active").notNull().default(true),
});

export const drivers = pgTable("drivers", {
  id: serial().primaryKey(),
  name: text().notNull(),
  phone: text().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const cities = pgTable("cities", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  travelMinutesFromBeerSheva: integer("travel_minutes_from_beer_sheva").notNull(),
  northOfHaderaLine: boolean("north_of_hadera_line").notNull().default(false),
});

export const slots = pgTable(
  "slots",
  {
    id: serial().primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    date: text().notNull(),
    endDate: text("end_date"),
    startTime: text("start_time"),
    type: text().notNull(),
    note: text(),
  },
  (table) => [
    index("slots_date_idx").on(table.date),
    index("slots_team_id_date_idx").on(table.teamId, table.date),
  ],
);

export const slotGameDetails = pgTable(
  "slot_game_details",
  {
    slotId: integer("slot_id")
      .primaryKey()
      .references(() => slots.id, { onDelete: "cascade" }),
    gameKind: text("game_kind").notNull(),
    opponent: text(),
    pitchId: integer("pitch_id").references(() => pitches.id),
    medicId: integer("medic_id").references(() => medics.id),
    driverId: integer("driver_id").references(() => drivers.id),
    cityId: integer("city_id").references(() => cities.id),
    kickoffTime: text("kickoff_time"),
    departureTime: text("departure_time"),
    travelMinutes: integer("travel_minutes"),
    coordinationNote: text("coordination_note"),
  },
);

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

export const externalEvents = pgTable(
  "external_events",
  {
    id: serial().primaryKey(),
    eventType: text("event_type").notNull(),
    title: text().notNull(),
    date: text().notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    pitchId: integer("pitch_id").references(() => pitches.id),
    medicId: integer("medic_id").references(() => medics.id),
    driverId: integer("driver_id").references(() => drivers.id),
    note: text(),
  },
  (table) => [index("external_events_date_idx").on(table.date)],
);
