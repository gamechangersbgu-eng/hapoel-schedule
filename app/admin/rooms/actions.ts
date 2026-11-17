"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
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

export async function previewRoomBookingAction(kind: RoomKind, request: RoomBookingRequest) {
  await requireAdmin();
  const room = readRoomKind(kind);
  if (!room) return { items: [], error: "חדר לא מוכר" };
  return previewRoomBooking(room, cleanRequest(request));
}

export async function saveRoomBookingAction(kind: RoomKind, request: RoomBookingRequest) {
  const user = await requireAdmin();
  const room = readRoomKind(kind);
  if (!room) return { ok: false as const, error: "חדר לא מוכר" };
  const result = await saveRoomBooking(room, cleanRequest(request), user.displayName);
  revalidatePath(ROOMS[room].path);
  revalidatePath("/tv");
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
  revalidatePath(ROOMS[room].path);
  revalidatePath("/tv");
  redirect(`${ROOMS[room].path}?week=${week}`);
}
