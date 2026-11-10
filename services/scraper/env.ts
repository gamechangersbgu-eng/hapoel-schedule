import { existsSync } from "node:fs";
import path from "node:path";

export const ENV_FILE = path.join(process.cwd(), "services", "scraper", ".env");

/**
 * The connection string lives only in services/scraper/.env on the computer that runs the
 * scraper (ignored by Git). The database driver reads NETLIFY_DB_URL, so the name used
 * elsewhere in the repo, NETLIFY_DATABASE_URL, is accepted too.
 */
export function loadDatabaseUrl(): void {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  // process.env turns undefined into the string "undefined", so copy only a real value.
  const fallback = process.env.NETLIFY_DATABASE_URL;
  if (!process.env.NETLIFY_DB_URL && fallback) process.env.NETLIFY_DB_URL = fallback;
  if (!process.env.NETLIFY_DB_URL) {
    throw new Error(`No database connection: put NETLIFY_DB_URL=... in ${ENV_FILE}`);
  }
}
