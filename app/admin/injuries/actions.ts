"use server";

import { and, eq, gte, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db, injuries, injuryStatusChanges, physioSessions, players } from "@/lib/db";
import {
  INJURY_STATUS_LABELS,
  NOTE_MAX_LENGTH,
  canMoveInjury,
  isBodyPart,
  isISODate,
  isInjuryStatus,
  todayInIsrael,
} from "@/lib/injuries";

const EDITORS = ["owner", "admin", "physio"] as const;

function back(params: Record<string, string>): never {
  redirect(`/admin/injuries?${new URLSearchParams(params).toString()}`);
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalDate(formData: FormData, name: string) {
  const value = text(formData, name);
  return value ? value : null;
}

function refresh() {
  revalidatePath("/admin/injuries");
  revalidatePath("/admin/physio");
}

export async function addInjuryAction(formData: FormData) {
  const user = await requireRole(EDITORS);
  const playerId = Number(formData.get("playerId"));
  const injuredAt = text(formData, "injuredAt");
  const bodyPart = text(formData, "bodyPart");
  const expectedReturn = optionalDate(formData, "expectedReturn");
  const note = text(formData, "note").slice(0, NOTE_MAX_LENGTH) || null;

  if (!Number.isInteger(playerId) || playerId <= 0) back({ error: "יש לבחור שחקן" });
  if (!isISODate(injuredAt)) back({ error: "יש לבחור תאריך פציעה" });
  if (injuredAt > todayInIsrael()) back({ error: "תאריך הפציעה לא יכול להיות בעתיד" });
  if (!isBodyPart(bodyPart)) back({ error: "יש לבחור מקום פציעה" });
  if (expectedReturn && (!isISODate(expectedReturn) || expectedReturn < injuredAt)) {
    back({ error: "צפי החזרה צריך להיות תאריך אחרי הפציעה" });
  }

  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player || !player.isActive) back({ error: "השחקן לא נמצא" });
  const [open] = await db
    .select({ id: injuries.id })
    .from(injuries)
    .where(and(eq(injuries.playerId, playerId), isNull(injuries.closedAt)))
    .limit(1);
  if (open) back({ error: `ל${player.displayName} כבר יש פציעה פתוחה. מעדכנים אותה במקום לפתוח חדשה.`, injury: String(open.id) });

  const now = new Date().toISOString();
  const [created] = await db
    .insert(injuries)
    .values({
      playerId,
      injuredAt,
      bodyPart,
      status: "injured",
      expectedReturn,
      note,
      createdBy: user.id || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await db.insert(injuryStatusChanges).values({
    injuryId: created.id,
    fromStatus: null,
    toStatus: "injured",
    at: now,
    changedBy: user.id || null,
    changedByName: user.displayName,
    note: "פציעה חדשה",
  });
  refresh();
  back({ done: `הפציעה של ${player.displayName} נרשמה`, injury: String(created.id) });
}

/** Status change and/or new expected return. Moving to "כשיר" closes the injury and cancels later treatments. */
export async function updateInjuryAction(formData: FormData) {
  const user = await requireRole(EDITORS);
  const id = Number(formData.get("id"));
  const status = text(formData, "status");
  const expectedReturn = optionalDate(formData, "expectedReturn");
  const note = text(formData, "note").slice(0, NOTE_MAX_LENGTH) || null;

  const [injury] = await db.select().from(injuries).where(eq(injuries.id, id)).limit(1);
  if (!injury) back({ error: "הפציעה לא נמצאה" });
  const keep = { injury: String(id) };
  if (injury.closedAt) back({ ...keep, error: "הפציעה כבר נסגרה. פציעה חדשה נפתחת כרשומה חדשה." });
  if (!isInjuryStatus(status) || !isInjuryStatus(injury.status)) back({ ...keep, error: "סטטוס לא תקין" });
  if (expectedReturn && (!isISODate(expectedReturn) || expectedReturn < injury.injuredAt)) {
    back({ ...keep, error: "צפי החזרה צריך להיות תאריך אחרי הפציעה" });
  }

  const statusChanged = status !== injury.status;
  const returnChanged = expectedReturn !== injury.expectedReturn;
  if (statusChanged && !canMoveInjury(injury.status, status)) {
    back({
      ...keep,
      error: `אי אפשר לעבור מ"${INJURY_STATUS_LABELS[injury.status]}" ל"${INJURY_STATUS_LABELS[status]}"`,
    });
  }
  if (!statusChanged && !returnChanged && !note) back({ ...keep, error: "לא שונה כלום" });

  const now = new Date().toISOString();
  const today = todayInIsrael();
  const closing = statusChanged && status === "fit";
  await db
    .update(injuries)
    .set({ status, expectedReturn, updatedAt: now, closedAt: closing ? now : null })
    .where(eq(injuries.id, id));

  const parts = [
    note,
    returnChanged ? (expectedReturn ? `צפי חזרה: ${expectedReturn}` : "צפי החזרה הוסר") : null,
  ].filter(Boolean);
  let cancelled = 0;
  if (closing) {
    const rows = await db
      .update(physioSessions)
      .set({ status: "cancelled" })
      .where(and(eq(physioSessions.injuryId, id), eq(physioSessions.status, "scheduled"), gte(physioSessions.date, today)))
      .returning({ id: physioSessions.id });
    cancelled = rows.length;
    if (cancelled) parts.push(`${cancelled} טיפולים עתידיים בוטלו`);
  }
  await db.insert(injuryStatusChanges).values({
    injuryId: id,
    fromStatus: injury.status,
    toStatus: status,
    at: now,
    changedBy: user.id || null,
    changedByName: user.displayName,
    note: parts.join(" · ") || null,
  });
  refresh();
  back({ ...keep, done: closing ? "הפציעה נסגרה: השחקן כשיר" : "הפציעה עודכנה" });
}

/** Managers only: remove an injury entered by mistake (with its history and treatments). */
export async function deleteInjuryAction(formData: FormData) {
  await requireRole(["owner", "admin"]);
  const id = Number(formData.get("id"));
  if (formData.get("confirm") !== "1") back({ injury: String(id), error: "יש לסמן אישור לפני מחיקה" });
  await db.delete(injuries).where(eq(injuries.id, id));
  refresh();
  back({ done: "הפציעה נמחקה" });
}
