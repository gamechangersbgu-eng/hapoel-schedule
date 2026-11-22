import { index, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { adminUsers } from "./auth";
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

/**
 * A request to book the gym or the video room. Pending rows are not schedule rows:
 * only an approval inserts into gym_bookings / video_room_bookings.
 * dates: JSON array of ISO dates. recurrence: JSON pattern, or null for one date.
 */
export const roomBookingRequests = pgTable(
  "room_booking_requests",
  {
    id: serial().primaryKey(),
    room: text().notNull(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    dates: text().notNull(),
    recurrence: text(),
    note: text(),
    status: text().notNull().default("pending"),
    decidedBy: integer("decided_by").references(() => adminUsers.id, { onDelete: "set null" }),
    decidedAt: text("decided_at"),
    reason: text(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("room_booking_requests_status_idx").on(table.room, table.status),
    index("room_booking_requests_requester_idx").on(table.requesterId),
  ],
);
