// Pure rules for pitch mowing + marking tasks (no database access). See MAINTENANCE.md.

/**
 * Pitches the grounds team mows and marks (natural grass). Vasermil 1 is synthetic and
 * Vasermil 4 is the football school's pitch: no reminders for either.
 */
export const MAINTAINED_PITCH_CODES = ["vasermil_2", "vasermil_3"] as const;
export type MaintainedPitchCode = (typeof MAINTAINED_PITCH_CODES)[number];

/** The weekly task is only for Vasermil 2, which does not host home games. */
export const WEEKLY_PITCH_CODE: MaintainedPitchCode = "vasermil_2";

/** Calendar days before the game that the task shows up (game on Sunday -> Thursday). */
export const DAYS_BEFORE_GAME = 2;

/** Weekly Vasermil 2 window: 120 minutes between 08:00 and 15:00, Sunday to Thursday. */
export const WEEKLY_TASK_MINUTES = 120;
export const WORKDAY_START = 8 * 60;
export const WORKDAY_END = 15 * 60;
export const WEEKLY_WEEKDAYS = [0, 1, 2, 3, 4] as const;

/** Training without a stored duration counts as this long (same as the pitch board). */
export const DEFAULT_TRAINING_MINUTES = 90;

/** How far ahead games are scanned on each sync. */
export const HORIZON_DAYS = 16;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isMaintainedPitch(code: string | null | undefined): code is MaintainedPitchCode {
  return (MAINTAINED_PITCH_CODES as readonly string[]).includes(code ?? "");
}

/** UTC-safe date arithmetic on YYYY-MM-DD strings. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function sundayOfISO(iso: string): string {
  return addDays(iso, -weekdayOfISO(iso));
}

/** Today's date in Israel, whatever the server's time zone is (Netlify runs in UTC). */
export function israelToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * The scraper writes the association's venue into the note, e.g. "יריב · באר שבע וסרמיל 1".
 * Returns "vasermil_<n>" when the note names a Vasermil pitch.
 */
export function pitchCodeFromNote(note: string | null | undefined): string | null {
  const match = note?.match(/וסרמיל\s*([1-4])(?!\d)/);
  return match ? `vasermil_${match[1]}` : null;
}

/** Temporary manual pitch for a home game the association gave no venue for. "other" = not on Vasermil. */
export const OVERRIDE_CODES = ["vasermil_1", "vasermil_2", "vasermil_3", "vasermil_4", "other"] as const;
export type OverrideCode = (typeof OVERRIDE_CODES)[number];

export function isOverrideCode(value: unknown): value is OverrideCode {
  return (OVERRIDE_CODES as readonly unknown[]).includes(value);
}

export const IFA_SOURCE = "ifa_scraper";

/**
 * The venue the scraper appended to the note: "[גביע · ]<opponent>[ · <venue>]".
 * Null when the association gave no venue. Only read for scraper rows, so the opponent's
 * stored name is not compared: an admin renaming the opponent must not hide the venue.
 */
export function venueFromNote(note: string | null | undefined): string | null {
  const parts = (note ?? "").split(" · ").map((part) => part.trim()).filter(Boolean);
  if (parts[0] === "גביע") parts.shift();
  if (parts.length < 2) return null;
  return parts.slice(1).join(" · ");
}

type PitchSources = {
  /** Pitch an admin set on the game (`slot_game_details.pitch_id`). */
  pitchCode: string | null;
  note: string | null;
  opponent?: string | null;
  /** `slot_game_details.source`, e.g. "ifa_scraper". */
  source?: string | null;
  /** Temporary manual pitch from the maintenance screen. */
  overrideCode?: string | null;
};

/** The game's place is known from the admin's pitch or the association's venue (not from a temporary pick). */
export function officialVenueKnown(game: PitchSources): boolean {
  if (game.pitchCode) return true;
  if (pitchCodeFromNote(game.note)) return true;
  return game.source === IFA_SOURCE && venueFromNote(game.note) !== null;
}

