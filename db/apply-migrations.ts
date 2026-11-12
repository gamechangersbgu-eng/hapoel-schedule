/** Apply SQL migrations under netlify/database/migrations (sorted folders). Needs NETLIFY_DATABASE_URL. */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as dsql } from "drizzle-orm";
import type { SqlExecutor } from "./apply-cities-opponents-seed";

async function main() {
  const url =
    process.env.NETLIFY_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "Missing NETLIFY_DATABASE_URL or DATABASE_URL (Netlify DB connection string).",
    );
  }

  const db = drizzle(url);
  // Track applied migrations so each build only runs new ones.
  await db.execute(
    dsql.raw(
      'CREATE TABLE IF NOT EXISTS "_applied_migrations" ("name" text PRIMARY KEY, "applied_at" timestamptz NOT NULL DEFAULT now())',
    ),
  );
  const appliedRows = (await db.execute(
    dsql.raw('SELECT "name" FROM "_applied_migrations"'),
  )) as unknown as { rows?: { name: string }[] } | { name: string }[];
  const rows = Array.isArray(appliedRows) ? appliedRows : (appliedRows.rows ?? []);
  const applied = new Set(rows.map((r) => r.name));
  const root = join(process.cwd(), "netlify/database/migrations");
  const folders = (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const folder of folders) {
    if (applied.has(folder)) {
      console.log(`Skipping already applied migration: ${folder}`);
      continue;
    }
    const file = join(root, folder, "migration.sql");
    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }

    const statements = content
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.execute(dsql.raw(statement));
    }

    // Optional TypeScript step (for example the cities seed, which calls departureFor).
    // Runs before the folder is marked applied, so a failure is retried. The step must
    // be idempotent: a retry runs the SQL and the step again.
    const dataStep = join(root, folder, "data.ts");
    if (existsSync(dataStep)) {
      const mod = (await import(pathToFileURL(dataStep).href)) as {
        apply?: (database: SqlExecutor) => Promise<void>;
      };
      if (typeof mod.apply === "function") {
        await mod.apply(db);
        console.log(`Applied data step: ${folder}`);
      }
    }

    await db.execute(
      dsql`INSERT INTO "_applied_migrations" ("name") VALUES (${folder}) ON CONFLICT DO NOTHING`,
    );
    console.log(`Applied migration: ${folder} (${statements.length} statements)`);
  }

  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
