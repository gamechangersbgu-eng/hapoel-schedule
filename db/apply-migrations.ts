/** Apply SQL migrations under netlify/database/migrations (sorted folders). Needs NETLIFY_DATABASE_URL. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as dsql } from "drizzle-orm";

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
