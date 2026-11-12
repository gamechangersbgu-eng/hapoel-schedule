import { sql, type SQL } from "drizzle-orm";
import { MIN_PASSWORD_LENGTH, hashPassword as defaultHashPassword } from "../lib/password-hash";
import { isValidUsername, normalizeUsername } from "../lib/username";

/** Same execute surface as the neon drizzle client used by db:migrate:apply. */
export type SqlExecutor = {
  execute: (query: SQL) => Promise<unknown>;
};

export type PasswordHasher = (password: string) => Promise<string>;

type SeedUser = {
  username: string;
  displayName: string;
  role: "owner" | "admin";
  password: string;
};

/** A row to insert. The plaintext password is not kept on this object. */
export type PlannedAdminUser = {
  email: string;
  displayName: string;
  role: "owner" | "admin";
  passwordHash: string;
  mustChangePassword: false;
};

export type AdminUsersSeedPlan = {
  inserted: PlannedAdminUser[];
  skipped: number;
  log: string;
};

export function adminUsersSeedLog(inserted: number, skipped: number) {
  return `Admin users seed: ${inserted} inserted, ${skipped} skipped`;
}

/**
 * Read ADMIN_USERS_SEED. Missing, blank, or [] is an empty list (the migration skips).
 * Invalid JSON or invalid entries throw a message that does not include the raw value.
 */
export function parseAdminUsersSeed(raw: string | null | undefined): SeedUser[] {
  if (raw == null || raw.trim() === "") return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("ADMIN_USERS_SEED is not valid JSON");
  }
  if (!Array.isArray(data)) throw new Error("ADMIN_USERS_SEED must be a JSON array");

  const users: SeedUser[] = [];
  for (let index = 0; index < data.length; index += 1) {
    users.push(readSeedUser(data[index], index + 1));
  }
  return users;
}

function readSeedUser(entry: unknown, position: number): SeedUser {
  if (!entry || typeof entry !== "object") {
    throw new Error(`ADMIN_USERS_SEED entry ${position} is not an object`);
  }
  const row = entry as Record<string, unknown>;
  const username = typeof row.username === "string" ? normalizeUsername(row.username) : "";
  const displayName = typeof row.displayName === "string" ? row.displayName.trim() : "";
  const role = row.role === "owner" || row.role === "admin" ? row.role : null;
  const password = typeof row.password === "string" ? row.password : "";

  if (!isValidUsername(username)) throw new Error(`ADMIN_USERS_SEED entry ${position} has an invalid username`);
  if (!displayName) throw new Error(`ADMIN_USERS_SEED entry ${position} has an empty display name`);
  if (!role) throw new Error(`ADMIN_USERS_SEED entry ${position} has an invalid role`);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_USERS_SEED entry ${position} has a password shorter than ${MIN_PASSWORD_LENGTH} characters`);
  }
  return { username, displayName, role, password };
}

/**
 * Decide which seed users to insert. Existing usernames (admin_users.email) are
 * skipped and their passwords are not hashed or returned. New users get a hash
 * and mustChangePassword false.
 */
export async function planAdminUsersSeed(input: {
  raw: string | null | undefined;
  existingUsernames: Iterable<string>;
  hashPassword?: PasswordHasher;
}): Promise<AdminUsersSeedPlan> {
  const users = parseAdminUsersSeed(input.raw);
  if (users.length === 0) {
    return { inserted: [], skipped: 0, log: adminUsersSeedLog(0, 0) };
  }

  const existing = new Set<string>();
  for (const name of input.existingUsernames) existing.add(normalizeUsername(name));

  const hash = input.hashPassword ?? defaultHashPassword;
  const seen = new Set<string>();
  const pending: SeedUser[] = [];
  let skipped = 0;
  for (const user of users) {
    if (existing.has(user.username) || seen.has(user.username)) {
      skipped += 1;
      continue;
    }
    seen.add(user.username);
    pending.push(user);
  }

  const inserted: PlannedAdminUser[] = [];
  for (const user of pending) {
    inserted.push({
      email: user.username,
      displayName: user.displayName,
      role: user.role,
      passwordHash: await hash(user.password),
      mustChangePassword: false,
    });
  }
  return { inserted, skipped, log: adminUsersSeedLog(inserted.length, skipped) };
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as Record<string, unknown>[];
  }
  return [];
}

/**
 * Insert seed users that are not already in admin_users. Never updates a row.
 * `raw` defaults to process.env.ADMIN_USERS_SEED. Missing or empty is a no-op
 * and does not query the database.
 */
export async function applyAdminUsersSeed(
  database: SqlExecutor,
  options?: { raw?: string | null; hashPassword?: PasswordHasher },
): Promise<AdminUsersSeedPlan> {
  const raw = options && "raw" in options ? options.raw : process.env.ADMIN_USERS_SEED;
  const parsed = parseAdminUsersSeed(raw);
  if (parsed.length === 0) {
    return planAdminUsersSeed({ raw, existingUsernames: [], hashPassword: options?.hashPassword });
  }

  const existingRows = rowsOf(await database.execute(sql`SELECT email FROM admin_users`));
  const existingUsernames = existingRows.map((row) => (row.email == null ? "" : String(row.email)));
  const plan = await planAdminUsersSeed({
    raw,
    existingUsernames,
    hashPassword: options?.hashPassword,
  });

  const createdAt = new Date().toISOString();
  for (const row of plan.inserted) {
    await database.execute(sql`
      INSERT INTO admin_users (
        email, display_name, password_hash, role, is_active, must_change_password, created_at
      )
      SELECT ${row.email}, ${row.displayName}, ${row.passwordHash}, ${row.role}, true, false, ${createdAt}
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_users WHERE lower(email) = ${row.email}
      )
    `);
  }
  return plan;
}