/**
 * Admin's pitch, else the association's venue, else the temporary manual pick.
 * A known venue that is not Vasermil returns null (no task), whatever the temporary pick says.
 */
export function resolveGamePitch(game: PitchSources): string | null {
  if (game.pitchCode) return game.pitchCode;
  const fromNote = pitchCodeFromNote(game.note);
  if (fromNote) return fromNote;
  if (officialVenueKnown(game)) return null;
  return game.overrideCode && game.overrideCode !== "other" ? game.overrideCode : null;
}

export type GameForMaintenance = {
  slotId: number;
  date: string;
  type: string;
  status: string;
  kickoff: string | null;
  teamName: string;
  ageBandLabel: string | null;
  opponent: string | null;
  /** Code of `slot_game_details.pitch_id`, when an admin set one. */
  pitchCode: string | null;
  note: string | null;
  source?: string | null;
  overrideCode?: string | null;
};

function isActiveHomeGame(game: GameForMaintenance) {
  return game.type === "home_game" && game.status === "active" && ISO.test(game.date);
}

/** Active home games whose place nobody official has given yet (the temporary column). */
export function unknownVenueGames(games: GameForMaintenance[]): GameForMaintenance[] {
  return games
    .filter((game) => isActiveHomeGame(game) && !officialVenueKnown(game))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));
}

/** Temporary picks to drop: the association (or an admin on the games screen) has now given the place. */
export function overridesToClear(games: GameForMaintenance[]): number[] {
  return games.filter((game) => game.overrideCode && officialVenueKnown(game)).map((game) => game.slotId);
}

/** Unknown-venue games with no temporary pick whose task would already be showing. */
export function urgentUnknownCount(games: GameForMaintenance[], today: string): number {
  return unknownVenueGames(games).filter(
    (game) => !game.overrideCode && addDays(game.date, -DAYS_BEFORE_GAME) <= today && game.date >= today,
  ).length;
}

export type PlannedTask = {
  pitchCode: MaintainedPitchCode;
  kind: "game_prep" | "weekly";
  /** Game date for game_prep, the week's Sunday for weekly. Unique with pitch + kind. */
  periodKey: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  showFrom: string;
  slotIds: number[];
  summary: string;
};

function gameLine(game: GameForMaintenance): string {
  const parts = [game.kickoff ?? "שעה לא ידועה", game.teamName];
  if (game.ageBandLabel) parts.push(`(${game.ageBandLabel})`);
  if (game.opponent) parts.push(`נגד ${game.opponent}`);
  return parts.join(" ");
}

