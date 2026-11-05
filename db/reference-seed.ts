import {
  cities,
  drivers,
  footballSchoolScheduleRules,
  medics,
  pitchSubdivisions,
  pitches,
  players,
  rotationTemplates,
  rotationTemplateTimes,
  scheduleRevision,
  teamAgeBandSubdivisions,
  teamAgeBands,
  trainingSessionDurations,
} from "./schema";
import type { db as appDb } from "./index";

type Db = typeof appDb;

export async function seedReferenceData(database: Db) {
  await clearReferenceTables(database);
  await seedPitchData(database);
  await seedTeamAgeBandData(database);
  await seedPracticeData(database);
  await seedGameBanks(database);
}

async function seedGameBanks(database: Db) {
  await database.insert(cities).values([
    {
      name: "תל אביב",
      travelMinutesFromBeerSheva: 120,
      northOfHaderaLine: false,
    },
    {
      name: "חיפה",
      travelMinutesFromBeerSheva: 150,
      northOfHaderaLine: true,
    },
    {
      name: "חדרה",
      travelMinutesFromBeerSheva: 90,
      northOfHaderaLine: true,
    },
    {
      name: "דימונה",
      travelMinutesFromBeerSheva: 35,
      northOfHaderaLine: false,
    },
  ]);

  await database.insert(medics).values([
    { name: "דני כהן", phone: "050-0000001", isActive: true },
    { name: "מיכל לוי", phone: "050-0000002", isActive: true },
  ]);

  await database.insert(drivers).values([
    { name: "יוסי מזרחי", phone: "050-1000001", isActive: true },
    { name: "אבי נהג", phone: "050-1000002", isActive: true },
  ]);
}

/** Ensures schedule_revision row exists (migrations also insert id=1). */
export async function ensureScheduleRevision(database: Db) {
  const updatedAt = new Date().toISOString();
  const [existing] = await database
    .select({ id: scheduleRevision.id })
    .from(scheduleRevision)
    .limit(1);

  if (!existing) {
    await database
      .insert(scheduleRevision)
      .values({ id: 1, version: 1, updatedAt });
  }
}

async function clearReferenceTables(database: Db) {
  await database.delete(drivers);
  await database.delete(medics);
  await database.delete(teamAgeBandSubdivisions);
  await database.delete(footballSchoolScheduleRules);
  await database.delete(rotationTemplateTimes);
  await database.delete(rotationTemplates);
  await database.delete(pitches);
  await database.delete(pitchSubdivisions);
  await database.delete(trainingSessionDurations);
  await database.delete(teamAgeBands);
  await database.delete(cities);
}

// --- נתוני מגרשים (pitch) ---

async function seedPitchData(database: Db) {
  await database.insert(pitchSubdivisions).values([
    { code: "whole", labelHe: "מגרש שלם", sortOrder: 0 },
    { code: "half_north", labelHe: "חצי מגרש (צפון)", sortOrder: 1 },
    { code: "half_south", labelHe: "חצי מגרש (דרום)", sortOrder: 2 },
    { code: "third_north", labelHe: "שליש מגרש (צפון)", sortOrder: 3 },
    { code: "third_center", labelHe: "שליש מגרש (מרכז)", sortOrder: 4 },
    { code: "third_south", labelHe: "שליש מגרש (דרום)", sortOrder: 5 },
    { code: "quarter_north_1", labelHe: "רבע מגרש (צפון 1)", sortOrder: 6 },
    { code: "quarter_north_2", labelHe: "רבע מגרש (צפון 2)", sortOrder: 7 },
    { code: "quarter_south_1", labelHe: "רבע מגרש (דרום 1)", sortOrder: 8 },
    { code: "quarter_south_2", labelHe: "רבע מגרש (דרום 2)", sortOrder: 9 },
  ]);

  await database.insert(pitches).values([
    {
      code: "vasermil_1",
      nameHe: "וסרמיל 1",
      colorKey: "green",
      surfaceType: "synthetic",
      sortOrder: 0,
      allowsHomeGames: true,
    },
    {
      code: "vasermil_2",
      nameHe: "וסרמיל 2",
      colorKey: "orange",
      surfaceType: "natural",
      sortOrder: 1,
      allowsHomeGames: false,
    },
    {
      code: "vasermil_3",
      nameHe: "וסרמיל 3",
      colorKey: "purple",
      surfaceType: "natural",
      sortOrder: 2,
      allowsHomeGames: true,
    },
    {
      code: "vasermil_4",
      nameHe: "וסרמיל 4",
      colorKey: "black",
      surfaceType: "natural",
      sortOrder: 3,
      allowsHomeGames: true,
    },
  ]);
}

// --- נתוני קבוצות (team) — רמות גיל ---

