// Pitch board (admin): load one day of pitch usage and check bookings against the club rules
// from the club's pitch-management spec (subdivisions per age band, football-school windows,
// reserved pitches, overlaps, two hours between home games).
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  footballSchoolScheduleRules,
  pitches as pitchesTable,
  pitchSubdivisions as subdivisionsTable,
  slotGameDetails,
  slotTrainingDetails,
  slots as slotsTable,
  teamAgeBandSubdivisions,
  teams as teamsTable,
} from "@/lib/db";
import { effectiveDepartureTime } from "@/lib/game-logistics";
import { loadDurations, loadRotations } from "@/lib/rotations";

import {
  DEFAULT_TRAINING_MINUTES,
  HOME_GAME_BLOCK_MINUTES,
  SUBDIVISION_RANGE,
  allowedSubdivisionsForTeam,
  classifyBooking,
  toMinutes,
  type BoardBooking,
  type PitchDay,
  type ProposedBooking,
  type TeamGameBlock,
} from "@/lib/pitch-rules";

export * from "@/lib/pitch-rules";
import { getCoaches } from "@/lib/coaches-db";
import { applyCoachLabels, coachFullNameByTeam, sortTeamsByAge } from "@/lib/team-labels";

type PitchCatalog = Omit<PitchDay, "date" | "bookings">;
type LoadedCatalog = { catalog: PitchCatalog; teamName: Record<number, string> };

async function loadCatalog(): Promise<LoadedCatalog> {
  const [pitchRows, subdivisionRows, durationRows, rotationRows, teamRows, bandRows, ruleRows, coaches] =
    await Promise.all([
      db.select().from(pitchesTable).orderBy(asc(pitchesTable.sortOrder)),
      db.select().from(subdivisionsTable).orderBy(asc(subdivisionsTable.sortOrder)),
      loadDurations(),
      loadRotations(),
      db.select().from(teamsTable).orderBy(asc(teamsTable.sortOrder)),
      db.select().from(teamAgeBandSubdivisions),
      db.select().from(footballSchoolScheduleRules),
      getCoaches(),
    ]);

  const allowed = new Map<string, string[]>();
  for (const row of bandRows) {
    allowed.set(row.ageBandCode, [...(allowed.get(row.ageBandCode) ?? []), row.subdivisionCode]);
  }

  const fieldCoaches = coaches.filter((coach) => !coach.receivesAllUpdates);
  const labeledTeams = sortTeamsByAge(applyCoachLabels(
    teamRows,
    coachFullNameByTeam(
      fieldCoaches.flatMap((coach) =>
        coach.teamIds.map((teamId) => ({
          teamId,
          staffId: coach.id,
          coachName: coach.name,
          isPrimary: !coach.assistantTeamIds?.includes(teamId),
        })),
      ),
      fieldCoaches.map((coach) => ({ id: coach.id, name: coach.name })),
    ),
  ));
  const labeledById = new Map(labeledTeams.map((team) => [team.id, team]));
  const storedName = new Map(teamRows.map((team) => [team.id, team.name]));

  return {
    catalog: {
      pitches: pitchRows,
      subdivisions: subdivisionRows,
      durations: durationRows,
      rotations: rotationRows,
      teams: labeledTeams
        .filter((team) => !team.isComments)
        .map((team) => {
          const fromBand = team.ageBandCode
            ? (allowed.get(team.ageBandCode) ?? Object.keys(SUBDIVISION_RANGE))
            : Object.keys(SUBDIVISION_RANGE);
          return {
            id: team.id,
            name: team.name,
            ageBandCode: team.ageBandCode,
            allowedSubdivisions: allowedSubdivisionsForTeam({
              name: storedName.get(team.id) ?? team.name,
              allowedSubdivisions: fromBand,
            }),
          };
        }),
      footballSchoolRules: ruleRows.map((rule) => ({
        weekdays: rule.weekdays.split(",").map(Number),
        start: toMinutes(rule.startTime),
        end: toMinutes(rule.endTime),
        allowedSubdivisions: rule.allowedSubdivisions.split(","),
        biweekly: rule.biweekly,
        noteHe: rule.noteHe,
      })),
      coaches: fieldCoaches,
    },
    teamName: Object.fromEntries(teamRows.map((team) => [team.id, labeledById.get(team.id)?.name ?? team.name])),
  };
}

