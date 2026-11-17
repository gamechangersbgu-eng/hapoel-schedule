// Pure rules for the internal room schedules (gym, video room). No database access.
// Shown to admins and on the club TV only — never on the public schedule, no parent push.

export type RoomKind = "gym" | "video";

export type RoomConfig = {
  kind: RoomKind;
  label: string;
  path: string;
  /** Weekdays the room can be booked (0 = Sunday). */
  weekdays: readonly number[];
  /** Hebrew agreement: "תפוס"/"תפוסה", "פתוח"/"פתוחה". */
  feminine: boolean;
  /** Opening hours in minutes from midnight; a session must fit inside them (no overnight sessions). */
  openFrom: number;
  openUntil: number;
};

export const ROOMS: Record<RoomKind, RoomConfig> = {
  // Gym: open around the clock, every day.
  gym: {
    kind: "gym",
    label: "חדר כושר",
    path: "/admin/gym",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    feminine: false,
    openFrom: 0,
    openUntil: 24 * 60,
  },
  // Video room: Sunday to Friday, the same hours as trainings (06:00–23:45).
  video: {
    kind: "video",
    label: "כיתת וידאו",
    path: "/admin/video",
    weekdays: [0, 1, 2, 3, 4, 5],
    feminine: true,
    openFrom: 6 * 60,
    openUntil: 23 * 60 + 45,
  },
};

export function readRoomKind(raw: unknown): RoomKind | null {
  return raw === "gym" || raw === "video" ? raw : null;
}

