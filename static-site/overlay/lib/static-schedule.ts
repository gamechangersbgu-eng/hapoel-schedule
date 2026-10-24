import snapshot from "@/lib/snapshot.json";
import { SLOT_TYPES, getSlotType, isPitchSlot } from "@/lib/slot-types";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import { addDaysISO, currentWeekStart, resolveWeekStart, weekDates, weekNumber } from "@/lib/week";

// Static replacement for lib/schedule.ts + app/actions.ts.
//
// Data = a "base" schedule (the demo data from db/seed.ts, or the committed
// schedule-data.json when it exists) with the visitor's own edits layered on top.
// Edits live in localStorage as { upserts, deletedIds } so they survive reloads.

export type ScheduleFile = {
  version: 1;
  clubName: string;
  seasonStartDate: string;
  teams: TeamDTO[];
  slots: SlotDTO[];
};

export type LocalEdits = { upserts: SlotDTO[]; deletedIds: number[] };

export type SlotInput = {
  id?: number;
  teamId: number;
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  type: string;
  note?: string | null;
};

export const EDITS_KEY = "hapoel-schedule-edits-v1";
export const ADMIN_KEY = "hapoel-schedule-admin-v1";
export const DATA_FILE = "schedule-data.json";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES: Set<string> = new Set(SLOT_TYPES.map((item) => item.id));

export const emptyEdits = (): LocalEdits => ({ upserts: [], deletedIds: [] });

/** Demo data from db/seed.ts, shown relative to the visitor's current week. */
export function seedSchedule(): ScheduleFile {
  const base = currentWeekStart();
  return {
    version: 1,
    clubName: snapshot.clubName,
    seasonStartDate: snapshot.seasonStartDate,
    teams: snapshot.teams as TeamDTO[],
    slots: snapshot.slots.map((slot) => ({
      id: slot.id,
      teamId: slot.teamId,
      date: addDaysISO(base, slot.dateOffset),
      endDate: slot.endDateOffset != null ? addDaysISO(base, slot.endDateOffset) : null,
      startTime: slot.startTime ?? null,
      type: slot.type,
      note: slot.note ?? null,
    })),
  };
}

/** Validates a parsed schedule-data.json / imported file. Missing parts fall back to the demo data. */
export function parseScheduleFile(raw: unknown): ScheduleFile | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.slots)) return null;
  const seed = seedSchedule();
  const teams =
    Array.isArray(obj.teams) && obj.teams.length > 0
      ? (obj.teams as TeamDTO[]).filter((t) => t && typeof t.id === "number" && typeof t.name === "string")
      : seed.teams;
  const teamIds = new Set(teams.map((t) => t.id));
  const slots: SlotDTO[] = [];
  for (const s of obj.slots as Record<string, unknown>[]) {
    if (
      !s ||
      typeof s.id !== "number" ||
      typeof s.teamId !== "number" ||
      !teamIds.has(s.teamId) ||
      typeof s.date !== "string" ||
      !ISO.test(s.date) ||
      typeof s.type !== "string"
    ) {
      continue;
    }
    slots.push({
      id: s.id,
      teamId: s.teamId,
      date: s.date,
      endDate: typeof s.endDate === "string" && ISO.test(s.endDate) ? s.endDate : null,
      startTime: typeof s.startTime === "string" && s.startTime ? s.startTime : null,
      type: s.type,
      note: typeof s.note === "string" && s.note ? s.note : null,
    });
  }
  return {
    version: 1,
    clubName: typeof obj.clubName === "string" && obj.clubName ? obj.clubName : seed.clubName,
    seasonStartDate:
      typeof obj.seasonStartDate === "string" && ISO.test(obj.seasonStartDate)
        ? obj.seasonStartDate
        : seed.seasonStartDate,
    teams,
    slots,
  };
}

/** Loads the published schedule-data.json (if the owner committed one), else null. */
export async function fetchPublishedSchedule(): Promise<ScheduleFile | null> {
  try {
    const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const res = await fetch(`${prefix}/${DATA_FILE}`, { cache: "no-store" });
    if (!res.ok) return null;
    return parseScheduleFile(await res.json());
  } catch {
    return null;
  }
}

export function loadEdits(): LocalEdits {
  try {
    const raw = JSON.parse(window.localStorage.getItem(EDITS_KEY) ?? "null");
    if (raw && Array.isArray(raw.upserts) && Array.isArray(raw.deletedIds)) return raw as LocalEdits;
  } catch {
    /* ignore */
  }
  return emptyEdits();
}

export function storeEdits(edits: LocalEdits) {
  try {
    if (edits.upserts.length === 0 && edits.deletedIds.length === 0) {
      window.localStorage.removeItem(EDITS_KEY);
    } else {
      window.localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
    }
  } catch {
    /* storage unavailable (private mode / quota) - edits stay in memory only */
  }
}

