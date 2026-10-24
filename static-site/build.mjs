// Builds a read-only static copy of the public schedule for GitHub Pages.
//
//   PAGES_BASE_PATH=/hapoel-schedule node static-site/build.mjs
//
// It never touches the real app: it copies the repo to .pages-build/, removes the
// admin/database/server-action code from the copy, swaps in static versions of a few
// files from static-site/overlay, runs `next build` with `output: "export"` and moves
// the result to ./out. The Netlify build on main (`npm run build`) is unchanged.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
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

rmSync(work, { recursive: true, force: true });
rmSync(join(root, "out"), { recursive: true, force: true });
mkdirSync(work);

// 1. Copy only what the public page needs.
for (const item of ["app", "components", "lib", "public", "package.json", "tsconfig.json", "postcss.config.mjs"]) {
  cpSync(join(root, item), join(work, item), { recursive: true });
}
symlinkSync(join(root, "node_modules"), join(work, "node_modules"), "dir");

// 2. Strip everything that needs a server or a database.
for (const item of [
  "app/admin",
  "app/actions.ts",
  "components/EditSlotForm.tsx",
  "components/TypeAndCampFields.tsx",
  "lib/db.ts",
  "lib/schedule.ts",
]) {
  rmSync(join(work, item), { recursive: true, force: true });
}

// 3. Snapshot demo data by running db/seed.ts against a fake in-memory db.
run(
  join(root, "node_modules/.bin/tsx"),
  [join(root, "static-site/capture-seed.ts"), join(work, "lib/snapshot.json")],
  { cwd: root },
);
rmSync(join(root, "static-site/.seed-capture.generated.ts"), { force: true });

// 4. Static versions of the page, week nav, schedule view and data access.
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
