"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, lte, ne, notInArray } from "drizzle-orm";
import { ensureTrainingDuration, resolveRotationTemplateId } from "@/db/reference-seed";
import { db, slotTrainingDetails, slots, teams } from "@/lib/db";
import { durationBetween, normalizeClock, toMinutes } from "@/lib/pitch-rules";
import { formatDateHe, logChange } from "@/lib/history";
import { bumpScheduleRevision } from "@/lib/schedule-revision";
import { getSlotsInWeek } from "@/lib/schedule";
import { getSlotType, isPitchSlot, SLOT_TYPES } from "@/lib/slot-types";
import { addDaysISO, weekDates } from "@/lib/week";
import { endSession, requireAdmin } from "@/lib/auth";

const VALID_TYPES: Set<string> = new Set(SLOT_TYPES.map((item) => item.id));
const GAME_TYPES = ["home_game", "away_game"];

async function refreshSchedule() {
  await bumpScheduleRevision();
  revalidatePath("/");
  revalidatePath("/admin");
}

export type SlotInput = {
  id?: number;
  teamId: number;
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  type: string;
  note?: string | null;
  /** null clears a previously chosen rotation. Omitted leaves training details alone. */
  rotationTemplateId?: number | null;
  /** null clears a previously saved length. Omitted leaves training details alone. */
  durationMinutes?: number | null;
};

export async function saveSlot(input: SlotInput) {
  await requireAdmin();
  if (!VALID_TYPES.has(input.type)) {
    return { error: "סוג אימון לא חוקי" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { error: "תאריך לא חוקי" };
  }

  const endDate =
    input.type === "camp"
      ? input.endDate && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
        ? input.endDate
        : input.date
      : null;
  const startTime = input.startTime?.trim() || null;

  if (isPitchSlot(input.type) && !startTime) {
    return { error: "יש לבחור שעה עבור אימון במגרש" };
  }

  if (isPitchSlot(input.type) && startTime) {
    const [conflictingSlot] = await db
      .select({ teamName: teams.name })
      .from(slots)
      .innerJoin(teams, eq(slots.teamId, teams.id))
      .where(
        and(
          eq(slots.date, input.date),
          eq(slots.startTime, startTime),
          eq(slots.type, input.type),
          input.id ? ne(slots.id, input.id) : undefined,
        ),
      )
      .limit(1);

    if (conflictingSlot) {
      const pitch = getSlotType(input.type).label;
      return {
        error: `${pitch} כבר תפוס בשעה ${startTime} על ידי ${conflictingSlot.teamName}`,
      };
    }
  }

  const data = {
    teamId: input.teamId,
    date: input.date,
    endDate,
    startTime,
    type: input.type,
    note: input.note?.trim() || null,
  };

  let slotId = input.id ?? null;
  if (input.id) {
    await db.update(slots).set(data).where(eq(slots.id, input.id));
  } else {
    const [created] = await db.insert(slots).values(data).returning({ id: slots.id });
    slotId = created.id;
  }
  if (slotId && isPitchSlot(input.type) && (input.rotationTemplateId !== undefined || input.durationMinutes !== undefined)) {
    const rotationTemplateId = await resolveRotationTemplateId(db, input.rotationTemplateId);
    const durationMinutes =
      input.durationMinutes && input.durationMinutes > 0 && input.durationMinutes <= 12 * 60
        ? input.durationMinutes
        : null;
    if (durationMinutes) await ensureTrainingDuration(db, durationMinutes);
    await db
      .insert(slotTrainingDetails)
      .values({ slotId, rotationTemplateId, durationMinutes })
      .onConflictDoUpdate({
        target: slotTrainingDetails.slotId,
        set: { rotationTemplateId, durationMinutes },
      });
  }

  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, input.teamId)).limit(1);
  await logChange({
    action: input.id ? "update" : "create",
    summary: `${input.id ? "עודכן" : "נוסף"}: ${team?.name ?? ""}, ${getSlotType(input.type).label}, ${formatDateHe(input.date)}${startTime ? ` ${startTime}` : ""}`,
    teamId: input.teamId,
    slotId,
    date: input.date,
  });

  await refreshSchedule();
  return { ok: true };
}

