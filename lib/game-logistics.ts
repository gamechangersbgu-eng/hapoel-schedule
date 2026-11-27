// Pure game-logistics rules: which departure the schedule shows, the home-pitch label,
// and the web-push body a manager sends to a team's subscribers. No database and no SMS.

import { isManager, type UserRole } from "@/lib/roles";

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** "HH:MM" or "HH:MM:SS" → "HH:MM". Anything else is not a clock time. */
export function normalizeClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = CLOCK_RE.exec(value.trim());
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

/**
 * Form field for an optional manual departure.
 * Empty stays empty (the suggestion is used). A non-empty invalid value is rejected.
 */
export function readManualDeparture(value: unknown): { ok: true; time: string | null } | { ok: false } {
  if (value == null) return { ok: true, time: null };
  if (typeof value !== "string") return { ok: false };
  if (!value.trim()) return { ok: true, time: null };
  const time = normalizeClock(value);
  if (!time) return { ok: false };
  return { ok: true, time };
}

/** Manual time wins. An empty manual falls back to the suggested clock, then to nothing. */
export function effectiveDepartureTime(
  manual: string | null | undefined,
  suggested: string | null | undefined,
): string | null {
  return normalizeClock(manual ?? "") ?? normalizeClock(suggested ?? "");
}

/** Pitch line for a home game that has a pitch set. Away games and empty pitches stay blank. */
export function homeGamePitchText(slot: { type: string; pitchName?: string | null }): string | null {
  if (slot.type !== "home_game") return null;
  const name = slot.pitchName?.trim();
  if (!name) return null;
  return `מגרש ${name}`;
}

/** TV chip: home game, opponent, and the pitch when one is set. */
export function tvHomeGameLine(slot: {
  type: string;
  opponent?: string | null;
  pitchName?: string | null;
}): string | null {
  if (slot.type !== "home_game") return null;
  const who = slot.opponent?.trim() ? `בית · ${slot.opponent.trim()}` : "משחק בית";
  const pitch = homeGamePitchText(slot);
  return pitch ? `${who} · ${pitch}` : who;
}

export function awayDepartureWarning(input: {
  cityId: number | null;
  departureTime: string | null;
}): string | null {
  if (!input.cityId && !input.departureTime) return "לא נבחרה עיר, ולכן אין שעת יציאה";
  if (!input.cityId) return "לא נבחרה עיר";
  if (!input.departureTime) return "אין שעת יציאה";
  return null;
}

/** Submit button value that saves the game and sends the coach web-push. */
export const COACH_UPDATE_INTENT = "notify-coach";

export const COACH_UPDATE_TITLE = "עדכון למאמן";

export function coachUpdateRequested(value: unknown): boolean {
  return value === COACH_UPDATE_INTENT;
}

/** Owner and admin (managers). A coach or physio login cannot send this. */
export function canNotifyCoach(role: UserRole): boolean {
  return isManager(role);
}

export type CoachUpdateNotice = {
  teamName: string;
  kind: "home_game" | "away_game";
  dateLabel: string;
  kickoff: string | null;
  opponent: string | null;
  pitchName: string | null;
  medicName: string | null;
  medicPhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
  cityName: string | null;
  departureTime: string | null;
};

function personLine(name: string | null, phone: string | null, empty: string): string {
  const label = [name?.trim(), phone?.trim()].filter(Boolean).join(" ");
  return label || empty;
}

/** Hebrew web-push body. Home carries pitch + medic. Away carries driver + departure. */
export function coachUpdateBody(notice: CoachUpdateNotice): string {
  const kind = notice.kind === "home_game" ? "משחק בית" : "משחק חוץ";
  const team = notice.teamName.trim() || "הקבוצה";
  const when = [notice.dateLabel.trim(), notice.kickoff?.trim()].filter(Boolean).join(" ");
  const parts = [`${kind} של ${team}${when ? ` ב-${when}` : ""}`];
  const opponent = notice.opponent?.trim();
  if (opponent) parts.push(`נגד ${opponent}`);
  if (notice.kind === "home_game") {
    const pitch = notice.pitchName?.trim();
    parts.push(pitch ? `מגרש ${pitch}` : "מגרש: לא נבחר");
    parts.push(`חובש: ${personLine(notice.medicName, notice.medicPhone, "לא שובץ")}`);
  } else {
    const city = notice.cityName?.trim();
    if (city) parts.push(city);
    parts.push(`נהג: ${personLine(notice.driverName, notice.driverPhone, "לא שובץ")}`);
    const leave = normalizeClock(notice.departureTime ?? "");
    parts.push(leave ? `יציאה מבאר שבע: ${leave}` : "יציאה מבאר שבע: לא נקבעה");
  }
  return `עדכון למאמן: ${parts.join(" · ")}`;
}

export function coachNotifyPlan(input: {
  role: UserRole;
  intent: unknown;
  notice: CoachUpdateNotice;
}): { notify: false } | { notify: true; title: string; body: string } {
  if (!coachUpdateRequested(input.intent) || !canNotifyCoach(input.role)) return { notify: false };
  return { notify: true, title: COACH_UPDATE_TITLE, body: coachUpdateBody(input.notice) };
}

export type CoachPushCounts = {
  subscribers: number;
  sent: number;
  failed: number;
  skipped: null | "no_teams" | "no_vapid" | "no_subscribers" | "error";
};

export function coachUpdateStatus(result: CoachPushCounts): "sent" | "none" | "vapid" | "failed" | "error" {
  if (result.skipped === "no_vapid") return "vapid";
  if (result.skipped === "error") return "error";
  if (result.skipped === "no_subscribers" || result.skipped === "no_teams" || result.subscribers === 0) return "none";
  if (result.sent > 0) return "sent";
  return "failed";
}

/** Banner after the games page reloads. Unknown codes stay quiet. */
export function coachUpdatePageMessage(
  status: string | undefined,
  subscribers: number,
  sent: number,
): string | null {
  const subs = Number.isInteger(subscribers) && subscribers >= 0 ? subscribers : 0;
  const delivered = Number.isInteger(sent) && sent >= 0 ? sent : 0;
  if (status === "vapid") return "המשחק נשמר. שליחת העדכון למאמן דולגה כי התראות הדפדפן לא מוגדרות.";
  if (status === "none") return "המשחק נשמר. אין מנויים רשומים להתראת הקבוצה.";
  if (status === "error") return "המשחק נשמר. שליחת העדכון למאמן נכשלה.";
  if (status === "failed") return `המשחק נשמר. העדכון לא נשלח (${subs} מנויים).`;
  if (status === "sent") {
    if (delivered === subs) return `נשלח עדכון למאמן (${delivered} מנויים).`;
    return `נשלח עדכון למאמן ל-${delivered} מתוך ${subs} מנויים.`;
  }
  return null;
}
