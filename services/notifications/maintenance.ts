import "server-only";

// Database side of the mowing + marking tasks. Rules live in maintenance-rules.ts (tested without a DB).
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import {
  db,
  maintenancePitchOverrides,
  maintenanceTasks,
  pitches,
  slotGameDetails,
  slotTrainingDetails,
  slots,
  teamAgeBands,
  teams,
} from "@/lib/db";
import { logChange, formatDateHe } from "@/lib/history";
import {
  DEFAULT_TRAINING_MINUTES,
  HORIZON_DAYS,
  MAINTAINED_PITCH_CODES,
  WEEKLY_PITCH_CODE,
  WEEKLY_WEEKDAYS,
  addDays,
  isOverdue,
  isOverrideCode,
  israelToday,
  overridesToClear,
  unknownVenueGames,
  urgentUnknownCount,
  planGamePrepTasks,
  planWeeklyTask,
  reconcileTasks,
  sundayOfISO,
  toMinutes,
  visibleOpenTasks,
  type BusyRange,
  type GameForMaintenance,
  type PlannedTask,
} from "./maintenance-rules";

/** Admin pages call sync on every load; skip it if this server instance synced a moment ago. */
const SYNC_INTERVAL_MS = 2 * 60 * 1000;
let lastSyncAt = 0;

export type MaintenanceTaskView = {
  id: number;
  pitchName: string;
  kind: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  showFrom: string;
  summary: string;
  status: string;
  doneBy: string | null;
  doneAt: string | null;
};

async function loadPitchIds() {
  const rows = await db
    .select({ id: pitches.id, code: pitches.code, nameHe: pitches.nameHe })
    .from(pitches)
    .where(inArray(pitches.code, [...MAINTAINED_PITCH_CODES]));
  return {
    idByCode: new Map(rows.map((row) => [row.code, row.id])),
    codeById: new Map(rows.map((row) => [row.id, row.code])),
  };
}

async function loadGames(from: string, to: string, codeOfPitch: (id: number | null) => string | null) {
  const rows = await db
    .select({
      slotId: slots.id,
      date: slots.date,
      type: slots.type,
      status: slots.status,
      startTime: slots.startTime,
      note: slots.note,
      teamName: teams.name,
      ageBandLabel: teamAgeBands.labelHe,
      kickoff: slotGameDetails.kickoffTime,
      opponent: slotGameDetails.opponent,
      pitchId: slotGameDetails.pitchId,
      source: slotGameDetails.source,
      overrideCode: maintenancePitchOverrides.pitchCode,
    })
    .from(slots)
    .innerJoin(teams, eq(teams.id, slots.teamId))
    .leftJoin(teamAgeBands, eq(teamAgeBands.code, teams.ageBandCode))
    .leftJoin(slotGameDetails, eq(slotGameDetails.slotId, slots.id))
    .leftJoin(maintenancePitchOverrides, eq(maintenancePitchOverrides.slotId, slots.id))
    .where(and(eq(slots.type, "home_game"), gte(slots.date, from), lte(slots.date, to)));

  return rows.map(
    (row): GameForMaintenance => ({
      slotId: row.slotId,
      date: row.date,
      type: row.type,
      status: row.status,
      kickoff: row.kickoff || row.startTime,
      teamName: row.teamName,
      ageBandLabel: row.ageBandLabel,
      opponent: row.opponent,
      pitchCode: codeOfPitch(row.pitchId),
      note: row.note,
      source: row.source,
      overrideCode: row.overrideCode,
    }),
  );
}

/** Active trainings on Vasermil 2, as busy minutes per date (same reading as the pitch board). */
async function loadWeeklyPitchBusy(pitchId: number, dates: string[]) {
  const busy = new Map<string, BusyRange[]>(dates.map((date) => [date, []]));
  if (dates.length === 0) return busy;
  const rows = await db
    .select({
      date: slots.date,
      type: slots.type,
      status: slots.status,
      startTime: slots.startTime,
      trainingPitchId: slotTrainingDetails.pitchId,
      durationMinutes: slotTrainingDetails.durationMinutes,
    })
    .from(slots)
    .leftJoin(slotTrainingDetails, eq(slotTrainingDetails.slotId, slots.id))
    .where(inArray(slots.date, dates));

  for (const row of rows) {
    if (row.status === "cancelled" || !row.startTime) continue;
    const onPitch = row.trainingPitchId != null ? row.trainingPitchId === pitchId : row.type === WEEKLY_PITCH_CODE;
    if (!onPitch) continue;
    const start = toMinutes(row.startTime);
    busy.get(row.date)?.push({ start, end: start + (row.durationMinutes ?? DEFAULT_TRAINING_MINUTES) });
  }
  return busy;
}

/**
 * Brings `maintenance_tasks` in line with the schedule: game tasks for the next HORIZON_DAYS,
 * the weekly Vasermil 2 task for this week and next. Safe to call repeatedly.
 */
