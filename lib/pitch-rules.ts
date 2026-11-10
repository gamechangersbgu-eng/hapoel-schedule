// Pure pitch-board rules (no database access), shared by the server and the booking form.
import { absenceLabel, absenceOn, type CoachInfo } from "@/lib/coaches";

/** Section of the pitch along its length, in twelfths (north = 0, south = 12). */
export const SUBDIVISION_RANGE: Record<string, [number, number]> = {
  whole: [0, 12],
  half_north: [0, 6],
  half_south: [6, 12],
  third_north: [0, 4],
  third_center: [4, 8],
  third_south: [8, 12],
  quarter_north_1: [0, 3],
  quarter_north_2: [3, 6],
  quarter_south_1: [6, 9],
  quarter_south_2: [9, 12],
};

/** Short labels for boards and screens. Whole pitch has none (nothing to add). */
export const SUBDIVISION_SHORT: Record<string, string> = {
  whole: "מלא",
  half_north: "½ צפון",
  half_south: "½ דרום",
  third_north: "⅓ צפון",
  third_center: "⅓ מרכז",
  third_south: "⅓ דרום",
  quarter_north_1: "¼ צפון 1",
  quarter_north_2: "¼ צפון 2",
  quarter_south_1: "¼ דרום 1",
  quarter_south_2: "¼ דרום 2",
};

/** Used when an older booking has no duration saved. */
export const DEFAULT_TRAINING_MINUTES = 90;
/** How long a home game blocks its pitch on the board (warm-up + match). */
export const HOME_GAME_BLOCK_MINUTES = 120;
/** Spec: at least two hours between home games. */
export const MIN_GAP_BETWEEN_HOME_GAMES = 120;

/** Earliest possible board start (rotation 5 starts 08:30). */
export const BOARD_START_MINUTES = 8 * 60;
/** Usual board start: weekday trainings are in the afternoon. */
export const AFTERNOON_START_MINUTES = 15 * 60;
export const BOARD_END_MINUTES = 22 * 60;

