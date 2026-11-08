// Fills the LOCAL database (the one `npm run dev:local` starts) with the club's reference
// data (pitches, subdivisions, rotations, teams) and two weeks of demo practices and games.
// Runs the project's own seed (db/seed.ts) against the local database.
// Usage, while the site is running in another window:  node scripts/seed-local.mjs
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// The local database address: from Netlify's state file, or else ask the Netlify CLI.
let url;
try {
  url = JSON.parse(readFileSync(new URL("../.netlify/state.json", import.meta.url), "utf8")).dbConnectionString;
} catch {
  /* try the CLI below */
}
if (!url) {
  const cli = spawnSync("npx", ["netlify", "database", "connect", "--json"], { encoding: "utf8", shell: true });
  try {
    url = JSON.parse(cli.stdout.slice(cli.stdout.indexOf("{"))).connection_string;
  } catch {
    /* handled below */
  }
}
if (!url || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("No local database found. Start the site first with: npm run dev:local");
  process.exit(1);
}

const result = spawnSync("npx", ["tsx", "db/seed.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, LOCAL_DATABASE_URL: url },
});
if (result.status !== 0) {
  console.error("Could not load demo data. Is the site running? Start it with: npm run dev:local");
}
process.exit(result.status ?? 1);
