import { eq } from "drizzle-orm";
import {
  DURATION_PRESETS,
  ROTATION_PRESETS,
  durationLabelHe,
} from "../lib/pitch-rules";
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

/** Inserts the standard training lengths (60 / 75 / 90 / 105 / 120) when they are missing. */
export async function ensureTrainingDurations(database: Db) {
  const existing = await database
    .select({ minutes: trainingSessionDurations.minutes })
    .from(trainingSessionDurations);
  const have = new Set(existing.map((row) => row.minutes));
  const missing = DURATION_PRESETS.filter((row) => !have.has(row.minutes));
  if (missing.length === 0) return;
  await database
    .insert(trainingSessionDurations)
    .values(missing)
    .onConflictDoNothing({ target: trainingSessionDurations.minutes });
}

/** Makes one duration legal to store (the column references this table). */
export async function ensureTrainingDuration(database: Db, minutes: number) {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 12 * 60) return;
  await database
    .insert(trainingSessionDurations)
    .values({ minutes, labelHe: durationLabelHe(minutes) })
    .onConflictDoNothing({ target: trainingSessionDurations.minutes });
}

/**
 * Inserts סבב 1–5 and their start times when missing.
 * Safe to run on every pitch-board / admin load and from the idempotent migration.
 */
export async function ensureRotationTemplates(database: Db) {
  const rows = await database
    .select({
      id: rotationTemplates.id,
      rotationNumber: rotationTemplates.rotationNumber,
    })
    .from(rotationTemplates);
  const byNumber = new Map(rows.map((row) => [row.rotationNumber, row.id]));
  const missingTemplates = ROTATION_PRESETS.filter((item) => !byNumber.has(item.number));
  if (missingTemplates.length > 0) {
    const created = await database
      .insert(rotationTemplates)
      .values(
        missingTemplates.map((item) => ({
          rotationNumber: item.number,
          weekday: item.weekday,
          labelHe: item.label,
        })),
      )
      .onConflictDoNothing({ target: rotationTemplates.rotationNumber })
      .returning({ id: rotationTemplates.id, rotationNumber: rotationTemplates.rotationNumber });
    for (const row of created) byNumber.set(row.rotationNumber, row.id);
    if (created.length < missingTemplates.length) {
      const again = await database
        .select({ id: rotationTemplates.id, rotationNumber: rotationTemplates.rotationNumber })
        .from(rotationTemplates);
      for (const row of again) byNumber.set(row.rotationNumber, row.id);
    }
  }

  const existingTimes = await database
    .select({
      rotationTemplateId: rotationTemplateTimes.rotationTemplateId,
      sequence: rotationTemplateTimes.sequence,
    })
    .from(rotationTemplateTimes);
  const haveTime = new Set(existingTimes.map((row) => `${row.rotationTemplateId}:${row.sequence}`));
  const missingTimes = ROTATION_PRESETS.flatMap((item) => {
    const rotationTemplateId = byNumber.get(item.number);
    if (rotationTemplateId == null) return [];
    return item.times.flatMap((startTime, sequence) => {
      if (haveTime.has(`${rotationTemplateId}:${sequence}`)) return [];
      return [{ rotationTemplateId, sequence, startTime }];
    });
  });
  if (missingTimes.length === 0) return;
  await database
    .insert(rotationTemplateTimes)
    .values(missingTimes)
    .onConflictDoNothing({
      target: [rotationTemplateTimes.rotationTemplateId, rotationTemplateTimes.sequence],
    });
}

/** True when this rotation id is a real database row (fallback chips use negative ids). */
export async function resolveRotationTemplateId(database: Db, id: number | null | undefined) {
  if (!id || id <= 0) return null;
  const [row] = await database
    .select({ id: rotationTemplates.id })
    .from(rotationTemplates)
    .where(eq(rotationTemplates.id, id))
    .limit(1);
  return row?.id ?? null;
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
    { teamName: "ילדים א אדום", displayName: "דמו שחקן 1", sortOrder: 0 },
    { teamName: "ילדים א אדום", displayName: "דמו שחקן 2", sortOrder: 1 },
    { teamName: "טרום א אדום", displayName: "דמו שחקן 1", sortOrder: 0 },
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
    {
      code: "yeladot",
      labelHe: "ילדות א–ב",
      sortOrder: 3,
    },
  ]);
}

// --- נתוני אימונים (practice) ---

async function seedPracticeData(database: Db) {
  await ensureTrainingDurations(database);

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
    ...allSubdivisions.map((subdivisionCode) => ({
      ageBandCode: "yeladot",
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

  await ensureRotationTemplates(database);
}

/** Maps calendar row Hebrew names → `team_age_bands.code` (team domain). Team list per the club spec (Nov 2026). */
/* ילדות א/ב and טרומיות: whole, half, third, and quarter. Other נוער–ילדים ב teams stay on whole/half. */
export const TEAM_AGE_BAND_BY_NAME: Record<string, string | null> = {
  "נוער": "noar_through_yeladim_b",
  "נערים א": "noar_through_yeladim_b",
  "נערים ב": "noar_through_yeladim_b",
  "נערים ג": "noar_through_yeladim_b",
  "ילדים א אדום": "noar_through_yeladim_b",
  "ילדים א לבן": "noar_through_yeladim_b",
  "ילדים א שחר": "noar_through_yeladim_b",
  "ילדים ב אדום": "noar_through_yeladim_b",
  "ילדים ב לבן": "noar_through_yeladim_b",
  "ילדים ג אדום": "yeladim_g_through_trum_g",
  "ילדים ג לבן": "yeladim_g_through_trum_g",
  "טרום א אדום": "yeladim_g_through_trum_g",
  "טרום א לבן": "yeladim_g_through_trum_g",
  "טרום ב אדום": "yeladim_g_through_trum_g",
  "טרום ב לבן": "yeladim_g_through_trum_g",
  "טרום ג אדום": "yeladim_g_through_trum_g",
  "טרום ג לבן": "yeladim_g_through_trum_g",
  "טרום ג עבדאללה": "yeladim_g_through_trum_g",
  "ילדות א": "yeladot",
  "ילדות ב": "yeladot",
  "טרומיות": "yeladot",
  "בית ספר לכדורגל": "football_school",
  הערות: null,
};
