"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, pitches, slotTrainingDetails, slots } from "@/lib/db";
import { checkBooking, getPitchDay, toMinutes, toTime } from "@/lib/pitch-board";
import { bumpScheduleRevision } from "@/lib/schedule-revision";
import { requireAdmin } from "@/lib/auth";

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
  const startTime = String(formData.get("startTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes"));
  const rotationRaw = String(formData.get("rotationTemplateId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

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
  if (!durationMinutes) back("יש לבחור משך אימון");

  const day = await getPitchDay(date);
  const problems = checkBooking(day, {
    slotId: idRaw ? Number(idRaw) : undefined,
    teamId,
    pitchId,
    subdivisionCode,
    start: toMinutes(startTime),
    durationMinutes,
  });
  if (problems.length) back(problems.join(" | "));

  const pitch = day.pitches.find((item) => item.id === pitchId)!;
  const slotValues = {
    teamId,
    date,
    endDate: null,
    startTime: toTime(toMinutes(startTime)),
    type: pitch.code,
    note,
  };
  const details = {
    pitchId,
    subdivisionCode,
    durationMinutes,
    rotationTemplateId: rotationRaw ? Number(rotationRaw) : null,
  };

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

  await refresh();
  redirect(boardPath(date, { saved: "1" }));
}

export async function deleteBoardBooking(formData: FormData) {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const id = Number(formData.get("id"));
  if (id) await db.delete(slots).where(eq(slots.id, id));
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
    await refresh();
  }
  redirect(boardPath(date));
}
