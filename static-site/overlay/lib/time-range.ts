// Time ranges for pitch (מגרש) bookings: 15-minute steps, start - end, overlap detection.
// Older items only have a start time; their end is derived as start + DEFAULT_MINUTES.

export const STEP_MINUTES = 15;
export const DEFAULT_MINUTES = 90;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (value: unknown): value is string => typeof value === "string" && HHMM.test(value);

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 45, total));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** 00:00, 00:15, ... 23:45 */
export const QUARTER_HOURS: string[] = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, i) =>
  fromMinutes(i * STEP_MINUTES),
);

type Timed = { startTime?: string | null; endTime?: string | null };

/** End used for conflict checks and for pre-filling the form (legacy items: start + 90 minutes). */
export function effectiveEnd(slot: Timed): string | null {
  if (!slot.startTime) return null;
  if (slot.endTime && toMinutes(slot.endTime) > toMinutes(slot.startTime)) return slot.endTime;
  return fromMinutes(toMinutes(slot.startTime) + DEFAULT_MINUTES);
}

/** What the schedule shows: "19:30" for legacy items, "19:30-21:00" for ranges. */
export function formatRange(slot: Timed): string | null {
  if (!slot.startTime) return null;
  return slot.endTime ? `${slot.startTime}\u2013${slot.endTime}` : slot.startTime;
}

/** Half-open overlap of [start, end) ranges. */
export function rangesOverlap(a: Timed, b: Timed): boolean {
  const ae = effectiveEnd(a);
  const be = effectiveEnd(b);
  if (!a.startTime || !b.startTime || !ae || !be) return false;
  return toMinutes(a.startTime) < toMinutes(be) && toMinutes(b.startTime) < toMinutes(ae);
}
