import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import {
  db,
  settings as settingsTable,
  slotGameDetails,
  slotTrainingDetails,
  slots as slotsTable,
  staff,
  teamCoaches,
  teams as teamsTable,
} from "@/lib/db";
import { SUBDIVISION_SHORT, trainingEndClock } from "@/lib/pitch-rules";
import { applyCoachLabels, coachFullNameByTeam } from "@/lib/team-labels";
import type { SlotDTO, WeekData } from "@/lib/types";
import { resolveWeekStart, weekDates, weekNumber } from "@/lib/week";

function toSlotDTO(slot: {
  id: number;
  teamId: number;
  date: string;
  endDate: string | null;
  startTime: string | null;
  type: string;
  note: string | null;
  status: string;
  statusNote: string | null;
  substituteStaffId: number | null;
  seriesId: number | null;
}, substituteNames: Map<number, string>): SlotDTO {
  return {
    id: slot.id,
    teamId: slot.teamId,
    date: slot.date,
    endDate: slot.endDate,
    startTime: slot.startTime,
    type: slot.type,
    note: slot.note,
    status: slot.status,
    statusNote: slot.statusNote,
    substituteName: slot.substituteStaffId ? (substituteNames.get(slot.substituteStaffId) ?? null) : null,
    seriesId: slot.seriesId,
  };
}

export async function getWeekData(weekParam?: string | null): Promise<WeekData> {
  const weekStart = resolveWeekStart(weekParam);
  const dates = weekDates(weekStart);

  const [[settings], teamRows, slots, people, coachLinks] = await Promise.all([
    db.select().from(settingsTable).where(eq(settingsTable.id, 1)).limit(1),
    db.select().from(teamsTable).orderBy(asc(teamsTable.sortOrder)),
    db
      .select()
      .from(slotsTable)
      .where(
        or(
          and(gte(slotsTable.date, dates[0]), lte(slotsTable.date, dates[6])),
          and(
            eq(slotsTable.type, "camp"),
            lte(slotsTable.date, dates[6]),
            gte(slotsTable.endDate, dates[0]),
          ),
        ),
      )
      .orderBy(asc(slotsTable.startTime), asc(slotsTable.id)),
    db.select({ id: staff.id, name: staff.displayName, receivesAllUpdates: staff.receivesAllUpdates }).from(staff),
    db
      .select({
        teamId: teamCoaches.teamId,
        staffId: teamCoaches.staffId,
        coachName: teamCoaches.coachName,
        isPrimary: teamCoaches.isPrimary,
      })
      .from(teamCoaches),
  ]);
  const fieldPeople = people.filter((person) => !person.receivesAllUpdates);
  const teams = applyCoachLabels(
    teamRows,
    coachFullNameByTeam(
      coachLinks.filter((link) => link.staffId == null || fieldPeople.some((person) => person.id === link.staffId)),
      fieldPeople,
    ),
  );
  const substituteNames = new Map(people.map((person) => [person.id, person.name]));
  const ids = slots.map((slot) => slot.id);
  const [trainingRows, gameRows] = ids.length
    ? await Promise.all([
        db.select().from(slotTrainingDetails).where(inArray(slotTrainingDetails.slotId, ids)),
        db.select().from(slotGameDetails).where(inArray(slotGameDetails.slotId, ids)),
      ])
    : [[], []];
  const placeBySlot = new Map(
    trainingRows
      .filter((row) => row.subdivisionCode && row.subdivisionCode !== "whole")
      .map((row) => [row.slotId, SUBDIVISION_SHORT[row.subdivisionCode!] ?? null]),
  );
  const trainingBySlot = new Map(trainingRows.map((row) => [row.slotId, row]));
  const gameBySlot = new Map(gameRows.map((row) => [row.slotId, row]));

  if (!settings) {
    throw new Error("Settings are missing. Check that database migrations have been applied.");
  }

  return {
    clubName: settings.clubName,
    seasonStartDate: settings.seasonStartDate,
    weekStart,
    weekNumber: weekNumber(weekStart, settings.seasonStartDate),
    dates,
    teams,
    slots: slots.map((slot) => {
      const training = trainingBySlot.get(slot.id);
      const durationMinutes = training?.durationMinutes ?? null;
      return {
        ...toSlotDTO(slot, substituteNames),
        place: placeBySlot.get(slot.id) ?? null,
        opponent: gameBySlot.get(slot.id)?.opponent ?? null,
        departureTime: gameBySlot.get(slot.id)?.departureTime ?? null,
        medicName: gameBySlot.get(slot.id)?.medicName ?? null,
        durationMinutes,
        rotationTemplateId: training?.rotationTemplateId ?? null,
        endTime: trainingEndClock(slot.startTime, durationMinutes),
      };
    }),
  };
}

export async function getSlotsInWeek(weekStart: string) {
  const dates = weekDates(weekStart);
  return db
    .select()
    .from(slotsTable)
    .where(and(gte(slotsTable.date, dates[0]), lte(slotsTable.date, dates[6])));
}
