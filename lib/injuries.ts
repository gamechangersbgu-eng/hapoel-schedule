// Injury tracking and physio treatments: statuses, the moves allowed between them, and the
// checks used by the pages and actions. No database access here, so it is covered by tests.

import { parseISODate } from "./week";

export const INJURY_STATUSES = ["injured", "treatment", "gradual_return", "fit"] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number];

export const INJURY_STATUS_LABELS: Record<InjuryStatus, string> = {
  injured: "פצוע",
  treatment: "בטיפול",
  gradual_return: "חזרה הדרגתית",
  fit: "כשיר",
};

/** Short line under each status, shown to managers and coaches. */
export const INJURY_STATUS_HINTS: Record<InjuryStatus, string> = {
  injured: "לא משתתף באימונים",
  treatment: "בטיפולי פיזיו",
  gradual_return: "אימון בהגבלה",
  fit: "הפציעה נסגרה",
};

/** Closed list on purpose: no diagnoses in this system, only where it hurts. */
export const BODY_PARTS = [
  "ברך",
  "קרסול",
  "ירך אחורית",
  "ירך קדמית",
  "מפשעה",
  "שוק",
  "כף רגל",
  "גב",
  "כתף",
  "יד",
  "ראש",
  "אחר",
] as const;

export const NOTE_MAX_LENGTH = 200;

export function isInjuryStatus(value: unknown): value is InjuryStatus {
  return (INJURY_STATUSES as readonly unknown[]).includes(value);
}

export function isBodyPart(value: unknown): value is (typeof BODY_PARTS)[number] {
  return (BODY_PARTS as readonly unknown[]).includes(value);
}

export function isOpenStatus(status: InjuryStatus) {
  return status !== "fit";
}

/**
 * Moving forward is always allowed (a light knock can go straight to "כשיר").
 * Moving back only from "חזרה הדרגתית" to "בטיפול" (a setback). A closed injury stays closed:
 * a new injury of the same player is a new row.
 */
export function canMoveInjury(from: InjuryStatus, to: InjuryStatus) {
  if (from === to || from === "fit") return false;
  const forward = INJURY_STATUSES.indexOf(to) > INJURY_STATUSES.indexOf(from);
  return forward || (from === "gradual_return" && to === "treatment");
}

export function nextStatuses(from: InjuryStatus): InjuryStatus[] {
  return INJURY_STATUSES.filter((to) => canMoveInjury(from, to));
}

