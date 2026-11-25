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
  if (isPitchSlot(slot.type)) {
    const what = slot.sessionKind === "tournament" ? "טורניר/ליגה" : "אימון";
    return `${what} · ${style.label}${slot.place ? ` · ${slot.place}` : ""}`;
  }
  if (slot.sessionKind === "tournament") return "טורניר/ליגה";
  return style.label;
}

/** Opponent and medic for a practice game, or null when this slot is something else or both are empty. */
export function practiceGameDetail(slot: {
  type: string;
  opponent?: string | null;
  medicName?: string | null;
}): string | null {
  if (slot.type !== "practice_game") return null;
  const parts: string[] = [];
  if (slot.opponent?.trim()) parts.push(`נגד ${slot.opponent.trim()}`);
  if (slot.medicName?.trim()) parts.push(`חובש: ${slot.medicName.trim()}`);
  return parts.length ? parts.join(" · ") : null;
}

export function campCovers(slot: SlotDTO, date: string) {
  if (!isCampSlot(slot.type)) return false;
  const end = slot.endDate ?? slot.date;
  return slot.date <= date && end >= date;
}

/** Days off sit under every other entry. Camps stay first, then the clock. */
export function compareDaySlots(a: SlotDTO, b: SlotDTO) {
  const rank = (slot: SlotDTO) => (slot.type === "off" ? 2 : isCampSlot(slot.type) ? 0 : 1);
  return (
    rank(a) - rank(b) ||
    (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
    a.id - b.id
  );
}

/** Everything a team has on one day, camps first, days off last, then by start time. */
export function slotsForDay(slots: SlotDTO[], teamId: number, date: string) {
  return slots
    .filter(
      (slot) =>
        slot.teamId === teamId &&
        (isCampSlot(slot.type) ? campCovers(slot, date) : slot.date === date),
    )
    .sort(compareDaySlots);
}

/** Pitch chips on the phone. "all" keeps every entry. */
export const MOBILE_PITCH_FILTERS = [
  { id: "all", label: "כל המגרשים" },
  { id: "vasermil_1", label: "וסרמיל 1" },
  { id: "vasermil_2", label: "וסרמיל 2" },
  { id: "vasermil_3", label: "וסרמיל 3" },
  { id: "vasermil_4", label: "וסרמיל 4" },
  { id: "other", label: "אחר" },
] as const;

export function slotMatchesPitch(slot: SlotDTO, pitchId: string) {
  if (pitchId === "all") return true;
  return slot.type === pitchId;
}

export function regularTeams(teams: TeamDTO[]) {
  return teams.filter((team) => !team.isComments);
}

export function todayISO() {
  return formatISODate(new Date());
}