/** Minimal demo roster rows (call after calendar `teams` exist). */
export async function seedDemoPlayers(
  database: Db,
  teamIdByName: Record<string, number>,
) {
  const demos: Array<{ teamName: string; displayName: string; sortOrder: number }> = [
    { teamName: "ילדים א", displayName: "דמו שחקן 1", sortOrder: 0 },
    { teamName: "ילדים א", displayName: "דמו שחקן 2", sortOrder: 1 },
    { teamName: "טרום א", displayName: "דמו שחקן 1", sortOrder: 0 },
  ];

  const rows = demos
    .map((row) => {
      const teamId = teamIdByName[row.teamName];
      if (teamId == null) return null;
      return {
        teamId,
        displayName: row.displayName,
        sortOrder: row.sortOrder,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  if (rows.length > 0) {
    await database.insert(players).values(rows);
  }
}

async function seedTeamAgeBandData(database: Db) {
  await database.insert(teamAgeBands).values([
    {
      code: "noar_through_yeladim_b",
      labelHe: "נוער עד ילדים ב",
      sortOrder: 0,
    },
    {
      code: "yeladim_g_through_trum_g",
      labelHe: "ילדים ג עד טרום ג",
      sortOrder: 1,
    },
    {
      code: "football_school",
      labelHe: "בית ספר לכדורגל",
      sortOrder: 2,
    },
  ]);
}

// --- נתוני אימונים (practice) ---

async function seedPracticeData(database: Db) {
  await database.insert(trainingSessionDurations).values([
    { minutes: 60, labelHe: "שעה" },
    { minutes: 105, labelHe: "שעה 45 דקות" },
    { minutes: 120, labelHe: "שעתיים" },
  ]);

  const halfAndWhole = ["whole", "half_north", "half_south"] as const;
  const allSubdivisions = [
    "whole",
    "half_north",
    "half_south",
    "third_north",
    "third_center",
    "third_south",
    "quarter_north_1",
    "quarter_north_2",
    "quarter_south_1",
    "quarter_south_2",
  ] as const;

  await database.insert(teamAgeBandSubdivisions).values([
    ...halfAndWhole.map((subdivisionCode) => ({
      ageBandCode: "noar_through_yeladim_b",
      subdivisionCode,
    })),
    ...allSubdivisions.map((subdivisionCode) => ({
      ageBandCode: "yeladim_g_through_trum_g",
      subdivisionCode,
    })),
    ...halfAndWhole.map((subdivisionCode) => ({
      ageBandCode: "football_school",
      subdivisionCode,
    })),
  ]);

  await database.insert(footballSchoolScheduleRules).values([
    {
      ruleKey: "weekday_window",
      weekdays: "0,1,2,3",
      startTime: "16:00",
      endTime: "20:00",
      allowedSubdivisions: "whole,half_north,half_south",
      biweekly: false,
      noteHe: "ימי א–ד",
    },
    {
      ruleKey: "thursday_league",
      weekdays: "4",
      startTime: "17:00",
      endTime: "20:00",
      allowedSubdivisions: "whole,half_north,half_south",
      biweekly: true,
      noteHe: "ליגה פנימית — פעם בשבועיים",
    },
  ]);

  const rotationRows = await database
    .insert(rotationTemplates)
    .values([
      { rotationNumber: 1, weekday: 0, labelHe: "סבב 1" },
      { rotationNumber: 2, weekday: null, labelHe: "סבב 2" },
      { rotationNumber: 3, weekday: null, labelHe: "סבב 3" },
      { rotationNumber: 4, weekday: null, labelHe: "סבב 4" },
      { rotationNumber: 5, weekday: null, labelHe: "סבב 5" },
    ])
    .returning();

  const byNumber = Object.fromEntries(
    rotationRows.map((row) => [row.rotationNumber, row.id]),
  );

  const rotationTimes: Record<number, string[]> = {
    1: ["16:30"],
    2: ["16:30", "18:30"],
    3: ["16:00", "17:45", "19:15"],
    4: ["15:30", "17:00", "18:30", "20:00"],
    5: ["08:30", "10:00", "11:30", "13:00", "14:30"],
  };

  await database.insert(rotationTemplateTimes).values(
    Object.entries(rotationTimes).flatMap(([number, times]) =>
      times.map((startTime, index) => ({
        rotationTemplateId: byNumber[Number(number)],
        sequence: index,
        startTime,
      })),
    ),
  );
}

/** Maps calendar row Hebrew names → `team_age_bands.code` (team domain). */
export const TEAM_AGE_BAND_BY_NAME: Record<string, string | null> = {
  נוער: "noar_through_yeladim_b",
  "נערים א": "noar_through_yeladim_b",
  "נערים ב": "noar_through_yeladim_b",
  "נערים ג": "noar_through_yeladim_b",
  "ילדים א": "noar_through_yeladim_b",
  "ילדים ב": "noar_through_yeladim_b",
  "ילדים ב ל": "noar_through_yeladim_b",
  "ילדים ג": "yeladim_g_through_trum_g",
  "ילדים ג ל": "yeladim_g_through_trum_g",
  "טרום א": "yeladim_g_through_trum_g",
  "טרום א ל": "yeladim_g_through_trum_g",
  "טרום ב": "yeladim_g_through_trum_g",
  "טרום ב ל": "yeladim_g_through_trum_g",
  "טרום ג": "yeladim_g_through_trum_g",
  "בית ספר": "football_school",
  "מ.קייץ": null,
  הערות: null,
};
