"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { adminUsers, db, injuries, injuryStatusChanges, physioSessions, players } from "@/lib/db";
import { NOTE_MAX_LENGTH, isSessionStatus, physioClash, todayInIsrael, validateSession } from "@/lib/injuries";
import { sessionsOfPhysioOn } from "@/lib/injuries-db";
import { sundayOf, formatISODate, parseISODate } from "@/lib/week";

const EDITORS = ["owner", "admin", "physio"] as const;

function back(params: Record<string, string>): never {
  redirect(`/admin/physio?${new URLSearchParams(params).toString()}`);
}

function weekOf(date: string) {
  return formatISODate(sundayOf(parseISODate(date)));
}

function refresh() {
  revalidatePath("/admin/physio");
  revalidatePath("/admin/injuries");
}

export async function scheduleSessionAction(formData: FormData) {
  const user = await requireRole(EDITORS);
  const injuryId = Number(formData.get("injuryId"));
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes"));
  const note = String(formData.get("note") ?? "").trim().slice(0, NOTE_MAX_LENGTH) || null;
  // A physio books for themselves; a manager picks the physio.
  const physioUserId = user.role === "physio" ? user.id : Number(formData.get("physioUserId"));
  const keep = { injury: String(injuryId || ""), week: /^\d{4}-\d{2}-\d{2}$/.test(date) ? weekOf(date) : "" };

  const invalid = validateSession({ date, startTime, durationMinutes });
  if (invalid) back({ ...keep, error: invalid });
  if (date < todayInIsrael()) back({ ...keep, error: "אי אפשר לקבוע טיפול בתאריך שעבר" });

  const [injury] = await db
    .select({ id: injuries.id, status: injuries.status, closedAt: injuries.closedAt, playerName: players.displayName })
    .from(injuries)
    .innerJoin(players, eq(injuries.playerId, players.id))
    .where(eq(injuries.id, injuryId))
    .limit(1);
  if (!injury) back({ ...keep, error: "יש לבחור פצוע" });
  if (injury.closedAt) back({ ...keep, error: `${injury.playerName} כבר כשיר. אין צורך בטיפול.` });

  const [physio] = await db
    .select({ id: adminUsers.id, name: adminUsers.displayName })
    .from(adminUsers)
    .where(and(eq(adminUsers.id, physioUserId), eq(adminUsers.role, "physio"), eq(adminUsers.isActive, true)))
    .limit(1);
  if (!physio) back({ ...keep, error: "יש לבחור פיזיותרפיסט" });

  const clash = physioClash(await sessionsOfPhysioOn(physio.id, date), {
    physioUserId: physio.id,
    date,
    startTime,
    durationMinutes,
    status: "scheduled",
  });
  if (clash) back({ ...keep, error: `ל${physio.name} כבר יש טיפול ב-${clash.startTime} (${clash.durationMinutes} דק׳) באותו יום` });

  const now = new Date().toISOString();
  await db.insert(physioSessions).values({
    injuryId,
    physioUserId: physio.id,
    physioName: physio.name,
    date,
    startTime,
    durationMinutes,
    status: "scheduled",
    note,
    createdBy: user.id || null,
    createdAt: now,
  });

  // First treatment booked: the injury moves from "פצוע" to "בטיפול".
  if (injury.status === "injured") {
    await db.update(injuries).set({ status: "treatment", updatedAt: now }).where(eq(injuries.id, injuryId));
    await db.insert(injuryStatusChanges).values({
      injuryId,
      fromStatus: "injured",
      toStatus: "treatment",
      at: now,
      changedBy: user.id || null,
      changedByName: user.displayName,
      note: "נקבע טיפול פיזיו ראשון",
    });
  }
  refresh();
  back({ week: weekOf(date), done: `נקבע טיפול ל${injury.playerName} ב-${date.split("-").reverse().slice(0, 2).join(".")} ${startTime}` });
}

/** Mark a treatment done or cancelled (only while it is still scheduled). */
export async function setSessionStatusAction(formData: FormData) {
  await requireRole(EDITORS);
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  const week = String(formData.get("week") ?? "");
  if (!isSessionStatus(status) || status === "scheduled") back({ week, error: "פעולה לא תקינה" });
  const [session] = await db.select().from(physioSessions).where(eq(physioSessions.id, id)).limit(1);
  if (!session) back({ week, error: "הטיפול לא נמצא" });
  if (session.status !== "scheduled") back({ week, error: "הטיפול כבר עודכן" });
  await db.update(physioSessions).set({ status }).where(eq(physioSessions.id, id));
  refresh();
  back({ week, done: status === "done" ? "הטיפול סומן כבוצע" : "הטיפול בוטל" });
}
