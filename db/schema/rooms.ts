import { index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { teams } from "./team";

/**
 * Internal room schedules (admin + club TV only, never the public schedule).
 * Times are minutes from midnight so the database can refuse overlaps:
 * each table has EXCLUDE USING gist (date WITH =, int4range(start_min, end_min) WITH &&)
 * in its migration (Drizzle does not model exclusion constraints).
 * series_id groups the dates of one recurring booking.
 */
function roomBookingsTable<TName extends string>(name: TName) {
  return pgTable(
    name,
    {
      id: serial().primaryKey(),
      teamId: integer("team_id")
        .notNull()
        .references(() => teams.id, { onDelete: "cascade" }),
      date: text().notNull(),
      startMin: integer("start_min").notNull(),
      endMin: integer("end_min").notNull(),
      note: text(),
      seriesId: text("series_id"),
      createdBy: text("created_by"),
      createdAt: text("created_at").notNull(),
      updatedAt: text("updated_at").notNull(),
    },
    (table) => [index(`${name}_date_idx`).on(table.date), index(`${name}_series_idx`).on(table.seriesId)],
  );
}

export const gymBookings = roomBookingsTable("gym_bookings");
export const videoRoomBookings = roomBookingsTable("video_room_bookings");