/** Session lengths offered in the form (minutes). */
export const ROOM_DURATIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180] as const;
export const DEFAULT_ROOM_MINUTES = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function clockToMinutes(time: string): number | null {
  const match = TIME_RE.exec(time.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function minutesToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * "16:00–17:00", wrapped in a left-to-right isolate (U+2066 … U+2069) so it keeps its order
 * inside Hebrew sentences (messages, history) instead of showing as "17:00–16:00".
 */
export function formatRange(start: number, end: number): string {
  return `\u2066${minutesToClock(start)}–${minutesToClock(end)}\u2069`;
}

export function weekdayOfDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Half-open [start, end): a session ending at 17:00 does not clash with one starting at 17:00. */
export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export type RoomBookingInput = {
  teamId: number;
  date: string;
  startTime: string;
  durationMinutes: number;
};

export type ValidBooking = { teamId: number; date: string; start: number; end: number };

/** Checks one session's fields. Returns the session in minutes, or a Hebrew error. */
export function validateBooking(room: RoomConfig, input: RoomBookingInput): { booking: ValidBooking } | { error: string } {
  if (!Number.isInteger(input.teamId) || input.teamId <= 0) return { error: "יש לבחור קבוצה" };
  if (!DATE_RE.test(input.date)) return { error: "תאריך לא חוקי" };
  if (!room.weekdays.includes(weekdayOfDate(input.date))) {
    return { error: `${room.label} לא ${room.feminine ? "פתוחה" : "פתוח"} ביום הזה` };
  }
  const start = clockToMinutes(input.startTime);
  if (start == null) return { error: "יש לבחור שעת התחלה" };
  if (start % 15 !== 0) return { error: "השעה צריכה להיות ברבעי שעה" };
  if (!(ROOM_DURATIONS as readonly number[]).includes(input.durationMinutes)) return { error: "משך לא חוקי" };
  const end = start + input.durationMinutes;
  if (start < room.openFrom) return { error: `${room.label} ${room.feminine ? "פתוחה" : "פתוח"} מ-${minutesToClock(room.openFrom)}` };
  if (end > room.openUntil) {
    return {
      error:
        room.openUntil >= 24 * 60
          ? "השיבוץ חייב להסתיים עד חצות"
          : `השיבוץ חייב להסתיים עד ${minutesToClock(room.openUntil)}`,
    };
  }
  return { booking: { teamId: input.teamId, date: input.date, start, end } };
}

export type ExistingBooking = {
  id: number;
  teamId: number;
  teamName: string;
  date: string;
  start: number;
  end: number;
};

/** The booking already holding the room at that time (one team at a time), if any. */
export function findRoomConflict(
  existing: ExistingBooking[],
  booking: { date: string; start: number; end: number },
  ignoreId?: number,
): ExistingBooking | null {
  return existing.find((other) => other.id !== ignoreId && other.date === booking.date && overlaps(other, booking)) ?? null;
}

export function conflictMessage(room: RoomConfig, other: ExistingBooking): string {
  return `${room.label} ${room.feminine ? "תפוסה" : "תפוס"} ${formatRange(other.start, other.end)} ע"י ${other.teamName}`;
}

/** Something else the same team does that day (training, game, the other room). */
export type TeamEvent = { teamId: number; date: string; start: number; end: number; label: string };

/** Warnings only: half a team in the gym while the rest trains can be on purpose. */
export function teamClashWarnings(events: TeamEvent[], booking: ValidBooking): string[] {
  return events
    .filter((event) => event.teamId === booking.teamId && event.date === booking.date && overlaps(event, booking))
    .sort((a, b) => a.start - b.start)
    .map((event) => `באותה שעה לקבוצה יש ${event.label} (${formatRange(event.start, event.end)})`);
}

export type OccurrenceReview = {
  date: string;
  /** Room taken: this date is skipped. */
  blockedBy: string | null;
  /** Saved anyway once the admin confirms. */
  warnings: string[];
};

/** Reviews every date of a one-off or recurring booking against the room and the team's day. */
export function reviewOccurrences(
  room: RoomConfig,
  dates: string[],
  base: Omit<RoomBookingInput, "date">,
  existing: ExistingBooking[],
  teamEvents: TeamEvent[],
  ignoreId?: number,
): { items: OccurrenceReview[]; error?: string } {
  const items: OccurrenceReview[] = [];
  for (const date of [...new Set(dates)].sort()) {
    const checked = validateBooking(room, { ...base, date });
    if ("error" in checked) {
      if (dates.length === 1) return { items: [], error: checked.error };
      // A closed weekday inside a series is skipped, not an error for the whole series.
      items.push({ date, blockedBy: checked.error, warnings: [] });
      continue;
    }
    const conflict = findRoomConflict(existing, checked.booking, ignoreId);
    items.push({
      date,
      blockedBy: conflict ? conflictMessage(room, conflict) : null,
      warnings: conflict ? [] : teamClashWarnings(teamEvents, checked.booking),
    });
  }
  return { items };
}

export function needsConfirmation(items: OccurrenceReview[]): boolean {
  return items.some((item) => item.blockedBy || item.warnings.length > 0);
}

export function datesToSave(items: OccurrenceReview[]): string[] {
  return items.filter((item) => !item.blockedBy).map((item) => item.date);
}

const SHORTEST_SESSION = Math.min(...ROOM_DURATIONS);

/** Quarter-hour minutes (0/15/30/45) at which a session can start in this hour and still fit the shortest length. */
export function startMinutes(room: RoomConfig, hour: number): number[] {
  return [0, 15, 30, 45].filter((minute) => {
    const start = hour * 60 + minute;
    return start >= room.openFrom && start + SHORTEST_SESSION <= room.openUntil;
  });
}

/** Start hours (00–23) the form offers for this room: only hours with at least one valid start. */
export function startHours(room: RoomConfig): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => startMinutes(room, hour).length > 0);
}

/**
 * True for Postgres' exclusion-constraint violation (code 23P01): another admin took the room a
 * moment ago. Drivers wrap errors differently (node-postgres, Netlify's driver, Drizzle's own
 * wrapper), so the code is looked for on the error and on its causes, and the constraint name
 * in the message is accepted as well.
 */
export function isOverlapError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const value = current as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
    if (value.code === "23P01") return true;
    if (typeof value.constraint === "string" && value.constraint.endsWith("_no_overlap")) return true;
    if (typeof value.message === "string" && /_no_overlap|23P01|conflicting key value violates exclusion constraint/.test(value.message)) {
      return true;
    }
    current = value.cause;
  }
  return false;
}
