import snapshot from "@/lib/snapshot.json";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import { addDaysISO, currentWeekStart, resolveWeekStart, weekDates, weekNumber } from "@/lib/week";

// Static (read-only) replacement for lib/schedule.ts. The demo slots in snapshot.json
// are stored as day offsets from a week start and are shown relative to the visitor's
// *current* week, exactly like db/seed.ts does when seeding the real database.
export function getWeekDataStatic(weekParam?: string | null): WeekData {
  const weekStart = resolveWeekStart(weekParam);
  const dates = weekDates(weekStart);
  const base = currentWeekStart();

  const slots: SlotDTO[] = snapshot.slots
    .map((slot) => ({
      id: slot.id,
      teamId: slot.teamId,
      date: addDaysISO(base, slot.dateOffset),
      endDate: slot.endDateOffset != null ? addDaysISO(base, slot.endDateOffset) : null,
      startTime: slot.startTime ?? null,
      type: slot.type,
      note: slot.note ?? null,
    }))
    .filter((slot) =>
      (slot.date >= dates[0] && slot.date <= dates[6]) ||
      (slot.type === "camp" && slot.date <= dates[6] && (slot.endDate ?? slot.date) >= dates[0]),
    )
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id - b.id);

  return {
    clubName: snapshot.clubName,
    seasonStartDate: snapshot.seasonStartDate,
    weekStart,
    weekNumber: weekNumber(weekStart, snapshot.seasonStartDate),
    dates,
    teams: snapshot.teams as TeamDTO[],
    slots,
  };
}
