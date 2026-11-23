import "server-only";

import { and, desc, eq, or } from "drizzle-orm";
import { adminUsers, db, roomBookingRequests, teams } from "@/lib/db";
import { logChange } from "@/lib/history";
import {
  datesSummary,
  isRequestStatus,
  prepareRoomRequest,
  recurrenceLabel,
  requestWhenLabel,
  sanitizeRecurrence,
  type RoomRecurrence,
  type RoomRequestInput,
  type RoomRequestStatus,
} from "./room-requests";
import { ROOMS, readRoomKind, type RoomKind } from "./room-rules";
import { insertApprovedRoomBookings, removeRoomBookings } from "./rooms-db";

export type RoomRequestView = {
  id: number;
  room: RoomKind;
  requesterId: number;
  requesterName: string;
  teamName: string;
  whenLabel: string;
  datesLabel: string;
  recurrenceLabel: string | null;
  note: string | null;
  status: RoomRequestStatus;
  reason: string | null;
};

type Result = { ok: true; dates: string[] } | { ok: false; error: string };

function parseDates(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((date): date is string => typeof date === "string");
  } catch {
    return [];
  }
}

function parseRecurrence(raw: string | null): RoomRecurrence | null {
  if (!raw) return null;
  try {
    return sanitizeRecurrence(JSON.parse(raw) as RoomRecurrence);
  } catch {
    return null;
  }
}

async function bookableTeam(teamId: number) {
  if (!Number.isInteger(teamId) || teamId <= 0) return null;
  const [team] = await db
    .select({ name: teams.name, isComments: teams.isComments })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  return team && !team.isComments ? team : null;
}

export async function createRoomRequest(kind: RoomKind, input: RoomRequestInput, requester: { id: number; displayName: string }): Promise<Result> {
  const prepared = prepareRoomRequest(ROOMS[kind], input);
  if (!prepared.ok) return prepared;
  const team = await bookableTeam(input.teamId);
  if (!team) return { ok: false, error: "יש לבחור קבוצה" };
  const stamp = new Date().toISOString();
  await db.insert(roomBookingRequests).values({
    room: kind,
    requesterId: requester.id,
    teamId: input.teamId,
    startTime: input.startTime.trim(),
    durationMinutes: input.durationMinutes,
    dates: JSON.stringify(prepared.dates),
    recurrence: prepared.recurrence ? JSON.stringify(prepared.recurrence) : null,
    note: input.note?.trim() ? input.note.trim().slice(0, 300) : null,
    status: "pending",
    createdAt: stamp,
  });
  await logChange({
    action: "room",
    summary: `${ROOMS[kind].label}: בקשת שיבוץ של ${team.name} מ-${requester.displayName} (${prepared.dates.length} מועדים) ממתינה לאישור`,
    teamId: input.teamId,
    date: prepared.dates[0] ?? null,
  });
  return { ok: true, dates: prepared.dates };
}

export async function approveRoomRequest(id: number, decider: { id: number; displayName: string }): Promise<Result> {
  const [row] = await db.select().from(roomBookingRequests).where(eq(roomBookingRequests.id, id)).limit(1);
  if (!row || row.status !== "pending") return { ok: false, error: "הבקשה כבר לא ממתינה" };
  const kind = readRoomKind(row.room);
  if (!kind) return { ok: false, error: "חדר לא מוכר" };
  const inserted = await insertApprovedRoomBookings(
    kind,
    {
      teamId: row.teamId,
      startTime: row.startTime,
      durationMinutes: row.durationMinutes,
      dates: parseDates(row.dates),
      note: row.note,
    },
    decider.displayName,
  );
  if (!inserted.ok) return inserted;
  const decided = await db
    .update(roomBookingRequests)
    .set({ status: "approved", decidedBy: decider.id, decidedAt: new Date().toISOString(), reason: null })
    .where(and(eq(roomBookingRequests.id, id), eq(roomBookingRequests.status, "pending")))
    .returning({ id: roomBookingRequests.id });
  if (decided.length === 0) {
    await removeRoomBookings(kind, inserted.ids);
    return { ok: false, error: "הבקשה כבר לא ממתינה" };
  }
  await logChange({
    action: "room",
    summary: inserted.summary,
    teamId: row.teamId,
    date: inserted.saved[0] ?? null,
  });
  return { ok: true, dates: inserted.saved };
}

