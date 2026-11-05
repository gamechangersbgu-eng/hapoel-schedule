import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

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