/** Base schedule + local edits = what the visitor sees. */
export function applyEdits(base: ScheduleFile, edits: LocalEdits): ScheduleFile {
  const deleted = new Set(edits.deletedIds);
  const upserts = new Map(edits.upserts.map((s) => [s.id, s]));
  const slots = base.slots
    .filter((s) => !deleted.has(s.id))
    .map((s) => upserts.get(s.id) ?? s);
  const baseIds = new Set(base.slots.map((s) => s.id));
  for (const s of edits.upserts) {
    if (!baseIds.has(s.id) && !deleted.has(s.id)) slots.push(s);
  }
  return { ...base, slots };
}

export function hasEdits(edits: LocalEdits) {
  return edits.upserts.length > 0 || edits.deletedIds.length > 0;
}

function inWeek(slot: SlotDTO, dates: string[]) {
  return (
    (slot.date >= dates[0] && slot.date <= dates[6]) ||
    (slot.type === "camp" && slot.date <= dates[6] && (slot.endDate ?? slot.date) >= dates[0])
  );
}

function bySlotOrder(a: SlotDTO, b: SlotDTO) {
  return (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id - b.id;
}

export function getWeekDataFrom(file: ScheduleFile, weekParam?: string | null): WeekData {
  const weekStart = resolveWeekStart(weekParam);
  const dates = weekDates(weekStart);
  return {
    clubName: file.clubName,
    seasonStartDate: file.seasonStartDate,
    weekStart,
    weekNumber: weekNumber(weekStart, file.seasonStartDate),
    dates,
    teams: file.teams,
    slots: file.slots.filter((s) => inWeek(s, dates)).sort(bySlotOrder),
  };
}

let idCounter = 0;
function newId() {
  idCounter += 1;
  return Date.now() * 1000 + (idCounter % 1000);
}

type EditResult = { error: string } | { edits: LocalEdits };

function withUpsert(edits: LocalEdits, slot: SlotDTO): LocalEdits {
  return {
    upserts: [...edits.upserts.filter((s) => s.id !== slot.id), slot],
    deletedIds: edits.deletedIds.filter((id) => id !== slot.id),
  };
}

function withDelete(edits: LocalEdits, id: number): LocalEdits {
  return {
    upserts: edits.upserts.filter((s) => s.id !== id),
    deletedIds: edits.deletedIds.includes(id) ? edits.deletedIds : [...edits.deletedIds, id],
  };
}

/** Mirrors saveSlot() in app/actions.ts (same validation + pitch conflict check, Hebrew messages). */
export function saveSlot(current: ScheduleFile, edits: LocalEdits, input: SlotInput): EditResult {
  if (!VALID_TYPES.has(input.type)) return { error: "סוג אימון לא חוקי" };
  if (!ISO.test(input.date)) return { error: "תאריך לא חוקי" };

  const endDate =
    input.type === "camp"
      ? input.endDate && ISO.test(input.endDate) && input.endDate >= input.date
        ? input.endDate
        : input.date
      : null;
  const startTime = input.startTime?.trim() || null;

  if (isPitchSlot(input.type) && !startTime) return { error: "יש לבחור שעה עבור אימון במגרש" };

  if (isPitchSlot(input.type) && startTime) {
    const conflict = current.slots.find(
      (s) =>
        s.date === input.date &&
        s.startTime === startTime &&
        s.type === input.type &&
        s.id !== input.id,
    );
    if (conflict) {
      const teamName = current.teams.find((t) => t.id === conflict.teamId)?.name ?? "";
      return {
        error: `${getSlotType(input.type).label} כבר תפוס בשעה ${startTime} על ידי ${teamName}`,
      };
    }
  }

  const slot: SlotDTO = {
    id: input.id ?? newId(),
    teamId: input.teamId,
    date: input.date,
    endDate,
    startTime,
    type: input.type,
    note: input.note?.trim() || null,
  };
  return { edits: withUpsert(edits, slot) };
}

export function deleteSlot(edits: LocalEdits, id: number): LocalEdits {
  return withDelete(edits, id);
}

/** Mirrors copyPreviousWeek() in app/actions.ts: replaces this week with last week's slots. */
export function copyPreviousWeek(current: ScheduleFile, edits: LocalEdits, weekStart: string): EditResult {
  const source = current.slots.filter((s) => inWeek(s, weekDates(addDaysISO(weekStart, -7))));
  if (source.length === 0) return { error: "אין נתונים בשבוע הקודם שאפשר להעתיק" };
  const dates = weekDates(weekStart);
  let next = edits;
  for (const s of current.slots) {
    if (s.date >= dates[0] && s.date <= dates[6]) next = withDelete(next, s.id);
  }
  for (const s of source) {
    next = withUpsert(next, {
      ...s,
      id: newId(),
      date: addDaysISO(s.date, 7),
      endDate: s.endDate ? addDaysISO(s.endDate, 7) : null,
    });
  }
  return { edits: next };
}

/** The JSON to commit as schedule-data.json. */
export function exportJson(file: ScheduleFile): string {
  const slots = [...file.slots].sort((a, b) => a.date.localeCompare(b.date) || bySlotOrder(a, b));
  return JSON.stringify({ ...file, slots }, null, 2) + "\n";
}
