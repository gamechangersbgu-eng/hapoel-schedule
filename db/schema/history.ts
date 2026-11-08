import { index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

/** Who changed what in the schedule (shown on the admin history page). */
export const scheduleChanges = pgTable(
  "schedule_changes",
  {
    id: serial().primaryKey(),
    at: text().notNull(),
    adminUserId: integer("admin_user_id"),
    adminName: text("admin_name").notNull(),
    /** create | update | delete | cancel | copy_week | lock | bank | coach */
    action: text().notNull(),
    summary: text().notNull(),
    teamId: integer("team_id"),
    slotId: integer("slot_id"),
    /** Date the change is about (YYYY-MM-DD), for filtering. */
    date: text(),
  },
  (table) => [index("schedule_changes_at_idx").on(table.at)],
);