export async function syncMaintenanceTasks(options?: { today?: string; force?: boolean }) {
  const now = Date.now();
  if (!options?.force && now - lastSyncAt < SYNC_INTERVAL_MS) return;
  lastSyncAt = now;

  const today = options?.today ?? israelToday();
  const thisWeek = sundayOfISO(today);
  const weeks = [thisWeek, addDays(thisWeek, 7)];
  const weekDates = weeks.flatMap((week) => WEEKLY_WEEKDAYS.map((day) => addDays(week, day)));

  const { idByCode, codeById } = await loadPitchIds();
  const weeklyPitchId = idByCode.get(WEEKLY_PITCH_CODE);

  const [games, busy, stored] = await Promise.all([
    loadGames(today, addDays(today, HORIZON_DAYS), (id) => (id == null ? null : (codeById.get(id) ?? `pitch_${id}`))),
    weeklyPitchId ? loadWeeklyPitchBusy(weeklyPitchId, weekDates) : Promise.resolve(new Map<string, BusyRange[]>()),
    db
      .select({
        id: maintenanceTasks.id,
        pitchId: maintenanceTasks.pitchId,
        kind: maintenanceTasks.kind,
        periodKey: maintenanceTasks.periodKey,
        date: maintenanceTasks.date,
        status: maintenanceTasks.status,
      })
      .from(maintenanceTasks)
      .where(gte(maintenanceTasks.periodKey, thisWeek)),
  ]);

  // The association (or an admin on the games screen) gave the place: drop the temporary pick.
  const cleared = overridesToClear(games);
  if (cleared.length > 0) {
    await db.delete(maintenancePitchOverrides).where(inArray(maintenancePitchOverrides.slotId, cleared));
    for (const game of games.filter((g) => cleared.includes(g.slotId))) {
      game.overrideCode = null;
      await logChange({
        action: "maintenance",
        summary: `שיבוץ מגרש זמני הוסר: ההתאחדות עדכנה מגרש למשחק של ${game.teamName} ב-${formatDateHe(game.date)}`,
        date: game.date,
      });
    }
  }

  const planned: PlannedTask[] = [
    ...planGamePrepTasks(games),
    ...(weeklyPitchId
      ? weeks.map((week) => planWeeklyTask(week, busy, today)).filter((task): task is PlannedTask => task !== null)
      : []),
  ];
  const changes = reconcileTasks(
    planned,
    stored.map((task) => ({ ...task, pitchCode: codeById.get(task.pitchId) ?? "" })),
    today,
  );

  const stamp = new Date().toISOString();
  for (const task of changes.upserts) {
    const pitchId = idByCode.get(task.pitchCode);
    if (!pitchId) continue;
    const values = {
      date: task.date,
      startTime: task.startTime,
      endTime: task.endTime,
      showFrom: task.showFrom,
      slotIds: task.slotIds,
      summary: task.summary,
      status: "open",
      updatedAt: stamp,
    };
    await db
      .insert(maintenanceTasks)
      .values({ pitchId, kind: task.kind, periodKey: task.periodKey, createdAt: stamp, ...values })
      .onConflictDoUpdate({
        target: [maintenanceTasks.pitchId, maintenanceTasks.kind, maintenanceTasks.periodKey],
        set: values,
      });
  }
  if (changes.obsoleteIds.length > 0) {
    await db
      .update(maintenanceTasks)
      .set({ status: "obsolete", updatedAt: stamp })
      .where(and(inArray(maintenanceTasks.id, changes.obsoleteIds), eq(maintenanceTasks.status, "open")));
  }
}

/** Every open task (overdue ones too) plus everything from the last week, for the maintenance page. */
export async function getMaintenanceTasks(today = israelToday()): Promise<MaintenanceTaskView[]> {
  await syncMaintenanceTasks({ today, force: true });
  const rows = await db
    .select({ task: maintenanceTasks, pitchName: pitches.nameHe })
    .from(maintenanceTasks)
    .innerJoin(pitches, eq(pitches.id, maintenanceTasks.pitchId))
    .where(or(eq(maintenanceTasks.status, "open"), gte(maintenanceTasks.date, addDays(today, -7))))
    .orderBy(asc(maintenanceTasks.date), asc(pitches.sortOrder));
  return rows.map(({ task, pitchName }) => ({
    id: task.id,
    pitchName,
    kind: task.kind,
    date: task.date,
    startTime: task.startTime,
    endTime: task.endTime,
    showFrom: task.showFrom,
    summary: task.summary,
    status: task.status,
    doneBy: task.doneBy,
    doneAt: task.doneAt,
  }));
}

export type MaintenanceAlertCount = { open: number; overdue: number; unknown: number };