export function isISODate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's date in Israel (the server itself runs in UTC). */
export function todayInIsrael(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from one date to another (YYYY-MM-DD). Never negative. */
export function daysBetween(fromISO: string, toISO: string) {
  const diff = Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/** Days out of play: until today for an open injury, until it closed for a closed one. */
export function daysOut(injury: { injuredAt: string; closedAt: string | null }, today: string) {
  const end = injury.closedAt ? injury.closedAt.slice(0, 10) : today;
  return daysBetween(injury.injuredAt, end);
}

/** Expected return date has passed and the player is still not fit. */
export function isReturnOverdue(injury: { status: InjuryStatus; expectedReturn: string | null }, today: string) {
  return isOpenStatus(injury.status) && Boolean(injury.expectedReturn) && injury.expectedReturn! < today;
}

type SortableInjury = {
  status: InjuryStatus;
  expectedReturn: string | null;
  injuredAt: string;
  playerName: string;
};

/** Open first; among them overdue first, then nearest expected return; no date last. */
export function sortInjuries<T extends SortableInjury>(rows: T[], today: string): T[] {
  return [...rows].sort((a, b) => {
    const openA = isOpenStatus(a.status) ? 0 : 1;
    const openB = isOpenStatus(b.status) ? 0 : 1;
    if (openA !== openB) return openA - openB;
    if (openA === 1) return b.injuredAt.localeCompare(a.injuredAt);
    const lateA = isReturnOverdue(a, today) ? 0 : 1;
    const lateB = isReturnOverdue(b, today) ? 0 : 1;
    if (lateA !== lateB) return lateA - lateB;
    if (a.expectedReturn !== b.expectedReturn) {
      if (!a.expectedReturn) return 1;
      if (!b.expectedReturn) return -1;
      return a.expectedReturn.localeCompare(b.expectedReturn);
    }
    return a.playerName.localeCompare(b.playerName, "he");
  });
}

/** What a coach may see about their own players: no body part, notes or treatments. */
export type CoachInjuryView = {
  id: number;
  playerName: string;
  teamName: string;
  status: InjuryStatus;
  expectedReturn: string | null;
};

export function toCoachView(row: CoachInjuryView & Record<string, unknown>): CoachInjuryView {
  return {
    id: row.id,
    playerName: row.playerName,
    teamName: row.teamName,
    status: row.status,
    expectedReturn: row.expectedReturn,
  };
}

// ---- Physio treatments ----

export const SESSION_STATUSES = ["scheduled", "done", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: "מתוכנן",
  done: "בוצע",
  cancelled: "בוטל",
};

export const SESSION_DURATIONS = [20, 30, 45, 60] as const;
export const SESSION_DAY_START = 7 * 60;
export const SESSION_DAY_END = 22 * 60;

export function isSessionStatus(value: unknown): value is SessionStatus {
  return (SESSION_STATUSES as readonly unknown[]).includes(value);
}

/** "17:30" → 1050. Null for anything that is not a time of day. */
export function toMinutes(time: string | null | undefined) {
  const match = /^(\d{2}):(\d{2})$/.exec(time ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Start times offered in the form: every 15 minutes, 07:00 to the last start that ends by 22:00. */
export function sessionStartTimes(step = 15) {
  const times: string[] = [];
  for (let t = SESSION_DAY_START; t + SESSION_DURATIONS[0] <= SESSION_DAY_END; t += step) times.push(minutesToTime(t));
  return times;
}

export type SessionSlot = {
  id?: number;
  physioUserId: number | null;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: SessionStatus;
};

/** Hebrew error for a treatment that cannot be scheduled, or null when it is fine. */
export function validateSession(input: { date: string; startTime: string; durationMinutes: number }) {
  if (!isISODate(input.date)) return "יש לבחור תאריך";
  const start = toMinutes(input.startTime);
  if (start == null) return "יש לבחור שעה";
  if (!(SESSION_DURATIONS as readonly number[]).includes(input.durationMinutes)) return "משך טיפול לא תקין";
  if (start < SESSION_DAY_START || start + input.durationMinutes > SESSION_DAY_END) {
    return "טיפולים נקבעים בין 07:00 ל-22:00";
  }
  return null;
}

/** An existing treatment of the same physio that overlaps the new one (cancelled ones do not count). */
export function physioClash(existing: SessionSlot[], candidate: SessionSlot): SessionSlot | null {
  if (candidate.physioUserId == null) return null;
  const start = toMinutes(candidate.startTime);
  if (start == null) return null;
  const end = start + candidate.durationMinutes;
  for (const other of existing) {
    if (other.id != null && other.id === candidate.id) continue;
    if (other.status === "cancelled") continue;
    if (other.physioUserId !== candidate.physioUserId || other.date !== candidate.date) continue;
    const otherStart = toMinutes(other.startTime);
    if (otherStart == null) continue;
    if (start < otherStart + other.durationMinutes && otherStart < end) return other;
  }
  return null;
}

// ---- Personal coach of a player ----

export type TeamCoachLink = { id: number; teamId: number; staffId: number | null; isPrimary: boolean };

/** The coach a player gets by default: the team's head coach (primary link), else any linked coach. */
export function defaultCoachForTeam(links: TeamCoachLink[], teamId: number): number | null {
  const candidates = links
    .filter((link) => link.teamId === teamId && link.staffId != null)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.id - b.id);
  return candidates[0]?.staffId ?? null;
}
