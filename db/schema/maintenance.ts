import { index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { slots } from "./game";
import { pitches } from "./pitch";

/**
 * Mowing + marking tasks for Vasermil 1-3 (services/notifications/MAINTENANCE.md).
 * kind "game_prep": one per pitch and home-game date. kind "weekly": Vasermil 2 every week.
 * period_key: the game date, or the week's Sunday for weekly tasks.
 */
export const maintenanceTasks = pgTable(
  "maintenance_tasks",
  {
    id: serial().primaryKey(),
    pitchId: integer("pitch_id")
      .notNull()
      .references(() => pitches.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    periodKey: text("period_key").notNull(),
    date: text().notNull(),
    startTime: text("start_time"),
    endTime: text("end_time"),
    showFrom: text("show_from").notNull(),
    slotIds: integer("slot_ids").array().notNull().default([]),
    summary: text().notNull(),
    /** open | done | obsolete */
    status: text().notNull().default("open"),
    doneBy: text("done_by"),
    doneAt: text("done_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("maintenance_tasks_pitch_kind_period_idx").on(table.pitchId, table.kind, table.periodKey),
    index("maintenance_tasks_date_idx").on(table.date),
  ],
);

/**
 * Temporary manual pitch for a home game with no venue from the association.
 * pitch_code: vasermil_1..4, or "other" (not on Vasermil). Cleared by the maintenance sync
 * as soon as the association's venue or an admin's pitch on the game is known.
 */
export const maintenancePitchOverrides = pgTable("maintenance_pitch_overrides", {
  slotId: integer("slot_id")
    .primaryKey()
    .references(() => slots.id, { onDelete: "cascade" }),
  pitchCode: text("pitch_code").notNull(),
  setBy: text("set_by"),
  setAt: text("set_at").notNull(),
});