/** One task per pitch and date for active league home games on Vasermil 1-3. */
export function planGamePrepTasks(games: GameForMaintenance[]): PlannedTask[] {
  const groups = new Map<string, { pitchCode: MaintainedPitchCode; date: string; games: GameForMaintenance[] }>();
  for (const game of games) {
    if (!isActiveHomeGame(game)) continue;
    const pitchCode = resolveGamePitch(game);
    if (!isMaintainedPitch(pitchCode)) continue;
    const key = `${pitchCode}|${game.date}`;
    const group = groups.get(key) ?? { pitchCode, date: game.date, games: [] };
    group.games.push(game);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const sorted = [...group.games].sort(
        (a, b) => (a.kickoff ?? "99:99").localeCompare(b.kickoff ?? "99:99") || a.slotId - b.slotId,
      );
      return {
        pitchCode: group.pitchCode,
        kind: "game_prep" as const,
        periodKey: group.date,
        date: group.date,
        startTime: sorted[0].kickoff,
        endTime: null,
        showFrom: addDays(group.date, -DAYS_BEFORE_GAME),
        slotIds: sorted.map((game) => game.slotId),
        summary: sorted.map(gameLine).join(" · "),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.pitchCode.localeCompare(b.pitchCode));
}

export type BusyRange = { start: number; end: number };

/** First start of a free `minutes` window inside [dayStart, dayEnd], on a quarter hour. */
export function findFreeWindow(
  busy: BusyRange[],
  minutes = WEEKLY_TASK_MINUTES,
  dayStart = WORKDAY_START,
  dayEnd = WORKDAY_END,
): number | null {
  const sorted = [...busy].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  for (let start = dayStart; start + minutes <= dayEnd; start += 15) {
    const end = start + minutes;
    if (!sorted.some((r) => r.start < end && start < r.end)) return start;
  }
  return null;
}

/**
 * Weekly Vasermil 2 task: the first Sunday-Thursday from `fromDate` on with a free window.
 * Null when every working day of that week is already past (nothing left to plan).
 */
export function planWeeklyTask(
  weekStart: string,
  busyByDate: Map<string, BusyRange[]>,
  fromDate: string = weekStart,
): PlannedTask | null {
  const days = WEEKLY_WEEKDAYS.map((weekday) => addDays(weekStart, weekday)).filter((date) => date >= fromDate);
  if (days.length === 0) return null;
  for (const date of days) {
    const start = findFreeWindow(busyByDate.get(date) ?? []);
    if (start == null) continue;
    return {
      pitchCode: WEEKLY_PITCH_CODE,
      kind: "weekly",
      periodKey: weekStart,
      date,
      startTime: toClock(start),
      endTime: toClock(start + WEEKLY_TASK_MINUTES),
      showFrom: addDays(date, -DAYS_BEFORE_GAME),
      slotIds: [],
      summary: "כיסוח וסימון שבועי",
    };
  }
  return {
    pitchCode: WEEKLY_PITCH_CODE,
    kind: "weekly",
    periodKey: weekStart,
    date: days[0],
    startTime: null,
    endTime: null,
    showFrom: addDays(days[0], -DAYS_BEFORE_GAME),
    slotIds: [],
    summary: "כיסוח וסימון שבועי · לא נמצא חלון פנוי השבוע",
  };
}

export type StoredTask = {
  id: number;
  pitchCode: string;
  kind: string;
  periodKey: string;
  date: string;
  status: string;
};

export type TaskChanges = {
  /** Planned tasks to insert or update (an obsolete one comes back as open). */
  upserts: PlannedTask[];
  /** Ids of open game tasks whose games are gone. */
  obsoleteIds: number[];
};

/**
 * Compares the plan with stored tasks from `today` on.
 * Done tasks are never moved or reopened. Overdue open tasks (their day passed) stay
 * where they are, in red, until an admin marks them done. Other open tasks follow the plan.
 */
export function reconcileTasks(planned: PlannedTask[], stored: StoredTask[], today: string): TaskChanges {
  const keyOf = (t: { pitchCode: string; kind: string; periodKey: string }) => `${t.pitchCode}|${t.kind}|${t.periodKey}`;
  const storedByKey = new Map(stored.map((task) => [keyOf(task), task]));
  const plannedKeys = new Set(planned.map(keyOf));

  const upserts = planned.filter((task) => {
    const existing = storedByKey.get(keyOf(task));
    if (!existing) return true;
    if (existing.status === "done") return false;
    return !(existing.status === "open" && existing.date < today);
  });
  const obsoleteIds = stored
    .filter(
      (task) =>
        task.kind === "game_prep" &&
        task.status === "open" &&
        task.periodKey >= today &&
        !plannedKeys.has(keyOf(task)),
    )
    .map((task) => task.id);
  return { upserts, obsoleteIds };
}

/** Open task whose day already passed: shown in red until an admin marks it done. */
export function isOverdue(task: { status: string; date: string }, today: string): boolean {
  return task.status === "open" && task.date < today;
}

/** Open tasks that should be on screen today: from `showFrom` on, overdue ones included, oldest first. */
export function visibleOpenTasks<T extends { status: string; showFrom: string; date: string }>(tasks: T[], today: string): T[] {
  return tasks
    .filter((task) => task.status === "open" && task.showFrom <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}
