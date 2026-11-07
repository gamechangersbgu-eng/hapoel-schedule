import { GAME_DETAIL_SOURCES } from "../shared/game";
import type { db as appDb } from "./index";
import { DEMO_TWO_WEEK_SLOTS } from "./demo-two-week-schedule";
import {
  cities,
  pitches,
  slotGameDetails,
  slots as slotsTable,
} from "./schema";

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
