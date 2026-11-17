import {
  ensureScheduleRevision,
  seedDemoPlayers,
  seedReferenceData,
  TEAM_AGE_BAND_BY_NAME,
} from "./reference-seed";
import {
  insertDemoCommentsSlot,
  insertDemoTwoWeekSchedule,
} from "./seed-demo-schedule";
import {
  players as playersTable,
  settings,
  slotGameDetails,
  slots as slotsTable,
  teams as teamsTable,
} from "./schema";

const TEAM_NAMES = [
  "נוער",
  "נערים א",
  "נערים ב",
  "נערים ג",
  "ילדים א אדום",
  "ילדים א לבן",
  "ילדים א שחר",
  "ילדים ב אדום",
  "ילדים ב לבן",
  "ילדים ג אדום",
  "ילדים ג לבן",
  "טרום א אדום",
  "טרום א לבן",
  "טרום ב אדום",
  "טרום ב לבן",
  "טרום ג אדום",
  "טרום ג לבן",
  "טרום ג עבדאללה",
  "ילדות א",
  "ילדות ב",
  "טרומיות",
  "בית ספר לכדורגל",
];

function atNoon(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function formatISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sundayOf(date: Date) {
  const copy = atNoon(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function databaseHost(url: string) {
  try {
    return new URL(url.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  } catch {
    return "";
  }
}

function isLocalDatabaseUrl(url: string | undefined) {
  const host = url ? databaseHost(url) : "";
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Demo rows are for a local database only. The public schedule reads Postgres as it is. */
function assertLocalDemoDatabase() {
  const target =
    process.env.LOCAL_DATABASE_URL?.trim() ||
    process.env.NETLIFY_DB_URL?.trim() ||
    process.env.NETLIFY_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (isLocalDatabaseUrl(target)) return;
  console.error(
    "db/seed.ts only loads demo practices and games into a local Postgres. It does not run against the database the live site and GitHub Pages display. Use: node scripts/seed-local.mjs",
  );
  process.exit(1);
}

async function main() {
  assertLocalDemoDatabase();
  const { db } = await import("./index");
  await seedReferenceData(db);

  await db.delete(slotGameDetails);
  await db.delete(slotsTable);
  await db.delete(playersTable);
  await db.delete(teamsTable);
  await db.delete(settings);

  await db.insert(settings).values({
    id: 1,
    clubName: "הפועל באר שבע",
    seasonStartDate: "2026-06-28",
  });

  const teams = await db
    .insert(teamsTable)
    .values(
      TEAM_NAMES.map((name, index) => ({
        name,
        sortOrder: index,
        isComments: false,
        ageBandCode: TEAM_AGE_BAND_BY_NAME[name] ?? null,
      })),
    )
    .returning();

  const [comments] = await db
    .insert(teamsTable)
    .values({
      name: "הערות",
      sortOrder: TEAM_NAMES.length,
      isComments: true,
      ageBandCode: null,
    })
    .returning();

  const teamIdByName = Object.fromEntries(
    teams.map((team) => [team.name, team.id]),
  );

  await seedDemoPlayers(db, teamIdByName);

  const weekStart = formatISODate(sundayOf(new Date()));

  await insertDemoTwoWeekSchedule(db, weekStart, teamIdByName);
  await insertDemoCommentsSlot(db, weekStart, comments.id, 6);

  await ensureScheduleRevision(db);

  console.log(
    `Seeded Postgres: reference data, teams, two weeks of practices/games from ${weekStart}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
