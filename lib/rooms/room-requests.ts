// Pure rules for gym / video-room requests. Pending requests are not bookings.
import { HEBREW_DAY_LETTERS } from "@/lib/week";
import {
  conflictMessage,
  findRoomConflict,
  formatRange,
  roomDurationLabel,
  validateBooking,
  weekdayOfDate,
  type ExistingBooking,
  type RoomConfig,
  type ValidBooking,
} from "./room-rules";

export const REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type RoomRequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABEL: Record<RoomRequestStatus, string> = {
  pending: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
};

export type RoomRecurrence = {
  weekdays: number[];
  until: string;
  extraDates: string[];
  intervalDays: 7 | 14;
};

export type RoomRequestInput = {
  teamId: number;
  startTime: string;
  durationMinutes: number;
  dates: string[];
  note?: string | null;
  recurrence?: RoomRecurrence | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isRequestStatus(value: unknown): value is RoomRequestStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function sanitizeRecurrence(value: RoomRecurrence | null | undefined): RoomRecurrence | null {
  if (!value) return null;
  const weekdays = [...new Set((value.weekdays ?? []).map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
  const until = typeof value.until === "string" && DATE_RE.test(value.until) ? value.until : "";
  const extraDates = [...new Set((value.extraDates ?? []).filter((date) => DATE_RE.test(date)))].sort();
  const intervalDays = value.intervalDays === 14 ? 14 : 7;
  if (weekdays.length === 0 && !until && extraDates.length === 0) return null;
  return { weekdays, until, extraDates, intervalDays };
}

function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}`;
}

/** "כל שבוע · יום א, יום ד עד 24.12" — shown to the approver, not used to expand dates. */
export function recurrenceLabel(recurrence: RoomRecurrence | null): string | null {
  if (!recurrence) return null;
  const days = recurrence.weekdays.map((day) => `יום ${HEBREW_DAY_LETTERS[day] ?? ""}`).join(", ");
  const until = recurrence.until ? ` עד ${shortDate(recurrence.until)}` : "";
  const every = recurrence.intervalDays === 14 ? "כל שבועיים" : "כל שבוע";
  return `${every}${days ? ` · ${days}` : ""}${until}`;
}

export function datesSummary(dates: string[]): string {
  const labels = dates.map(shortDate);
  if (labels.length <= 8) return labels.join(", ");
  return `${labels.slice(0, 6).join(", ")} ועוד ${labels.length - 6}`;
}

/**
 * Dates worth storing. A closed weekday inside a series is dropped.
 * A bad hour, team, or duration fails the whole request.
 */
export function prepareRoomRequest(
  room: RoomConfig,
  input: RoomRequestInput,
): { ok: true; dates: string[]; recurrence: RoomRecurrence | null } | { ok: false; error: string } {
  const dates = [...new Set(input.dates.filter((date) => DATE_RE.test(date)))].sort().slice(0, 200);
  if (dates.length === 0) return { ok: false, error: "יש לבחור תאריך" };
  const open: string[] = [];
  for (const date of dates) {
    const checked = validateBooking(room, {
      teamId: input.teamId,
      date,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
    });
    if ("booking" in checked) {
      open.push(date);
      continue;
    }
    if (!room.weekdays.includes(weekdayOfDate(date))) continue;
    return { ok: false, error: checked.error };
  }
  if (open.length === 0) {
    return { ok: false, error: `${room.label} לא ${room.feminine ? "פתוחה" : "פתוח"} בימים שנבחרו` };
  }
  return { ok: true, dates: open, recurrence: sanitizeRecurrence(input.recurrence) };
}

export type ApprovalPlan =
  | { ok: true; bookings: ValidBooking[] }
  | { ok: false; error: string };

/**
 * Approval inserts every stored date, or none of them.
 * A room that is taken on any date fails the approval; the request stays pending.
 */
export function approvalPlan(
  room: RoomConfig,
  input: { teamId: number; startTime: string; durationMinutes: number; dates: string[] },
  existing: ExistingBooking[],
): ApprovalPlan {
  const dates = [...new Set(input.dates)].sort();
  if (dates.length === 0) return { ok: false, error: "אין מועד לאישור" };
  const bookings: ValidBooking[] = [];
  const blocked: string[] = [];
  for (const date of dates) {
    const checked = validateBooking(room, { ...input, date });
    if ("error" in checked) return { ok: false, error: checked.error };
    const conflict = findRoomConflict(existing, checked.booking);
    if (conflict) blocked.push(`${shortDate(date)} — ${conflictMessage(room, conflict)}`);
    else bookings.push(checked.booking);
  }
  if (blocked.length > 0) {
    return { ok: false, error: `אי אפשר לאשר, יש התנגשות: ${blocked.join(" · ")}` };
  }
  return { ok: true, bookings };
}

export function requestWhenLabel(startTime: string, durationMinutes: number): string {
  const checked = validateBooking(
    { kind: "gym", label: "", path: "", weekdays: [0, 1, 2, 3, 4, 5, 6], feminine: false, openFrom: 0, openUntil: 24 * 60 },
    { teamId: 1, date: "2026-11-22", startTime, durationMinutes },
  );
  const label = roomDurationLabel(durationMinutes);
  if ("error" in checked) return `${startTime} · ${label}`;
  return `${formatRange(checked.booking.start, checked.booking.end)} · ${label}`;
}
