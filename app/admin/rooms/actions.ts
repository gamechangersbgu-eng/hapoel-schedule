"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { canApproveRoomRequests, canBookRoomDirectly, canSubmitRoomRequest } from "@/lib/rooms/room-access";
import type { RoomRequestInput } from "@/lib/rooms/room-requests";
import {
  approveRoomRequest,
  createRoomRequest,
  rejectRoomRequest,
} from "@/lib/rooms/room-requests-db";
import { ROOMS, readRoomKind, type RoomKind } from "@/lib/rooms/room-rules";
import {
  deleteRoomBooking,
  previewRoomBooking,
  saveRoomBooking,
  type RoomBookingRequest,
} from "@/lib/rooms/rooms-db";

function cleanRequest(request: RoomBookingRequest): RoomBookingRequest {
  return {
    teamId: Number(request.teamId),
    startTime: String(request.startTime ?? ""),
    durationMinutes: Number(request.durationMinutes),
    dates: Array.isArray(request.dates) ? request.dates.map(String).slice(0, 200) : [],
    note: request.note ? String(request.note).slice(0, 300) : null,
    id: request.id ? Number(request.id) : undefined,
  };
}

function cleanRoomRequest(request: RoomRequestInput): RoomRequestInput {
  const recurrence = request.recurrence;
  return {
    teamId: Number(request.teamId),
    startTime: String(request.startTime ?? ""),
    durationMinutes: Number(request.durationMinutes),
    dates: Array.isArray(request.dates) ? request.dates.map(String).slice(0, 200) : [],
    note: request.note ? String(request.note).slice(0, 300) : null,
    recurrence: recurrence
      ? {
          weekdays: Array.isArray(recurrence.weekdays) ? recurrence.weekdays.map(Number) : [],
          until: String(recurrence.until ?? ""),
          extraDates: Array.isArray(recurrence.extraDates) ? recurrence.extraDates.map(String) : [],
          intervalDays: recurrence.intervalDays === 14 ? 14 : 7,
        }
      : null,
  };
}

function refresh(kind: RoomKind) {
  revalidatePath(ROOMS[kind].path);
  revalidatePath("/tv");
}

export async function previewRoomBookingAction(kind: RoomKind, request: RoomBookingRequest) {
  const user = await requireAdmin();
  if (!canBookRoomDirectly(user)) return { items: [], error: "שיבוץ ישיר פתוח רק למנהל הראשי" };
  const room = readRoomKind(kind);
  if (!room) return { items: [], error: "חדר לא מוכר" };
  return previewRoomBooking(room, cleanRequest(request));
}

export async function saveRoomBookingAction(kind: RoomKind, request: RoomBookingRequest) {
  const user = await requireAdmin();
  const room = readRoomKind(kind);
  if (!room) return { ok: false as const, error: "חדר לא מוכר" };
  const cleaned = cleanRequest(request);
  if (!cleaned.id && !canBookRoomDirectly(user)) {
    return { ok: false as const, error: "שיבוץ ישיר פתוח רק למנהל הראשי. שלחו בקשה והמתינו לאישור." };
  }
  const result = await saveRoomBooking(room, cleaned, user.displayName);
  refresh(room);
  return result;
}

export async function submitRoomRequestAction(kind: RoomKind, request: RoomRequestInput) {
  const user = await requireUser();
  const room = readRoomKind(kind);
  if (!room) return { ok: false as const, error: "חדר לא מוכר" };
  if (!canSubmitRoomRequest(user, room)) return { ok: false as const, error: "אין הרשאה לשלוח בקשה לחדר הזה" };
  const result = await createRoomRequest(room, cleanRoomRequest(request), user);
  refresh(room);
  return result;
}

export async function deleteRoomBookingAction(formData: FormData) {
  await requireAdmin();
  const room = readRoomKind(formData.get("room"));
  const id = Number(formData.get("id"));
  const week = String(formData.get("week") ?? "");
  if (!room) redirect("/admin");
  if (Number.isInteger(id) && id > 0) {
    await deleteRoomBooking(room, id, formData.get("scope") === "following" ? "following" : "one");
  }
  refresh(room);
  redirect(`${ROOMS[room].path}?week=${week}`);
}

function roomRedirect(room: RoomKind, week: string, params: Record<string, string>): never {
  const search = new URLSearchParams({ week, ...params });
  redirect(`${ROOMS[room].path}?${search.toString()}`);
}

function clip(message: string) {
  return message.length > 400 ? `${message.slice(0, 397)}…` : message;
}

export async function approveRoomRequestAction(formData: FormData) {
  const user = await requireUser();
  const room = readRoomKind(formData.get("room"));
  const week = String(formData.get("week") ?? "");
  if (!room) redirect("/admin");
  if (!canApproveRoomRequests(user)) roomRedirect(room, week, { error: "רק מנהל ראשי יכול לאשר בקשות" });
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) roomRedirect(room, week, { error: "הבקשה לא נמצאה" });
  const result = await approveRoomRequest(id, user);
  refresh(room);
  if (!result.ok) roomRedirect(room, week, { error: clip(result.error) });
  roomRedirect(room, week, { approved: "1" });
}

export async function rejectRoomRequestAction(formData: FormData) {
  const user = await requireUser();
  const room = readRoomKind(formData.get("room"));
  const week = String(formData.get("week") ?? "");
  if (!room) redirect("/admin");
  if (!canApproveRoomRequests(user)) roomRedirect(room, week, { error: "רק מנהל ראשי יכול לדחות בקשות" });
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) roomRedirect(room, week, { error: "הבקשה לא נמצאה" });
  const reason = String(formData.get("reason") ?? "");
  const result = await rejectRoomRequest(id, user, reason);
  refresh(room);
  if (!result.ok) roomRedirect(room, week, { error: result.error });
  roomRedirect(room, week, { rejected: "1" });
}
