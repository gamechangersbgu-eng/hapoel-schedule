import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

/** Lookup: pitch subdivision codes (whole, halves, thirds, quarters). */
export const pitchSubdivisions = pgTable("pitch_subdivisions", {
  code: text().primaryKey(),
  labelHe: text("label_he").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

/** Vasermil pitches; lock/reserved/home-game flags live here (weekly status deferred). */
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
