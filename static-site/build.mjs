// Builds a static, read-only copy of the Postgres schedule for GitHub Pages.
//
//   NETLIFY_DATABASE_URL=... PAGES_BASE_PATH=/hapoel-schedule node static-site/build.mjs
//
// It never writes to the database. It copies the repo to .pages-build/, removes the
// admin/server-action code from the copy, snapshots settings/teams/slots with
// static-site/capture-db.ts, swaps in the read-only pages from static-site/overlay,
// runs `next build` with `output: "export"` and moves the result to ./out.
// The Netlify build on main (`npm run build`) is unchanged and reads Postgres live.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, ".pages-build");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function removeTests(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) removeTests(path);
    else if (/\.test\.[cm]?[jt]sx?$/.test(entry.name)) rmSync(path);
  }
}

rmSync(work, { recursive: true, force: true });
rmSync(join(root, "out"), { recursive: true, force: true });
mkdirSync(work);

// 1. Copy only what the public page needs.
for (const item of ["app", "components", "lib", "public", "package.json", "tsconfig.json", "postcss.config.mjs"]) {
  cpSync(join(root, item), join(work, item), { recursive: true });
}
symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");

// Unit tests are copied with lib/ but are not part of the public site.
// schedule-rules.test.ts imports ../shared, and this copy does not include shared/.
// Next type-checks every .ts the tsconfig includes, so exclude tests and delete them.
const tsconfigPath = join(work, "tsconfig.json");
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
tsconfig.exclude = [...new Set([...(tsconfig.exclude ?? []), "**/*.test.ts", "**/*.test.tsx"])];
writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
removeTests(join(work, "lib"));

// 2. Strip everything that needs a server or a database.
for (const item of [
  "app/admin",
  "app/api",
  "app/actions.ts",
  "components/EditSlotForm.tsx",
  "components/TypeAndCampFields.tsx",
  "components/ScheduleLiveRefresh.tsx",
  "lib/db.ts",
  "lib/schedule.ts",
  "lib/schedule-revision.ts",
  "lib/ifa-game-upsert.ts",
  // Management login and pitch board (need the server).
  "app/login",
  "components/AdminUserMenu.tsx",
  "components/AdminShell.tsx",
  "components/PitchBoard.tsx",
  "components/BookingForm.tsx",
  "lib/auth.ts",
  "lib/password.ts",
  "lib/pitch-board.ts",
  "components/GameForm.tsx",
  "components/AdminNav.tsx",
  "lib/games.ts",
  "lib/coaches-db.ts",
  "lib/history.ts",
  "lib/rotations.ts",
  "lib/opponent-cities.ts",
  "lib/training-series.ts",
]) {
  rmSync(join(work, item), { recursive: true, force: true });
}

// 3. Read-only snapshot of the live Postgres schedule. Fails if the database URL is missing.
run(
  join(root, "node_modules/.bin/tsx"),
  [join(root, "static-site/capture-db.ts"), join(work, "lib/snapshot.json")],
  { cwd: root },
);

// 4. Read-only pages. Week navigation and the grid stay the shared public components.
cpSync(join(root, "static-site/overlay"), work, { recursive: true });
cpSync(join(root, "static-site/next.config.static.ts"), join(work, "next.config.ts"));

// 5. Build + export.
run(join(root, "node_modules/.bin/next"), ["build"], { cwd: work, env: process.env });
if (!existsSync(join(work, "out"))) {
  console.error("next build did not produce ./out");
  process.exit(1);
}
cpSync(join(work, "out"), join(root, "out"), { recursive: true });
rmSync(work, { recursive: true, force: true });
console.log("Static site written to ./out");