async function loadBookings(
  catalog: PitchCatalog,
  teamName: Record<number, string>,
  dates: string[],
): Promise<Map<string, BoardBooking[]>> {
  const byDate = new Map<string, BoardBooking[]>();
  for (const date of dates) byDate.set(date, []);
  if (dates.length === 0) return byDate;

  const pitchCodes = catalog.pitches.map((pitch) => pitch.code);
  const pitchIdByCode = Object.fromEntries(catalog.pitches.map((pitch) => [pitch.code, pitch.id]));
  const rows = await db
    .select({
      slot: slotsTable,
      training: slotTrainingDetails,
      game: slotGameDetails,
    })
    .from(slotsTable)
    .leftJoin(slotTrainingDetails, eq(slotTrainingDetails.slotId, slotsTable.id))
    .leftJoin(slotGameDetails, eq(slotGameDetails.slotId, slotsTable.id))
    .where(and(inArray(slotsTable.date, dates), inArray(slotsTable.type, [...pitchCodes, "home_game"])))
    .orderBy(asc(slotsTable.date), asc(slotsTable.startTime), asc(slotsTable.id));

  for (const { slot, training, game } of rows) {
    const list = byDate.get(slot.date);
    if (!list) continue;
    if (slot.type === "home_game") {
      const kickoff = game?.kickoffTime || slot.startTime;
      if (!kickoff || !game?.pitchId) continue;
      const start = toMinutes(kickoff);
      list.push({
        slotId: slot.id,
        kind: "home_game",
        teamId: slot.teamId,
        teamName: teamName[slot.teamId] ?? "",
        pitchId: game.pitchId,
        subdivisionCode: "whole",
        start,
        end: start + HOME_GAME_BLOCK_MINUTES,
        durationMinutes: HOME_GAME_BLOCK_MINUTES,
        rotationTemplateId: null,
        note: slot.note,
        opponent: game.opponent,
        status: slot.status,
        statusNote: slot.statusNote,
        substituteStaffId: slot.substituteStaffId,
        seriesId: slot.seriesId,
        sessionKind: null,
      });
      continue;
    }
    if (!slot.startTime) continue;
    const pitchId = training?.pitchId ?? pitchIdByCode[slot.type];
    const start = toMinutes(slot.startTime);
    const duration = training?.durationMinutes ?? null;
    list.push({
      slotId: slot.id,
      kind: "training",
      teamId: slot.teamId,
      teamName: teamName[slot.teamId] ?? "",
      pitchId,
      subdivisionCode: training?.subdivisionCode ?? "whole",
      start,
      end: start + (duration ?? DEFAULT_TRAINING_MINUTES),
      durationMinutes: duration,
      rotationTemplateId: training?.rotationTemplateId ?? null,
      note: slot.note,
      opponent: null,
      status: slot.status,
      statusNote: slot.statusNote,
      substituteStaffId: slot.substituteStaffId,
      seriesId: slot.seriesId,
      sessionKind: training?.sessionKind === "tournament" ? "tournament" : "training",
    });
  }
  return byDate;
}

/** Every game on these dates (home and away), as the time its team is busy. Used for coach clashes. */
async function loadGames(teamName: Record<number, string>, dates: string[]): Promise<Map<string, TeamGameBlock[]>> {
  const byDate = new Map<string, TeamGameBlock[]>();
  for (const date of dates) byDate.set(date, []);
  if (dates.length === 0) return byDate;
  const rows = await db
    .select({ slot: slotsTable, game: slotGameDetails })
    .from(slotsTable)
    .leftJoin(slotGameDetails, eq(slotGameDetails.slotId, slotsTable.id))
    .where(and(inArray(slotsTable.date, dates), inArray(slotsTable.type, ["home_game", "away_game"])));
  for (const { slot, game } of rows) {
    if (slot.status === "cancelled") continue;
    const kickoff = game?.kickoffTime || slot.startTime;
    if (!kickoff) continue;
    const away = slot.type === "away_game";
    const kick = toMinutes(kickoff);
    const leave = away ? effectiveDepartureTime(game?.manualDepartureTime, game?.departureTime) : null;
    const departure = leave ? toMinutes(leave) : null;
    byDate.get(slot.date)?.push({
      slotId: slot.id,
      teamId: slot.teamId,
      teamName: teamName[slot.teamId] ?? "",
      away,
      start: departure != null && departure < kick ? departure : kick,
      end: kick + HOME_GAME_BLOCK_MINUTES,
    });
  }
  return byDate;
}

export async function getPitchDay(date: string): Promise<PitchDay> {
  const { catalog, teamName } = await loadCatalog();
  const [bookings, games] = await Promise.all([
    loadBookings(catalog, teamName, [date]),
    loadGames(teamName, [date]),
  ]);
  return { date, ...catalog, bookings: bookings.get(date) ?? [], games: games.get(date) ?? [] };
}

/** Same rules as one day on the board, for every date of a recurring training. */
export async function classifyDates(dates: string[], booking: ProposedBooking) {
  const unique = [...new Set(dates)].sort();
  const { catalog, teamName } = await loadCatalog();
  const [bookings, games] = await Promise.all([
    loadBookings(catalog, teamName, unique),
    loadGames(teamName, unique),
  ]);
  return unique.map((date) => {
    const day: PitchDay = { date, ...catalog, bookings: bookings.get(date) ?? [], games: games.get(date) ?? [] };
    return { date, ...classifyBooking(day, booking) };
  });
}