/** Afternoons only, unless something is booked earlier that day. */
export function boardStartFor(day: { bookings: { start: number }[] }) {
  const earliest = Math.min(AFTERNOON_START_MINUTES, ...day.bookings.map((item) => item.start));
  return Math.max(BOARD_START_MINUTES, Math.floor(earliest / 60) * 60);
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type BoardBooking = {
  slotId: number;
  kind: "training" | "home_game";
  teamId: number;
  teamName: string;
  pitchId: number;
  subdivisionCode: string;
  start: number;
  end: number;
  durationMinutes: number | null;
  rotationTemplateId: number | null;
  note: string | null;
  opponent: string | null;
  /** "active" or "cancelled". Cancelled bookings stay on the board but free the pitch. */
  status: string;
  statusNote: string | null;
  substituteStaffId: number | null;
  /** Recurring training this booking belongs to, when it was saved as part of a series. */
  seriesId: number | null;
};

export type BoardTeam = {
  id: number;
  name: string;
  ageBandCode: string | null;
  allowedSubdivisions: string[];
};

export type BoardPitch = {
  id: number;
  code: string;
  nameHe: string;
  colorKey: string;
  surfaceType: string;
  isReservedLock: boolean;
  allowsHomeGames: boolean;
};

export type BoardRotation = { id: number; number: number; label: string; times: string[] };

/**
 * Club rotations (סבב 1–5) and the usual training lengths.
 * The database is seeded from these. Negative ids in `fallbackRotations` are display-only.
 */
export const ROTATION_PRESETS: {
  number: number;
  weekday: number | null;
  label: string;
  times: string[];
}[] = [
  { number: 1, weekday: 0, label: "סבב 1", times: ["16:30"] },
  { number: 2, weekday: null, label: "סבב 2", times: ["16:30", "18:30"] },
  { number: 3, weekday: null, label: "סבב 3", times: ["16:00", "17:45", "19:15"] },
  { number: 4, weekday: null, label: "סבב 4", times: ["15:30", "17:00", "18:30", "20:00"] },
  { number: 5, weekday: null, label: "סבב 5", times: ["08:30", "10:00", "11:30", "13:00", "14:30"] },
];

export const DURATION_PRESETS: { minutes: number; labelHe: string }[] = [
  { minutes: 60, labelHe: "שעה" },
  { minutes: 105, labelHe: "שעה 45 דקות" },
  { minutes: 120, labelHe: "שעתיים" },
];

export function fallbackRotations(): BoardRotation[] {
  return ROTATION_PRESETS.map((item) => ({
    id: -item.number,
    number: item.number,
    label: item.label,
    times: [...item.times],
  }));
}

/** "16:30" or "16:30:00" → "16:30". Empty when the value is not a clock time. */
export function normalizeClock(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Minutes from start to end. 0 when either clock is missing or the end is not later. */
export function durationBetween(start: string, end: string) {
  const from = normalizeClock(start);
  const to = normalizeClock(end);
  if (!from || !to) return 0;
  const minutes = toMinutes(to) - toMinutes(from);
  return minutes > 0 ? minutes : 0;
}

export const QUARTER_MINUTES = 15;

/** 06:00–23:45 in 15-minute steps. Forms use these instead of a free-typed clock. */
export const QUARTER_HOUR_TIMES: readonly string[] = Array.from({ length: 72 }, (_, index) =>
  toTime(6 * 60 + index * QUARTER_MINUTES),
);

export function isQuarterHour(time: string) {
  const clock = normalizeClock(time);
  if (!clock) return false;
  return toMinutes(clock) % QUARTER_MINUTES === 0;
}

/** Nearest 15-minute clock, clamped to 00:00–23:45. Empty when `time` is not a clock. */
export function roundToQuarterHour(time: string) {
  const clock = normalizeClock(time);
  if (!clock) return "";
  const rounded = Math.round(toMinutes(clock) / QUARTER_MINUTES) * QUARTER_MINUTES;
  const clamped = Math.min(23 * 60 + 45, Math.max(0, rounded));
  return toTime(clamped);
}

export function durationLabelHe(minutes: number) {
  const preset = DURATION_PRESETS.find((item) => item.minutes === minutes);
  if (preset) return preset.labelHe;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} דקות`;
  if (rest === 0) return hours === 1 ? "שעה" : hours === 2 ? "שעתיים" : `${hours} שעות`;
  if (hours === 1) return `שעה ו-${rest} דקות`;
  return `${hours} שעות ו-${rest} דקות`;
}

export type FootballSchoolRule = {
  weekdays: number[];
  start: number;
  end: number;
  allowedSubdivisions: string[];
  biweekly: boolean;
  noteHe: string | null;
};

export type PitchDay = {
  date: string;
  pitches: BoardPitch[];
  subdivisions: { code: string; labelHe: string }[];
  durations: { minutes: number; labelHe: string }[];
  rotations: BoardRotation[];
  teams: BoardTeam[];
  footballSchoolRules: FootballSchoolRule[];
  bookings: BoardBooking[];
  coaches: CoachInfo[];
};

function overlaps(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}

export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

const WEEKDAY_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export type ProposedBooking = {
  slotId?: number;
  teamId: number;
  pitchId: number;
  subdivisionCode: string;
  start: number;
  durationMinutes: number;
};

export type BookingConflict = {
  slotId: number;
  kind: "training" | "home_game";
  summary: string;
  /** A home game is not replaced when a training series overlaps it. */
  overridable: boolean;
};

/** Rule violations (`hard`) cannot be overridden. `conflicts` are overlapping bookings. */
export function classifyBooking(
  day: PitchDay,
  booking: ProposedBooking,
): { hard: string[]; conflicts: BookingConflict[] } {
  const hard: string[] = [];
  const conflicts: BookingConflict[] = [];
  const team = day.teams.find((item) => item.id === booking.teamId);
  const pitch = day.pitches.find((item) => item.id === booking.pitchId);
  const subdivision = day.subdivisions.find((item) => item.code === booking.subdivisionCode);
  if (!team) return { hard: ["יש לבחור קבוצה"], conflicts };
  if (!pitch) return { hard: ["יש לבחור מגרש"], conflicts };
  if (!subdivision || !SUBDIVISION_RANGE[booking.subdivisionCode]) return { hard: ["יש לבחור חלק מגרש"], conflicts };

  const end = booking.start + booking.durationMinutes;
  const range = SUBDIVISION_RANGE[booking.subdivisionCode];

  if (pitch.isReservedLock) {
    hard.push(`${pitch.nameHe} משוריין ונעול לשיבוץ.`);
  }

  if (!team.allowedSubdivisions.includes(booking.subdivisionCode)) {
    const labels = day.subdivisions
      .filter((item) => team.allowedSubdivisions.includes(item.code))
      .map((item) => item.labelHe);
    hard.push(`${team.name} יכולה להתאמן רק ב: ${labels.join(", ")}.`);
  }

  if (team.ageBandCode === "football_school") {
    const weekday = weekdayOf(day.date);
    const windows = day.footballSchoolRules.filter((rule) => rule.weekdays.includes(weekday));
    const fits = windows.some((rule) => booking.start >= rule.start && end <= rule.end);
    if (!fits) {
      hard.push(
        windows.length
          ? `בית ספר לכדורגל ביום ${WEEKDAY_HE[weekday]}: רק בין ${windows
              .map((rule) => `${toTime(rule.start)}–${toTime(rule.end)}`)
              .join(" או ")}.`
          : `בית ספר לכדורגל לא פעיל ביום ${WEEKDAY_HE[weekday]}.`,
      );
    }
  }

  for (const other of day.bookings) {
    if (other.slotId === booking.slotId || other.status === "cancelled") continue;
    if (!overlaps([booking.start, end], [other.start, other.end])) continue;
    const when = `${toTime(other.start)}–${toTime(other.end)}`;
    if (other.teamId === booking.teamId) {
      conflicts.push({
        slotId: other.slotId,
        kind: other.kind,
        summary: `${team.name} כבר משובצת באותו זמן (${when}).`,
        overridable: other.kind === "training",
      });
      continue;
    }
    if (other.pitchId !== booking.pitchId) continue;
    if (!overlaps(range, SUBDIVISION_RANGE[other.subdivisionCode] ?? [0, 12])) continue;
    const where = day.subdivisions.find((item) => item.code === other.subdivisionCode)?.labelHe ?? "";
    conflicts.push({
      slotId: other.slotId,
      kind: other.kind,
      summary:
        other.kind === "home_game"
          ? `משחק בית של ${other.teamName} ב${pitch.nameHe} (${when}).`
          : `${other.teamName} כבר ב${pitch.nameHe}, ${where} (${when}).`,
      overridable: other.kind === "training",
    });
  }

  return { hard, conflicts };
}

/** Everything that blocks a booking, in Hebrew, ready to show to the admin. Empty = OK. */
export function checkBooking(day: PitchDay, booking: ProposedBooking): string[] {
  const { hard, conflicts } = classifyBooking(day, booking);
  return [...hard, ...conflicts.map((conflict) => conflict.summary)];
}

/** Club-wide warnings for the day (shown on the board, not blocking). */
export function dayWarnings(day: PitchDay): string[] {
  const games = day.bookings
    .filter((item) => item.kind === "home_game" && item.status !== "cancelled")
    .sort((a, b) => a.start - b.start);
  const warnings: string[] = [];
  for (let i = 1; i < games.length; i += 1) {
    const gap = games[i].start - games[i - 1].start;
    if (gap < MIN_GAP_BETWEEN_HOME_GAMES) {
      warnings.push(
        `פחות משעתיים בין משחקי הבית של ${games[i - 1].teamName} (${toTime(games[i - 1].start)}) ו${games[i].teamName} (${toTime(games[i].start)}).`,
      );
    }
  }
  return warnings;
}

/** The coaches responsible for a booking: the substitute if one was set, otherwise the team's coaches. */
export function coachesFor(day: PitchDay, booking: { teamId: number; substituteStaffId: number | null }) {
  if (booking.substituteStaffId) return day.coaches.filter((coach) => coach.id === booking.substituteStaffId);
  return day.coaches.filter((coach) => coach.teamIds.includes(booking.teamId));
}

/** Coach problems on this day: absence, not a work day, or two teams at the same time. Not blocking. */
export function coachWarnings(day: PitchDay): { slotId: number; message: string }[] {
  const weekday = weekdayOf(day.date);
  const active = day.bookings.filter((item) => item.kind === "training" && item.status !== "cancelled");
  const warnings: { slotId: number; message: string }[] = [];
  for (const booking of active) {
    const when = `${booking.teamName} ${toTime(booking.start)}`;
    for (const coach of coachesFor(day, booking)) {
      const absence = absenceOn(coach, day.date);
      if (absence) {
        warnings.push({
          slotId: booking.slotId,
          message: `${coach.name} ב${absenceLabel(absence.type)}${absence.note ? ` (${absence.note})` : ""}, ויש לו אימון: ${when}. אפשר לסמן מאמן מחליף או ביטול.`,
        });
      } else if (coach.workDays.length && !coach.workDays.includes(weekday)) {
        warnings.push({ slotId: booking.slotId, message: `${coach.name} לא עובד ביום ${WEEKDAY_HE[weekday]}, ויש לו אימון: ${when}.` });
      }
      for (const other of active) {
        if (other.slotId <= booking.slotId || other.teamId === booking.teamId) continue;
        if (!overlaps([booking.start, booking.end], [other.start, other.end])) continue;
        if (coachesFor(day, other).some((item) => item.id === coach.id)) {
          warnings.push({
            slotId: booking.slotId,
            message: `${coach.name} משובץ בו זמנית ל${booking.teamName} (${toTime(booking.start)}) ול${other.teamName} (${toTime(other.start)}).`,
          });
        }
      }
    }
  }
  return warnings;
}
