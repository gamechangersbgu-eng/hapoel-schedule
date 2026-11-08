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

/** Everything that blocks a booking, in Hebrew, ready to show to the admin. Empty = OK. */
export function checkBooking(day: PitchDay, booking: ProposedBooking): string[] {
  const problems: string[] = [];
  const team = day.teams.find((item) => item.id === booking.teamId);
  const pitch = day.pitches.find((item) => item.id === booking.pitchId);
  const subdivision = day.subdivisions.find((item) => item.code === booking.subdivisionCode);
  if (!team) return ["יש לבחור קבוצה"];
  if (!pitch) return ["יש לבחור מגרש"];
  if (!subdivision || !SUBDIVISION_RANGE[booking.subdivisionCode]) return ["יש לבחור חלק מגרש"];

  const end = booking.start + booking.durationMinutes;
  const range = SUBDIVISION_RANGE[booking.subdivisionCode];

  if (pitch.isReservedLock) {
    problems.push(`${pitch.nameHe} משוריין ונעול לשיבוץ.`);
  }

  if (!team.allowedSubdivisions.includes(booking.subdivisionCode)) {
    const labels = day.subdivisions
      .filter((item) => team.allowedSubdivisions.includes(item.code))
      .map((item) => item.labelHe);
    problems.push(`${team.name} יכולה להתאמן רק ב: ${labels.join(", ")}.`);
  }

  if (team.ageBandCode === "football_school") {
    const weekday = weekdayOf(day.date);
    const windows = day.footballSchoolRules.filter((rule) => rule.weekdays.includes(weekday));
    const fits = windows.some((rule) => booking.start >= rule.start && end <= rule.end);
    if (!fits) {
      problems.push(
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
      problems.push(`${team.name} כבר משובצת באותו זמן (${when}).`);
      continue;
    }
    if (other.pitchId !== booking.pitchId) continue;
    if (!overlaps(range, SUBDIVISION_RANGE[other.subdivisionCode] ?? [0, 12])) continue;
    const where = day.subdivisions.find((item) => item.code === other.subdivisionCode)?.labelHe ?? "";
    problems.push(
      other.kind === "home_game"
        ? `משחק בית של ${other.teamName} ב${pitch.nameHe} (${when}).`
        : `${other.teamName} כבר ב${pitch.nameHe}, ${where} (${when}).`,
    );
  }

  return problems;
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