export async function rejectRoomRequest(
  id: number,
  decider: { id: number; displayName: string },
  reason: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db.select().from(roomBookingRequests).where(eq(roomBookingRequests.id, id)).limit(1);
  if (!row || row.status !== "pending") return { ok: false, error: "הבקשה כבר לא ממתינה" };
  const kind = readRoomKind(row.room);
  const trimmed = reason?.trim().slice(0, 300) || null;
  const decided = await db
    .update(roomBookingRequests)
    .set({ status: "rejected", decidedBy: decider.id, decidedAt: new Date().toISOString(), reason: trimmed })
    .where(and(eq(roomBookingRequests.id, id), eq(roomBookingRequests.status, "pending")))
    .returning({ id: roomBookingRequests.id });
  if (decided.length === 0) return { ok: false, error: "הבקשה כבר לא ממתינה" };
  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, row.teamId)).limit(1);
  await logChange({
    action: "room",
    summary: `${kind ? ROOMS[kind].label : "חדר"}: נדחתה בקשת שיבוץ של ${team?.name ?? "קבוצה"} מ-${decider.displayName}${trimmed ? ` (${trimmed})` : ""}`,
    teamId: row.teamId,
    date: parseDates(row.dates)[0] ?? null,
  });
  return { ok: true };
}

/** Pending requests for the approver, and the signed-in user's own requests. Others' requests stay hidden. */
export async function listRoomRequests(kind: RoomKind, userId: number, approver: boolean): Promise<{ pending: RoomRequestView[]; mine: RoomRequestView[] }> {
  const scope = approver
    ? or(eq(roomBookingRequests.status, "pending"), eq(roomBookingRequests.requesterId, userId))
    : eq(roomBookingRequests.requesterId, userId);
  const rows = await db
    .select({
      request: roomBookingRequests,
      teamName: teams.name,
      requesterName: adminUsers.displayName,
    })
    .from(roomBookingRequests)
    .innerJoin(teams, eq(teams.id, roomBookingRequests.teamId))
    .innerJoin(adminUsers, eq(adminUsers.id, roomBookingRequests.requesterId))
    .where(and(eq(roomBookingRequests.room, kind), scope))
    .orderBy(desc(roomBookingRequests.createdAt));

  const views = rows.flatMap((row): RoomRequestView[] => {
    const room = readRoomKind(row.request.room);
    if (!room || !isRequestStatus(row.request.status)) return [];
    const dates = parseDates(row.request.dates);
    return [
      {
        id: row.request.id,
        room,
        requesterId: row.request.requesterId,
        requesterName: row.requesterName,
        teamName: row.teamName,
        whenLabel: requestWhenLabel(row.request.startTime, row.request.durationMinutes),
        datesLabel: datesSummary(dates),
        recurrenceLabel: recurrenceLabel(parseRecurrence(row.request.recurrence)),
        note: row.request.note,
        status: row.request.status,
        reason: row.request.reason,
      },
    ];
  });

  return {
    pending: approver ? views.filter((item) => item.status === "pending") : [],
    mine: views.filter((item) => item.requesterId === userId).slice(0, 40),
  };
}

/** Badge counts. A missing table (migration not applied yet) shows zero instead of breaking the nav. */
export async function countPendingRoomRequests(): Promise<{ gym: number; video: number }> {
  try {
    const rows = await db
      .select({ room: roomBookingRequests.room })
      .from(roomBookingRequests)
      .where(eq(roomBookingRequests.status, "pending"));
    return {
      gym: rows.filter((row) => row.room === "gym").length,
      video: rows.filter((row) => row.room === "video").length,
    };
  } catch (error) {
    console.error("[rooms] could not count pending requests", error);
    return { gym: 0, video: 0 };
  }
}
