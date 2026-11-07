// Loads demo trainings for the current week into the LOCAL database (the one `npm run dev:local` starts).
// Usage (while the site is running in another window):  node scripts/seed-local.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const state = JSON.parse(readFileSync(new URL("../.netlify/state.json", import.meta.url), "utf8"));
const url = state.dbConnectionString;
if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("No local database found. Start the site first with: npm run dev:local");
  process.exit(1);
}

const sql = readFileSync(new URL("./seed-local.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const result = await client.query(sql);
  console.log(`Done: ${result.rowCount} demo trainings added for this week.`);
} catch (error) {
  console.error("Could not load demo data:", error.message || error);
  console.error("Is the site running? Start it with: npm run dev:local");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
