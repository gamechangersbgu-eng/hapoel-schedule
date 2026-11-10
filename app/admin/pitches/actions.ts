"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTrainingDuration, resolveRotationTemplateId } from "@/db/reference-seed";
import { db, pitches, slotTrainingDetails, slots } from "@/lib/db";
import { checkBooking, durationBetween, getPitchDay, normalizeClock, toMinutes, toTime } from "@/lib/pitch-board";
import { bumpScheduleRevision } from "@/lib/schedule-revision";
import { requireAdmin } from "@/lib/auth";
import { formatDateHe, logChange } from "@/lib/history";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function boardPath(date: string, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams({ date });
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  return `/admin/pitches?${params.toString()}`;
}

async function refresh() {
  await bumpScheduleRevision();
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/pitches");
  revalidatePath("/tv");
}

/** Create or update a training booking from the board form. */
export async function saveBoardBooking(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const idRaw = String(formData.get("id") ?? "").trim();
  const teamId = Number(formData.get("teamId"));
  const pitchId = Number(formData.get("pitchId"));
  const subdivisionCode = String(formData.get("subdivisionCode") ?? "");
  const startTime = normalizeClock(String(formData.get("startTime") ?? ""));
  const endTime = normalizeClock(String(formData.get("endTime") ?? ""));
  const durationFromClocks = durationBetween(startTime, endTime);
  const durationMinutes = durationFromClocks || Number(formData.get("durationMinutes")) || 0;
  const rotationRaw = String(formData.get("rotationTemplateId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const statusChoice = String(formData.get("status") ?? "active");
  const cancelled = statusChoice === "cancelled";
  const substituteStaffId = statusChoice === "substitute" ? Number(formData.get("substituteStaffId") || 0) || null : null;
  const statusNote = cancelled || substituteStaffId ? String(formData.get("statusNote") ?? "").trim() || null : null;

  const back = (error: string) =>
    redirect(
      boardPath(date, {
        error,
        slot: idRaw || undefined,
        new: idRaw ? undefined : "1",
        team: String(teamId || ""),
        pitch: String(pitchId || ""),
        sub: subdivisionCode,
        time: startTime,
        dur: String(durationMinutes || ""),
      }),
    );

  if (!DATE_RE.test(date)) redirect("/admin/pitches");
  if (!TIME_RE.test(startTime)) back("יש לבחור שעת התחלה");
  if (!TIME_RE.test(endTime) || durationMinutes <= 0) back("יש לבחור שעת סיום שאחרי שעת ההתחלה");
  if (durationMinutes > 12 * 60) back("משך האימון ארוך מדי");

  const day = await getPitchDay(date);
  const problems = checkBooking(day, {
    slotId: idRaw ? Number(idRaw) : undefined,
    teamId,
    pitchId,
    subdivisionCode,
    start: toMinutes(startTime),
    durationMinutes,
  });
  // A cancelled session no longer takes the pitch, so it never conflicts.
  if (problems.length && !cancelled) back(problems.join(" | "));
  if (statusChoice === "substitute" && !substituteStaffId) back("יש לבחור מאמן מחליף");

  const pitch = day.pitches.find((item) => item.id === pitchId)!;
  const slotValues = {
    teamId,
    date,
    endDate: null,
    startTime: toTime(toMinutes(startTime)),
    type: pitch.code,
    note,
    status: cancelled ? "cancelled" : "active",
    statusNote,
    substituteStaffId,
  };
  await ensureTrainingDuration(db, durationMinutes);
  const rotationTemplateId = await resolveRotationTemplateId(db, rotationRaw ? Number(rotationRaw) : null);
  const details = {
    pitchId,
    subdivisionCode,
    durationMinutes,
    rotationTemplateId,
  };

  const team = day.teams.find((item) => item.id === teamId)!;
  const subdivision = day.subdivisions.find((item) => item.code === subdivisionCode)?.labelHe ?? "";
  const what = `${team.name}, ${pitch.nameHe} ${subdivision}, ${formatDateHe(date)} ${startTime}`;
  const substitute = substituteStaffId ? day.coaches.find((coach) => coach.id === substituteStaffId)?.name : null;
  const before = idRaw ? day.bookings.find((item) => item.slotId === Number(idRaw)) : undefined;

  if (idRaw) {
    const slotId = Number(idRaw);
    await db.update(slots).set(slotValues).where(eq(slots.id, slotId));
    await db
      .insert(slotTrainingDetails)
      .values({ slotId, ...details })
      .onConflictDoUpdate({ target: slotTrainingDetails.slotId, set: details });
  } else {
    const [created] = await db.insert(slots).values(slotValues).returning({ id: slots.id });
    await db.insert(slotTrainingDetails).values({ slotId: created.id, ...details });
  }

  const reason = statusNote ? ` (${statusNote})` : "";
  await logChange({
    action: cancelled ? "cancel" : idRaw ? "update" : "create",
    summary: cancelled
      ? `בוטל אימון: ${what}${reason}`
      : substitute
        ? `מאמן מחליף ${substitute}: ${what}${reason}`
        : idRaw
          ? `עודכן אימון: ${what}${before ? ` (היה ${toTime(before.start)})` : ""}`
          : `נוסף אימון: ${what}`,
    teamId,
    slotId: idRaw ? Number(idRaw) : null,
    date,
  });

  await refresh();
  redirect(boardPath(date, { saved: "1" }));
}

export async function deleteBoardBooking(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const id = Number(formData.get("id"));
  if (id) {
    const [removed] = await db.delete(slots).where(eq(slots.id, id)).returning();
    if (removed) {
      await logChange({
        action: "delete",
        summary: `נמחק אימון ב-${formatDateHe(removed.date)} ${removed.startTime ?? ""}`,
        teamId: removed.teamId,
        date: removed.date,
      });
    }
  }
  await refresh();
  redirect(boardPath(date));
}

/** Lock / unlock a reserved pitch (nobody can be booked on it while locked). */
export async function toggleReservedLock(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const pitchId = Number(formData.get("pitchId"));
  const [pitch] = await db.select().from(pitches).where(eq(pitches.id, pitchId)).limit(1);
  if (pitch) {
    await db.update(pitches).set({ isReservedLock: !pitch.isReservedLock }).where(eq(pitches.id, pitchId));
    await logChange({ action: "lock", summary: `${pitch.nameHe} ${pitch.isReservedLock ? "שוחרר" : "שוריין"}`, date });
    await refresh();
  }
  redirect(boardPath(date));
}
