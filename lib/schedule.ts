import { and, asc, eq, gte, lte, or } from "drizzle-orm";
import { db, settings as settingsTable, slots as slotsTable, teams as teamsTable } from "@/lib/db";
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
}): SlotDTO {
  return {
    id: slot.id,
    teamId: slot.teamId,
    date: slot.date,
    endDate: slot.endDate,
    startTime: slot.startTime,
    type: slot.type,
    note: slot.note,
  };
}

export async function getWeekData(weekParam?: string | null): Promise<WeekData> {
  const weekStart = resolveWeekStart(weekParam);
  const dates = weekDates(weekStart);

  const [[settings], teams, slots] = await Promise.all([
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
  ]);

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
    slots: slots.map(toSlotDTO),
  };
}

export async function getSlotsInWeek(weekStart: string) {
  const dates = weekDates(weekStart);
  return db
    .select()
    .from(slotsTable)
    .where(and(gte(slotsTable.date, dates[0]), lte(slotsTable.date, dates[6])));
}
