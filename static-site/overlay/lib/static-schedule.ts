import snapshot from "@/lib/snapshot.json";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import { resolveWeekStart, weekDates, weekNumber } from "@/lib/week";

// Read-only view of the Postgres snapshot written by static-site/capture-db.ts.
// Dates are the real calendar dates from the database. Nothing here reads the demo
// seed, a committed JSON file, textdb, or localStorage.

export type ScheduleFile = {
  version: 1;
  clubName: string;
  seasonStartDate: string;
  teams: TeamDTO[];
  slots: SlotDTO[];
};

export function scheduleSnapshot(): ScheduleFile {
  const file = snapshot as ScheduleFile;
  if (!file || !Array.isArray(file.teams) || !Array.isArray(file.slots) || !file.clubName) {
    throw new Error(
      "Schedule snapshot is missing. The Pages build must capture it from Postgres.",
    );
  }
  return file;
}

function inWeek(slot: SlotDTO, dates: string[]) {
  return (
    (slot.date >= dates[0] && slot.date <= dates[6]) ||
    (slot.type === "camp" &&
      slot.date <= dates[6] &&
      (slot.endDate ?? slot.date) >= dates[0])
  );
}

function bySlotOrder(a: SlotDTO, b: SlotDTO) {
  return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id - b.id;
}

/** Same week slice the live app builds in lib/schedule.ts getWeekData. */
export function getWeekDataFrom(file: ScheduleFile, weekParam?: string | null): WeekData {
  const weekStart = resolveWeekStart(weekParam);
  const dates = weekDates(weekStart);
  return {
    clubName: file.clubName,
    seasonStartDate: file.seasonStartDate,
    weekStart,
    weekNumber: weekNumber(weekStart, file.seasonStartDate),
    dates,
    teams: file.teams,
    slots: file.slots.filter((slot) => inWeek(slot, dates)).sort(bySlotOrder),
  };
}
