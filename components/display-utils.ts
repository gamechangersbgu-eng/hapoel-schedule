// Shared helpers for the display views (phone week list and TV board).
// They work with both the app's SlotDTO and the static site's SlotDTO (which adds an optional endTime).
import { getSlotType, isCampSlot, isPitchSlot } from "@/lib/slot-types";
import type { SlotDTO, TeamDTO } from "@/lib/types";
import { formatISODate } from "@/lib/week";

export const HEBREW_DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

type MaybeRanged = SlotDTO & { endTime?: string | null };

/** "17:30" or "17:30–19:00" (when the slot has an end time). */
export function timeLabel(slot: SlotDTO): string | null {
  if (!slot.startTime) return null;
  const end = (slot as MaybeRanged).endTime;
  return end ? `${slot.startTime}–${end}` : slot.startTime;
}

/** What the slot is, in words: pitch name for trainings, otherwise the type label. */
export function kindLabel(slot: SlotDTO): string {
  const style = getSlotType(slot.type);
  if (isPitchSlot(slot.type)) return `אימון · ${style.label}`;
  return style.label;
}

export function campCovers(slot: SlotDTO, date: string) {
  if (!isCampSlot(slot.type)) return false;
  const end = slot.endDate ?? slot.date;
  return slot.date <= date && end >= date;
}

/** Everything a team has on one day, camps first, then by start time. */
export function slotsForDay(slots: SlotDTO[], teamId: number, date: string) {
  return slots
    .filter(
      (slot) =>
        slot.teamId === teamId &&
        (isCampSlot(slot.type) ? campCovers(slot, date) : slot.date === date),
    )
    .sort(
      (a, b) =>
        Number(isCampSlot(b.type)) - Number(isCampSlot(a.type)) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.id - b.id,
    );
}

export function regularTeams(teams: TeamDTO[]) {
  return teams.filter((team) => !team.isComments);
}

export function todayISO() {
  return formatISODate(new Date());
}
