import snapshot from "@/lib/snapshot.json";
import { SLOT_TYPES, getSlotType, isPitchSlot } from "@/lib/slot-types";
import { effectiveEnd, isTime, rangesOverlap, toMinutes } from "@/lib/time-range";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import { addDaysISO, currentWeekStart, resolveWeekStart, weekDates, weekNumber } from "@/lib/week";

// Static replacement for lib/schedule.ts + app/actions.ts.
//
// Data = a "base" schedule (the demo data from db/seed.ts, or the committed
// schedule-data.json when it exists) with the shared edits { upserts, deletedIds } layered on top.
// The shared edits live in a public, unauthenticated JSON store (textdb.dev, see SHARED_URL) so every
// visitor sees the same schedule. localStorage is only a cache / offline fallback.

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
  endTime?: string | null;
  type: string;
  note?: string | null;
};

// Browser cache of the shared edits (the source of truth is the shared store below).
export const EDITS_KEY = "hapoel-schedule-shared-cache-v1";
export const ADMIN_KEY = "hapoel-schedule-admin-v1";
export const DATA_FILE = "schedule-data.json";

/**
 * Public, unauthenticated shared store (https://textdb.dev). Anyone who knows this URL can read AND
 * overwrite the data. Override at build time with NEXT_PUBLIC_SHARED_URL (empty string = local-only mode).
 */
export const SHARED_URL: string =
  process.env.NEXT_PUBLIC_SHARED_URL ?? "https://textdb.dev/api/data/hapoel-schedule-430dcbc299034db99703ca83b8a27e89";

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

/** Keeps only well-formed slots (optionally only for known teams). */
function cleanSlots(raw: unknown, teamIds?: Set<number>): SlotDTO[] {
  const slots: SlotDTO[] = [];
  if (!Array.isArray(raw)) return slots;
  for (const s of raw as Record<string, unknown>[]) {
    if (
      !s ||
      typeof s.id !== "number" ||
      typeof s.teamId !== "number" ||
      (teamIds && !teamIds.has(s.teamId)) ||
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
      endTime: isTime(s.endTime) && typeof s.startTime === "string" && s.startTime ? s.endTime : null,
      type: s.type,
      note: typeof s.note === "string" && s.note ? s.note : null,
    });
  }
  return slots;
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
  const slots = cleanSlots(obj.slots, new Set(teams.map((t) => t.id)));
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

/** Validates edits read from the shared store / cache. */
export function parseEdits(raw: unknown): LocalEdits | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.upserts) || !Array.isArray(obj.deletedIds)) return null;
  return {
    upserts: cleanSlots(obj.upserts),
    deletedIds: obj.deletedIds.filter((id): id is number => typeof id === "number"),
  };
}

export function loadEdits(): LocalEdits {
  try {
    return parseEdits(JSON.parse(window.localStorage.getItem(EDITS_KEY) ?? "null")) ?? emptyEdits();
  } catch {
    return emptyEdits();
  }
}

export function storeEdits(edits: LocalEdits) {
  try {
    window.localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
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
  const endTime = input.endTime?.trim() || null;

  if (isPitchSlot(input.type) && !startTime) return { error: "יש לבחור שעת התחלה עבור אימון במגרש" };
  if (isPitchSlot(input.type) && !endTime) return { error: "יש לבחור שעת סיום עבור אימון במגרש" };
  if (endTime && !startTime) return { error: "יש לבחור שעת התחלה לפני שעת סיום" };
  if (startTime && !isTime(startTime)) return { error: "שעת התחלה לא חוקית" };
  if (endTime && !isTime(endTime)) return { error: "שעת סיום לא חוקית" };
  if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) {
    return { error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" };
  }

  if (isPitchSlot(input.type) && startTime) {
    const mine = { startTime, endTime };
    const conflict = current.slots.find(
      (s) => s.date === input.date && s.type === input.type && s.id !== input.id && rangesOverlap(s, mine),
    );
    if (conflict) {
      const teamName = current.teams.find((t) => t.id === conflict.teamId)?.name ?? "";
      const range = `${conflict.startTime}\u2013${effectiveEnd(conflict)}`;
      return {
        error: `${getSlotType(input.type).label} כבר תפוס בשעות ${range} על ידי ${teamName}`,
      };
    }
  }

  const slot: SlotDTO = {
    id: input.id ?? newId(),
    teamId: input.teamId,
    date: input.date,
    endDate,
    startTime,
    endTime,
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

// ---------------------------------------------------------------------------------------------
// Shared store (textdb.dev): plain text body, "simple" CORS requests (no preflight, no headers).
// ---------------------------------------------------------------------------------------------

export const sharedEnabled = () => SHARED_URL.length > 0;

/** Reads the shared edits. Resolves to emptyEdits() when the store has no data yet; throws on network errors. */
export async function fetchSharedEdits(): Promise<LocalEdits> {
  const res = await fetch(SHARED_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`shared read failed: ${res.status}`);
  const text = (await res.text()).trim();
  if (!text) return emptyEdits();
  const parsed = parseEdits(JSON.parse(text));
  if (!parsed) throw new Error("shared data is malformed");
  return parsed;
}

export async function pushSharedEdits(edits: LocalEdits): Promise<void> {
  const res = await fetch(SHARED_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), ...edits }),
  });
  if (!res.ok) throw new Error(`shared write failed: ${res.status}`);
}

/** What changed between two edit sets, so it can be replayed on top of the freshest shared data. */
export type EditsDiff = {
  replaceAll?: boolean; // reset: the shared data becomes exactly `next`
  next?: LocalEdits;
  upserts: SlotDTO[];
  removedUpsertIds: number[];
  addedDeletedIds: number[];
  removedDeletedIds: number[];
};

export function diffEdits(prev: LocalEdits, next: LocalEdits): EditsDiff {
  const prevUp = new Map(prev.upserts.map((s) => [s.id, JSON.stringify(s)]));
  const nextIds = new Set(next.upserts.map((s) => s.id));
  const prevDel = new Set(prev.deletedIds);
  const nextDel = new Set(next.deletedIds);
  return {
    upserts: next.upserts.filter((s) => prevUp.get(s.id) !== JSON.stringify(s)),
    removedUpsertIds: prev.upserts.filter((s) => !nextIds.has(s.id)).map((s) => s.id),
    addedDeletedIds: next.deletedIds.filter((id) => !prevDel.has(id)),
    removedDeletedIds: prev.deletedIds.filter((id) => !nextDel.has(id)),
  };
}

export function replaceDiff(next: LocalEdits): EditsDiff {
  return { replaceAll: true, next, upserts: [], removedUpsertIds: [], addedDeletedIds: [], removedDeletedIds: [] };
}

export function applyDiff(remote: LocalEdits, diff: EditsDiff): LocalEdits {
  if (diff.replaceAll && diff.next) return diff.next;
  const upsertIds = new Set(diff.upserts.map((s) => s.id));
  const removedUp = new Set(diff.removedUpsertIds);
  const addedDel = new Set(diff.addedDeletedIds);
  const removedDel = new Set(diff.removedDeletedIds);
  const upserts = [
    ...remote.upserts.filter((s) => !upsertIds.has(s.id) && !removedUp.has(s.id) && !addedDel.has(s.id)),
    ...diff.upserts,
  ];
  const deletedIds = [
    ...new Set([...remote.deletedIds.filter((id) => !removedDel.has(id) && !upsertIds.has(id)), ...addedDel]),
  ];
  return { upserts, deletedIds };
}
