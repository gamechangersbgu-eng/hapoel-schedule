import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";

import { staff } from "./team";

/**
 * Users who sign in. Parents and players never log in.
 * email: the username (unique text). The column name stays so existing rows are untouched.
 * role: "owner" (can manage other users), "admin" (schedule editing),
 *       "physio" (injuries + physio schedule) or "coach" (injury status of own players). See lib/roles.ts.
 * isFitnessCoach: מאמן כושר. A flag, not a role, so a manager or a coach can hold it.
 *                 Only these users may request a gym booking. Assigned on /admin/users.
 * staffId: the staff row of a coach or physio login (coach: required, decides which players they see).
 * sessionVersion: bumped on password change / deactivation, which signs the user out everywhere.
 */
export const adminUsers = pgTable("admin_users", {
  id: serial().primaryKey(),
  /** Username. Kept as `email` so this table does not need a migration. */
  email: text().notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text().notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  lastLoginAt: text("last_login_at"),
  staffId: integer("staff_id").references(() => staff.id, { onDelete: "set null" }),
  isFitnessCoach: boolean("is_fitness_coach").notNull().default(false),
});
