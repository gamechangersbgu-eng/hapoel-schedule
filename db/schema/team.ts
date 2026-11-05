import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Club-level settings (one row). */
export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  clubName: text("club_name").notNull(),
  seasonStartDate: text("season_start_date").notNull(),
});

/** Lookup: age bands for calendar rows and pitch subdivision rules (see `practice.teamAgeBandSubdivisions`). */
export const teamAgeBands = pgTable("team_age_bands", {
  code: text().primaryKey(),
  labelHe: text("label_he").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

/** Calendar rows: teams + comments row; flags for locked display names. */
export const teams = pgTable("teams", {
  id: serial().primaryKey(),
  name: text().notNull(),
  sortOrder: integer("sort_order").notNull(),
  isComments: boolean("is_comments").notNull().default(false),
  ageBandCode: text("age_band_code").references(() => teamAgeBands.code),
  docListName: text("doc_list_name"),
  isCalendarNameLocked: boolean("is_calendar_name_locked").notNull().default(false),
});

/** Roster players on a team row (youth football). */
export const players = pgTable(
  "players",
  {
    id: serial().primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    birthDate: text("birth_date"),
    parentPhone: text("parent_phone"),
    notes: text(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("players_team_idx").on(table.teamId)],
);

/** Staff roster (structure only in phase 1). */
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

/** Placeholder team ↔ coach links (constraints deferred). */
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

/** Medic bank — referenced from `game.slotGameDetails` and `game.externalEvents`. */
export const medics = pgTable("medics", {
  id: serial().primaryKey(),
  name: text().notNull(),
  phone: text(),
  isActive: boolean("is_active").notNull().default(true),
});

/** Driver bank — referenced from `game.slotGameDetails` and `game.externalEvents`. */
export const drivers = pgTable("drivers", {
  id: serial().primaryKey(),
  name: text().notNull(),
  phone: text().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});
