"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db, slots, teams } from "@/lib/db";
import { getSlotsInWeek } from "@/lib/schedule";
import { getSlotType, isPitchSlot, SLOT_TYPES } from "@/lib/slot-types";
import { addDaysISO, weekDates } from "@/lib/week";

const VALID_TYPES: Set<string> = new Set(SLOT_TYPES.map((item) => item.id));

function refreshSchedule() {
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
};

export async function saveSlot(input: SlotInput) {
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

  if (input.id) {
    await db.update(slots).set(data).where(eq(slots.id, input.id));
  } else {
    await db.insert(slots).values(data);
  }

  refreshSchedule();
  return { ok: true };
}

export async function deleteSlot(id: number) {
  await requireAdmin();
  await db.delete(slots).where(eq(slots.id, id));
  refreshSchedule();
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

  const result = await saveSlot({
    id: idRaw ? Number(idRaw) : undefined,
    teamId,
    date,
    endDate: String(formData.get("endDate") || "") || null,
    startTime: String(formData.get("startTime") || ""),
    type: String(formData.get("type")),
    note: String(formData.get("note") || ""),
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
  const previousStart = addDaysISO(weekStart, -7);
  const source = await getSlotsInWeek(previousStart);

  if (source.length === 0) {
    return { error: "אין נתונים בשבוע הקודם שאפשר להעתיק" };
  }

  const currentDates = weekDates(weekStart);
  await db
    .delete(slots)
    .where(
      and(gte(slots.date, currentDates[0]), lte(slots.date, currentDates[6])),
    );

  await db.insert(slots).values(
    source.map((slot) => ({
      teamId: slot.teamId,
      date: addDaysISO(slot.date, 7),
      endDate: slot.endDate ? addDaysISO(slot.endDate, 7) : null,
      startTime: slot.startTime,
      type: slot.type,
      note: slot.note,
    })),
  );

  refreshSchedule();
  return { ok: true, count: source.length };
}
