import { index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
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
