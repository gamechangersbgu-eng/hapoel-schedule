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
  const root = join(process.cwd(), "netlify/database/migrations");
  const folders = (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const folder of folders) {
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

    console.log(`Applied migration: ${folder} (${statements.length} statements)`);
  }

  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
