import { prisma } from "@/lib/db";
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

  const [settings, teams, slots] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.team.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.slot.findMany({
      where: {
        OR: [
          { date: { gte: dates[0], lte: dates[6] } },
          {
            AND: [
              { type: "camp" },
              { date: { lte: dates[6] } },
              { endDate: { gte: dates[0] } },
            ],
          },
        ],
      },
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
    }),
  ]);

  if (!settings) {
    throw new Error("Settings are missing. Run prisma db seed.");
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
  return prisma.slot.findMany({
    where: { date: { gte: dates[0], lte: dates[6] } },
  });
}
