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
import { loadDurations, loadRotations } from "@/lib/rotations";

import {
  DEFAULT_TRAINING_MINUTES,
  HOME_GAME_BLOCK_MINUTES,
  SUBDIVISION_RANGE,
  toMinutes,
  type BoardBooking,
  type PitchDay,
} from "@/lib/pitch-rules";

export * from "@/lib/pitch-rules";
import { getCoaches } from "@/lib/coaches-db";

export async function getPitchDay(date: string): Promise<PitchDay> {
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

  const pitchCodes = pitchRows.map((pitch) => pitch.code);
  const pitchIdByCode = Object.fromEntries(pitchRows.map((pitch) => [pitch.code, pitch.id]));
  const teamName = Object.fromEntries(teamRows.map((team) => [team.id, team.name]));

  const daySlots = await db
    .select({
      slot: slotsTable,
      training: slotTrainingDetails,
      game: slotGameDetails,
    })
    .from(slotsTable)
    .leftJoin(slotTrainingDetails, eq(slotTrainingDetails.slotId, slotsTable.id))
    .leftJoin(slotGameDetails, eq(slotGameDetails.slotId, slotsTable.id))
    .where(and(eq(slotsTable.date, date), inArray(slotsTable.type, [...pitchCodes, "home_game"])))
    .orderBy(asc(slotsTable.startTime), asc(slotsTable.id));

  const bookings: BoardBooking[] = [];
  for (const { slot, training, game } of daySlots) {
    if (slot.type === "home_game") {
      const kickoff = game?.kickoffTime || slot.startTime;
      if (!kickoff || !game?.pitchId) continue;
      const start = toMinutes(kickoff);
      bookings.push({
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
      });
      continue;
    }
    if (!slot.startTime) continue;
    const pitchId = training?.pitchId ?? pitchIdByCode[slot.type];
    const start = toMinutes(slot.startTime);
    const duration = training?.durationMinutes ?? null;
    bookings.push({
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
    });
  }

  const allowed = new Map<string, string[]>();
  for (const row of bandRows) {
    allowed.set(row.ageBandCode, [...(allowed.get(row.ageBandCode) ?? []), row.subdivisionCode]);
  }

  return {
    date,
    pitches: pitchRows,
    subdivisions: subdivisionRows,
    durations: durationRows,
    rotations: rotationRows,
    teams: teamRows
      .filter((team) => !team.isComments)
      .map((team) => ({
        id: team.id,
        name: team.name,
        ageBandCode: team.ageBandCode,
        allowedSubdivisions: team.ageBandCode
          ? (allowed.get(team.ageBandCode) ?? Object.keys(SUBDIVISION_RANGE))
          : Object.keys(SUBDIVISION_RANGE),
      })),
    footballSchoolRules: ruleRows.map((rule) => ({
      weekdays: rule.weekdays.split(",").map(Number),
      start: toMinutes(rule.startTime),
      end: toMinutes(rule.endTime),
      allowedSubdivisions: rule.allowedSubdivisions.split(","),
      biweekly: rule.biweekly,
      noteHe: rule.noteHe,
    })),
    bookings,
    coaches,
  };
}