export async function deleteSlot(id: number) {
  await requireAdmin();
  const [removed] = await db.delete(slots).where(eq(slots.id, id)).returning();
  if (removed) {
    await logChange({
      action: "delete",
      summary: `נמחק: ${getSlotType(removed.type).label}, ${formatDateHe(removed.date)}${removed.startTime ? ` ${removed.startTime}` : ""}`,
      teamId: removed.teamId,
      date: removed.date,
    });
  }
  await refreshSchedule();
  return { ok: true };
}

function adminWeekPath(
  week: string,
  extra?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams({ week });
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return `/admin?${params.toString()}`;
}

export async function saveSlotForm(formData: FormData) {
  const week = String(formData.get("week") ?? "");
  const teamId = Number(formData.get("teamId"));
  const date = String(formData.get("date"));
  const idRaw = String(formData.get("id") ?? "").trim();

  const startTime = normalizeClock(String(formData.get("startTime") || ""));
  const endTime = normalizeClock(String(formData.get("endTime") || ""));
  const durationMinutes = durationBetween(startTime, endTime);
  const rotationRaw = String(formData.get("rotationTemplateId") ?? "").trim();

  if (startTime && endTime && toMinutes(endTime) <= toMinutes(startTime)) {
    redirect(
      adminWeekPath(week, {
        team: String(teamId),
        date,
        slot: idRaw || undefined,
        error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
      }),
    );
  }

  const result = await saveSlot({
    id: idRaw ? Number(idRaw) : undefined,
    teamId,
    date,
    endDate: String(formData.get("endDate") || "") || null,
    startTime,
    type: String(formData.get("type")),
    note: String(formData.get("note") || ""),
    rotationTemplateId: rotationRaw ? Number(rotationRaw) : null,
    durationMinutes: durationMinutes > 0 ? durationMinutes : null,
  });

  if (result && "error" in result && result.error) {
    redirect(
      adminWeekPath(week, {
        team: String(teamId),
        date,
        slot: idRaw || undefined,
        error: result.error,
      }),
    );
  }

  redirect(adminWeekPath(week));
}

export async function deleteSlotForm(formData: FormData) {
  const week = String(formData.get("week") ?? "");
  const id = Number(formData.get("id"));
  await deleteSlot(id);
  redirect(adminWeekPath(week));
}

export async function copyPreviousWeekForm(formData: FormData) {
  const week = String(formData.get("week") ?? "");
  const result = await copyPreviousWeek(week);
  if (result && "error" in result && result.error) {
    redirect(adminWeekPath(week, { error: result.error }));
  }
  redirect(adminWeekPath(week, { copied: "1" }));
}

export async function copyPreviousWeek(weekStart: string) {
  await requireAdmin();
  const previousStart = addDaysISO(weekStart, -7);
  // Games are not copied or removed: they come from the IFA fixtures (or are entered one by one).
  const source = (await getSlotsInWeek(previousStart)).filter((slot) => !GAME_TYPES.includes(slot.type));

  if (source.length === 0) {
    return { error: "אין נתונים בשבוע הקודם שאפשר להעתיק" };
  }

  const currentDates = weekDates(weekStart);
  await db
    .delete(slots)
    .where(
      and(
        gte(slots.date, currentDates[0]),
        lte(slots.date, currentDates[6]),
        notInArray(slots.type, GAME_TYPES),
      ),
    );

  // Copy each item with its pitch part / duration; cancellations and substitutes are not copied.
  const details = await db.select().from(slotTrainingDetails);
  const detailBySlot = new Map(details.map((row) => [row.slotId, row]));
  for (const slot of source) {
    const [created] = await db
      .insert(slots)
      .values({
        teamId: slot.teamId,
        date: addDaysISO(slot.date, 7),
        endDate: slot.endDate ? addDaysISO(slot.endDate, 7) : null,
        startTime: slot.startTime,
        type: slot.type,
        note: slot.note,
      })
      .returning({ id: slots.id });
    const detail = detailBySlot.get(slot.id);
    if (detail) {
      await db.insert(slotTrainingDetails).values({
        slotId: created.id,
        pitchId: detail.pitchId,
        subdivisionCode: detail.subdivisionCode,
        durationMinutes: detail.durationMinutes,
        rotationTemplateId: detail.rotationTemplateId,
      });
    }
  }
  await logChange({
    action: "copy_week",
    summary: `הועתק השבוע של ${formatDateHe(previousStart)} לשבוע של ${formatDateHe(weekStart)} (${source.length} פריטים)`,
    date: weekStart,
  });

  await refreshSchedule();
  return { ok: true, count: source.length };
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}