/** Open tasks to flag today (banner + tab count), and how many of them are overdue. Never throws. */
export async function getVisibleMaintenanceCount(today = israelToday()): Promise<MaintenanceAlertCount> {
  try {
    await syncMaintenanceTasks({ today });
    const rows = await db
      .select({ status: maintenanceTasks.status, showFrom: maintenanceTasks.showFrom, date: maintenanceTasks.date })
      .from(maintenanceTasks)
      .where(and(eq(maintenanceTasks.status, "open"), lte(maintenanceTasks.showFrom, today)));
    const visible = visibleOpenTasks(rows, today);
    // Only "is a pitch set?" matters here, not which one.
    const games = await loadGames(today, addDays(today, HORIZON_DAYS), (id) => (id == null ? null : `pitch_${id}`));
    return {
      open: visible.length,
      overdue: visible.filter((task) => isOverdue(task, today)).length,
      unknown: urgentUnknownCount(games, today),
    };
  } catch (error) {
    // Table missing (migration not applied yet) or DB hiccup: the admin page must still load.
    console.error("[maintenance] could not load tasks", error);
    return { open: 0, overdue: 0, unknown: 0 };
  }
}

export async function markMaintenanceDone(taskId: number, adminName: string) {
  const [task] = await db
    .update(maintenanceTasks)
    .set({ status: "done", doneBy: adminName, doneAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(maintenanceTasks.id, taskId), eq(maintenanceTasks.status, "open")))
    .returning({ date: maintenanceTasks.date, pitchId: maintenanceTasks.pitchId });
  if (!task) return false;
  const [pitch] = await db.select({ nameHe: pitches.nameHe }).from(pitches).where(eq(pitches.id, task.pitchId)).limit(1);
  await logChange({
    action: "maintenance",
    summary: `כיסוח וסימון ${pitch?.nameHe ?? ""} ל-${formatDateHe(task.date)} בוצע`,
    date: task.date,
  });
  return true;
}

/** Undo a "done" click made by mistake. */
export async function reopenMaintenanceTask(taskId: number) {
  await db
    .update(maintenanceTasks)
    .set({ status: "open", doneBy: null, doneAt: null, updatedAt: new Date().toISOString() })
    .where(and(eq(maintenanceTasks.id, taskId), eq(maintenanceTasks.status, "done")));
}

export type UnknownVenueGame = {
  slotId: number;
  date: string;
  kickoff: string | null;
  teamName: string;
  opponent: string | null;
  overrideCode: string | null;
};

/** Home games in the coming HORIZON_DAYS with no venue from the association or an admin (the temporary column). */
export async function getUnknownVenueGames(today = israelToday()): Promise<UnknownVenueGame[]> {
  // Only "is a pitch set?" matters here, not which one.
  const games = await loadGames(today, addDays(today, HORIZON_DAYS), (id) => (id == null ? null : `pitch_${id}`));
  return unknownVenueGames(games).map((game) => ({
    slotId: game.slotId,
    date: game.date,
    kickoff: game.kickoff,
    teamName: game.teamName,
    opponent: game.opponent,
    overrideCode: game.overrideCode ?? null,
  }));
}

const OVERRIDE_LABEL: Record<string, string> = {
  vasermil_1: "וסרמיל 1",
  vasermil_2: "וסרמיל 2",
  vasermil_3: "וסרמיל 3",
  vasermil_4: "וסרמיל 4",
  other: "מגרש אחר (לא וסרמיל)",
};

export function overrideLabel(code: string) {
  return OVERRIDE_LABEL[code] ?? code;
}

/** Sets (or clears, with null) the temporary pitch of a home game that still has no venue. */
export async function setPitchOverride(slotId: number, code: string | null, adminName: string) {
  const [slot] = await db
    .select({ date: slots.date, teamName: teams.name })
    .from(slots)
    .innerJoin(teams, eq(teams.id, slots.teamId))
    .where(and(eq(slots.id, slotId), eq(slots.type, "home_game")))
    .limit(1);
  if (!slot) return { ok: false as const, error: "המשחק לא נמצא" };

  if (code === null) {
    await db.delete(maintenancePitchOverrides).where(eq(maintenancePitchOverrides.slotId, slotId));
    await logChange({
      action: "maintenance",
      summary: `הוסר שיבוץ מגרש זמני למשחק של ${slot.teamName} ב-${formatDateHe(slot.date)}`,
      date: slot.date,
    });
  } else {
    if (!isOverrideCode(code)) return { ok: false as const, error: "מגרש לא חוקי" };
    const unknown = await getUnknownVenueGames();
    if (!unknown.some((game) => game.slotId === slotId)) {
      return { ok: false as const, error: "למשחק כבר יש מגרש מההתאחדות או ממסך המשחקים" };
    }
    const values = { pitchCode: code, setBy: adminName, setAt: new Date().toISOString() };
    await db
      .insert(maintenancePitchOverrides)
      .values({ slotId, ...values })
      .onConflictDoUpdate({ target: maintenancePitchOverrides.slotId, set: values });
    await logChange({
      action: "maintenance",
      summary: `שיבוץ מגרש זמני: ${overrideLabel(code)} למשחק של ${slot.teamName} ב-${formatDateHe(slot.date)}`,
      date: slot.date,
    });
  }
  await syncMaintenanceTasks({ force: true });
  return { ok: true as const };
}
