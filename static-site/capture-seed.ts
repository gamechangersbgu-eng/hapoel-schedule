// Runs db/seed.ts against the fake db and writes a JSON snapshot of the demo data.
// Slot dates are stored as day offsets from the Sunday of the seeding week, so the
// static site can show the demo data in the *visitor's* current week.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { captured } from "./capture-db";

const out = process.argv[2];
const seedPath = resolve(__dirname, "../db/seed.ts");
const patched = readFileSync(seedPath, "utf8")
  .replace(/from "\.\/index"/, 'from "./capture-db"')
  .replace(/from "\.\/schema"/, 'from "../db/schema"');
const tmpSeed = resolve(__dirname, ".seed-capture.generated.ts");
writeFileSync(tmpSeed, patched);

function dayNumber(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

process.on("exit", () => {
  const now = new Date();
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 12);
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  const base = dayNumber(`${y}-${m}-${d}`);
  const s = captured.settings[0] as { clubName: string; seasonStartDate: string };
  const snapshot = {
    clubName: s.clubName,
    seasonStartDate: s.seasonStartDate,
    teams: captured.teams.map((t) => ({
      id: t.id,
      name: t.name,
      sortOrder: t.sortOrder,
      isComments: t.isComments,
    })),
    slots: captured.slots.map((sl) => ({
      id: sl.id,
      teamId: sl.teamId,
      dateOffset: dayNumber(sl.date as string) - base,
      endDateOffset: sl.endDate ? dayNumber(sl.endDate as string) - base : null,
      startTime: sl.startTime,
      type: sl.type,
      note: sl.note,
    })),
  };
  writeFileSync(out, JSON.stringify(snapshot, null, 2));
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
require(tmpSeed);
