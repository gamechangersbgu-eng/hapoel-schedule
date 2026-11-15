/** Local-dev inserts. Not imported by the live site or the GitHub Pages snapshot. */
import { GAME_DETAIL_SOURCES } from "../shared/game";
import type { db as appDb } from "./index";
import { DEMO_TWO_WEEK_SLOTS } from "./demo-two-week-schedule";
import {
  cities,
  pitches,
  slotGameDetails,
  slotTrainingDetails,
  slots as slotsTable,
} from "./schema";
import { TEAM_AGE_BAND_BY_NAME } from "./reference-seed";

/** Demo pitch use per age band: older teams on whole/half pitches, younger ones on smaller parts. */
const DEMO_TRAINING: Record<string, { subdivisions: string[]; minutes: number }> = {
  noar_through_yeladim_b: { subdivisions: ["whole", "half_north", "half_south"], minutes: 105 },
  yeladot: { subdivisions: ["third_north", "quarter_north_1", "quarter_south_2", "half_south"], minutes: 60 },
  yeladim_g_through_trum_g: { subdivisions: ["half_north", "third_center", "quarter_south_1", "quarter_south_2"], minutes: 60 },
  football_school: { subdivisions: ["half_south"], minutes: 120 },
};

type Db = typeof appDb;

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function insertDemoTwoWeekSchedule(
  database: Db,
  weekStart: string,
  teamIdByName: Record<string, number>,
) {
  const pitchRows = await database.select().from(pitches);
  const pitchIdByCode = Object.fromEntries(pitchRows.map((p) => [p.code, p.id]));

  const cityRows = await database.select().from(cities);
  const cityIdByName = Object.fromEntries(cityRows.map((c) => [c.name, c.id]));

  for (const spec of DEMO_TWO_WEEK_SLOTS) {
    const teamId = teamIdByName[spec.teamName];
    if (!teamId) {
      throw new Error(`Unknown team in demo schedule: ${spec.teamName}`);
    }

    const date = addDaysISO(weekStart, spec.dayOffset);
    const endDate =
      spec.endDayOffset != null ? addDaysISO(weekStart, spec.endDayOffset) : null;

    const [inserted] = await database
      .insert(slotsTable)
      .values({
        teamId,
        date,
        endDate,
        startTime: spec.startTime ?? null,
        type: spec.type,
        note: spec.note ?? null,
      })
      .returning({ id: slotsTable.id });

    if (!inserted) continue;

    const trainingPitchId = pitchIdByCode[spec.type];
    if (trainingPitchId) {
      const demo = DEMO_TRAINING[TEAM_AGE_BAND_BY_NAME[spec.teamName] ?? ""] ?? DEMO_TRAINING.noar_through_yeladim_b;
      await database.insert(slotTrainingDetails).values({
        slotId: inserted.id,
        pitchId: trainingPitchId,
        subdivisionCode: demo.subdivisions[inserted.id % demo.subdivisions.length],
        durationMinutes: demo.minutes,
      });
    }

    if (spec.type === "practice_game") {
      await database.insert(slotGameDetails).values({
        slotId: inserted.id,
        gameKind: "practice_game",
        opponent: spec.practice?.opponent ?? null,
        medicName: spec.practice?.medicName ?? null,
        kickoffTime: spec.startTime ?? null,
        source: GAME_DETAIL_SOURCES.ADMIN,
        externalId: `demo-practice-${spec.teamName}-${spec.dayOffset}`,
      });
    }

    if (spec.game && (spec.type === "home_game" || spec.type === "away_game")) {
      const pitchId = spec.game.pitchCode
        ? (pitchIdByCode[spec.game.pitchCode] ?? null)
        : null;
      const cityId = spec.game.cityName
        ? (cityIdByName[spec.game.cityName] ?? null)
        : null;

      await database.insert(slotGameDetails).values({
        slotId: inserted.id,
        gameKind: spec.type,
        opponent: spec.game.opponent,
        pitchId,
        cityId,
        kickoffTime: spec.game.kickoffTime,
        source: GAME_DETAIL_SOURCES.ADMIN,
        externalId: spec.game.externalId,
      });
    }
  }
}

/** Comments row note on current Saturday. */
export async function insertDemoCommentsSlot(
  database: Db,
  weekStart: string,
  commentsTeamId: number,
  dayOffset: number,
) {
  await database.insert(slotsTable).values({
    teamId: commentsTeamId,
    date: addDaysISO(weekStart, dayOffset),
    type: "other",
    note: "משחקי בית בשבת — להגיע שעה לפני. עדכון אחרון באתר.",
  });
}
