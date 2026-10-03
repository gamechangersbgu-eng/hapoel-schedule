"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { COOKIE_NAME, createSession, requireAdmin } from "@/lib/auth";
import { getSlotsInWeek } from "@/lib/schedule";
import { getSlotType, isPitchSlot, SLOT_TYPES } from "@/lib/slot-types";
import { addDaysISO, weekDates } from "@/lib/week";

const VALID_TYPES: Set<string> = new Set(SLOT_TYPES.map((item) => item.id));

function refreshSchedule() {
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const password = String(formData.get("password") ?? "");
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return { error: "סיסמה שגויה" };
  }

  const token = await createSession();
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(COOKIE_NAME);
  redirect("/");
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
    const conflictingSlot = await prisma.slot.findFirst({
      where: {
        date: input.date,
        startTime,
        type: input.type,
        ...(input.id ? { id: { not: input.id } } : {}),
      },
      include: {
        team: { select: { name: true } },
      },
    });

    if (conflictingSlot) {
      const pitch = getSlotType(input.type).label;
      return {
        error: `${pitch} כבר תפוס בשעה ${startTime} על ידי ${conflictingSlot.team.name}`,
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
    await prisma.slot.update({ where: { id: input.id }, data });
  } else {
    await prisma.slot.create({ data });
  }

  refreshSchedule();
  return { ok: true };
}

export async function deleteSlot(id: number) {
  await requireAdmin();
  await prisma.slot.delete({ where: { id } });
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
  await requireAdmin();

  const previousStart = addDaysISO(weekStart, -7);
  const source = await getSlotsInWeek(previousStart);

  if (source.length === 0) {
    return { error: "אין נתונים בשבוע הקודם שאפשר להעתיק" };
  }

  const currentDates = weekDates(weekStart);
  await prisma.slot.deleteMany({
    where: {
      date: { gte: currentDates[0], lte: currentDates[6] },
    },
  });

  await prisma.slot.createMany({
    data: source.map((slot) => ({
      teamId: slot.teamId,
      date: addDaysISO(slot.date, 7),
      endDate: slot.endDate ? addDaysISO(slot.endDate, 7) : null,
      startTime: slot.startTime,
      type: slot.type,
      note: slot.note,
    })),
  });

  refreshSchedule();
  return { ok: true, count: source.length };
}
