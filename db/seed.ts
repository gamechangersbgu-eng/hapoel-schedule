import { db } from "./index";
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
  "ילדים א",
  "ילדים ב",
  "ילדים ב ל",
  "ילדים ג",
  "ילדים ג ל",
  "טרום א",
  "טרום א ל",
  "טרום ב",
  "טרום ב ל",
  "טרום ג",
  "בית ספר",
  "מ.קייץ",
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

async function main() {
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
