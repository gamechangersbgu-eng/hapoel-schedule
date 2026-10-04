import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  clubName: text("club_name").notNull(),
  seasonStartDate: text("season_start_date").notNull(),
});

export const teams = pgTable("teams", {
  id: serial().primaryKey(),
  name: text().notNull(),
  sortOrder: integer("sort_order").notNull(),
  isComments: boolean("is_comments").notNull().default(false),
});

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
