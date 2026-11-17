import { index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { adminUsers } from "./auth";
import { players } from "./team";

/**
 * One injury of one player. `status`: injured → treatment → gradual_return → fit (see lib/injuries.ts).
 * Medical data about minors: only where it hurts (closed list) and a short note, no diagnoses.
 * Managers and the physio see everything; the player's coach sees the status and expected return only.
 */
export const injuries = pgTable(
  "injuries",
  {
    id: serial().primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    injuredAt: text("injured_at").notNull(),
    bodyPart: text("body_part").notNull(),
    status: text().notNull().default("injured"),
    /** YYYY-MM-DD, optional. */
    expectedReturn: text("expected_return"),
    note: text(),
    createdBy: integer("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** Set when the player is fit again. Open injuries have null here. */
    closedAt: text("closed_at"),
  },
  (table) => [
    index("injuries_player_idx").on(table.playerId),
    index("injuries_status_idx").on(table.status),
  ],
);

/** Every change to an injury (also its creation, with fromStatus null). Shown as the injury's history. */
export const injuryStatusChanges = pgTable(
  "injury_status_changes",
  {
    id: serial().primaryKey(),
    injuryId: integer("injury_id")
      .notNull()
      .references(() => injuries.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    at: text().notNull(),
    changedBy: integer("changed_by").references(() => adminUsers.id, { onDelete: "set null" }),
    /** Copy of the name, so the history stays readable after a user is removed. */
    changedByName: text("changed_by_name").notNull(),
    note: text(),
  },
  (table) => [index("injury_status_changes_injury_idx").on(table.injuryId)],
);

/** A physio treatment booked for an open injury. `status`: scheduled | done | cancelled. */
export const physioSessions = pgTable(
  "physio_sessions",
  {
    id: serial().primaryKey(),
    injuryId: integer("injury_id")
      .notNull()
      .references(() => injuries.id, { onDelete: "cascade" }),
    /** The physio's login (admin_users, role "physio"). */
    physioUserId: integer("physio_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    physioName: text("physio_name").notNull(),
    /** YYYY-MM-DD */
    date: text().notNull(),
    /** HH:MM */
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    status: text().notNull().default("scheduled"),
    note: text(),
    createdBy: integer("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("physio_sessions_date_idx").on(table.date),
    index("physio_sessions_injury_idx").on(table.injuryId),
  ],
);
