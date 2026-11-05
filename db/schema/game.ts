import { boolean, index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { pitches } from "./pitch";
import { drivers, medics } from "./team";
import { teams } from "./team";

/** Away-game travel lookup (minutes from Beer Sheva). */
export const cities = pgTable("cities", {
  id: serial().primaryKey(),
  name: text().notNull().unique(),
  travelMinutesFromBeerSheva: integer("travel_minutes_from_beer_sheva").notNull(),
  northOfHaderaLine: boolean("north_of_hadera_line").notNull().default(false),
});

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
  },
  (table) => [
    index("slots_date_idx").on(table.date),
    index("slots_team_id_date_idx").on(table.teamId, table.date),
  ],
);

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
    driverId: integer("driver_id").references(() => drivers.id),
    cityId: integer("city_id").references(() => cities.id),
    kickoffTime: text("kickoff_time"),
    departureTime: text("departure_time"),
    travelMinutes: integer("travel_minutes"),
    coordinationNote: text("coordination_note"),
  },
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
