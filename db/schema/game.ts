import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { pitches } from "./pitch";
import { drivers, medics, staff } from "./team";
import { teams } from "./team";

/** Monotonic version for schedule readers (web/TV poll). Single row id=1. */
export const scheduleRevision = pgTable("schedule_revision", {
  id: integer().primaryKey().default(1),
  version: integer().notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

/** Away-game travel lookup (minutes from Beer Sheva). */
export const cities = pgTable("cities", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  travelMinutesFromBeerSheva: integer("travel_minutes_from_beer_sheva").notNull(),
  northOfHaderaLine: boolean("north_of_hadera_line").notNull().default(false),
});

/** Opponent club name → city, so away games can fill the city from the opponent. */
export const opponentClubs = pgTable(
  "opponent_clubs",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("opponent_clubs_name_idx").on(table.name)],
);

/**
 * Calendar event on a team row (`teams`). `type` matches UI slot kinds.
 * Training-specific fields: `practice.slotTrainingDetails`. Game fields: `slotGameDetails`.
 */
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
    /** "active" or "cancelled". Cancelled items stay visible to parents, marked as cancelled. */
    status: text().notNull().default("active"),
    /** Reason shown to parents, e.g. "המאמן חולה". */
    statusNote: text("status_note"),
    /** Substitute coach for this one session (staff row). */
    substituteStaffId: integer("substitute_staff_id").references(() => staff.id, { onDelete: "set null" }),
    /** Recurring training series (`practice.trainingSeries`). Null for a one-off. */
    seriesId: integer("series_id"),
  },
  (table) => [
    index("slots_date_idx").on(table.date),
    index("slots_team_id_date_idx").on(table.teamId, table.date),
  ],
);

/**
 * Manual IFA team → calendar row. When `locked`, the scraper writes that team's games
 * here and does not follow `services/scraper/db-teams.ts`.
 */
export const ifaTeamLocks = pgTable("ifa_team_locks", {
  ifaTeamId: integer("ifa_team_id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  leagueLabel: text("league_label").notNull(),
  locked: boolean().notNull().default(true),
});

/** 1:1 extension for home/away games on `slots`. */
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
    /** Free-text medic for a practice game (משחק אימון). League games use medicId. */
    medicName: text("medic_name"),
    driverId: integer("driver_id").references(() => drivers.id),
    cityId: integer("city_id").references(() => cities.id),
    kickoffTime: text("kickoff_time"),
    departureTime: text("departure_time"),
    travelMinutes: integer("travel_minutes"),
    coordinationNote: text("coordination_note"),
    /** Writer idempotency: e.g. `ifa_scraper` + IFA fixture id. */
    source: text(),
    externalId: text("external_id"),
  },
  (table) => [
    uniqueIndex("slot_game_details_source_external_idx").on(
      table.source,
      table.externalId,
    ),
  ],
);

/** External driver/medic/activity blocks (logistics overlap with game banks). */
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
