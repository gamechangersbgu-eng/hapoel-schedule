import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { loadDatabaseUrl } from "./env";

/**
 * One-off, approved by Omer: brings a database that still has only the first schema
 * (settings, slots, teams) up to Phase 1. It runs only the migrations below, in one
 * transaction, so either all of them apply or nothing changes. It only adds tables and
 * columns. db:migrate:apply cannot do this because it reruns every migration from the start.
 * Shows what it would do unless run with --confirm.
 */
const MIGRATIONS = [
  "20261105191643_phase1_big_database",
  "20261105193755_add_players_table",
  "20261105194529_tense_ultimates",
];

async function main() {
  loadDatabaseUrl();
  const sql = neon(process.env.NETLIFY_DB_URL!);

  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public'`;
  const tables = new Set(rows.map((row) => String(row.table_name)));
  console.log(`Tables now: ${[...tables].sort().join(", ")}`);

  if (tables.has("slot_game_details")) {
    console.log("Phase 1 is already in this database. Nothing to do.");
    return;
  }
  for (const required of ["settings", "slots", "teams"]) {
    if (!tables.has(required)) throw new Error(`Unexpected database: table "${required}" is missing`);
  }
  if (tables.size !== 3) throw new Error("Unexpected database: it has tables other than the first schema");

  const statements: string[] = [];
  for (const migration of MIGRATIONS) {
    const file = path.join(process.cwd(), "netlify", "database", "migrations", migration, "migration.sql");
    const parts = (await readFile(file, "utf8"))
      .split(/-->\s*statement-breakpoint/)
      .map((part) => part.trim())
      .filter(Boolean);
    console.log(`${migration}: ${parts.length} statements`);
    statements.push(...parts);
  }

  if (!process.argv.includes("--confirm")) {
    console.log(`\n${statements.length} statements ready. Nothing changed. Run again with --confirm to apply.`);
    return;
  }
  await sql.transaction(statements.map((statement) => sql.query(statement)));

  const after = await sql`select table_name from information_schema.tables where table_schema = 'public'`;
  console.log(`\nApplied. The database now has ${after.length} tables.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
