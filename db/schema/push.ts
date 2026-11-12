import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

/**
 * Parent/player web push for "הקבוצות שלי".
 * Coach WhatsApp/SMS is a separate track and does not use this table.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial().primaryKey(),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  teamIds: integer("team_ids").array().notNull(),
  schedulePath: text("schedule_path").notNull().default("/"),
  userAgent: text("user_agent"),
  updatedAt: text("updated_at").notNull(),
});
