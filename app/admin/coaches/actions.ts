"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, staff, staffUnavailability, staffWorkDays, teamCoaches, teams } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ABSENCE_TYPES, absenceLabel } from "@/lib/coaches";
import { formatDateHe, logChange } from "@/lib/history";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function back(params: Record<string, string>): never {
  revalidatePath("/admin/coaches");
  revalidatePath("/admin/pitches");
  redirect(`/admin/coaches?${new URLSearchParams(params).toString()}`);
}

/** Add or update a coach: details, teams and work days. */
export async function saveCoach(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const roleLabel = String(formData.get("roleLabel") ?? "").trim() || "מאמן";
  const teamIds = formData.getAll("teamIds").map(Number).filter(Boolean);
  const workDays = formData.getAll("workDays").map(Number).filter((d) => d >= 0 && d <= 6);
  if (!name) back({ error: "יש למלא שם", ...(id ? { edit: String(id) } : { new: "1" }) });

  let staffId = id;
  if (id) {
    await db.update(staff).set({ displayName: name, phone, roleLabel }).where(eq(staff.id, id));
  } else {
    const [created] = await db.insert(staff).values({ displayName: name, phone, roleLabel }).returning({ id: staff.id });
    staffId = created.id;
  }

  await db.delete(teamCoaches).where(eq(teamCoaches.staffId, staffId));
  if (teamIds.length) {
    await db.insert(teamCoaches).values(teamIds.map((teamId) => ({ teamId, staffId, coachName: name, isPrimary: true })));
  }
  await db.delete(staffWorkDays).where(eq(staffWorkDays.staffId, staffId));
  if (workDays.length) {
    await db.insert(staffWorkDays).values(workDays.map((weekday) => ({ staffId, weekday })));
  }

  const teamNames = teamIds.length
    ? (await db.select({ id: teams.id, name: teams.name }).from(teams)).filter((t) => teamIds.includes(t.id)).map((t) => t.name)
    : [];
  await logChange({
    action: "coach",
    summary: `${id ? "עודכן" : "נוסף"} מאמן ${name}${teamNames.length ? ` (${teamNames.join(", ")})` : ""}`,
  });
  back({ done: `${name} נשמר` });
}

export async function deleteCoach(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const [row] = await db.delete(staff).where(eq(staff.id, id)).returning();
  if (row) await logChange({ action: "coach", summary: `הוסר מאמן ${row.displayName}` });
  back({ done: `${row?.displayName ?? "המאמן"} הוסר` });
}

export async function addAbsence(formData: FormData) {
  await requireAdmin();
  const staffId = Number(formData.get("staffId"));
  const type = String(formData.get("type") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endRaw = String(formData.get("endDate") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const ok = ABSENCE_TYPES.some((item) => item.id === type);
  if (!ok || !DATE_RE.test(startDate)) back({ error: "יש לבחור סוג היעדרות ותאריך", edit: String(staffId) });
  const endDate = DATE_RE.test(endRaw) && endRaw >= startDate ? endRaw : null;

  const [person] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  await db.insert(staffUnavailability).values({ staffId, unavailabilityType: type, startDate, endDate, note });
  await logChange({
    action: "coach",
    summary: `${person?.displayName ?? "מאמן"}: ${absenceLabel(type)} ${formatDateHe(startDate)}${endDate && endDate !== startDate ? `–${formatDateHe(endDate)}` : ""}${note ? ` (${note})` : ""}`,
    date: startDate,
  });
  back({ done: "ההיעדרות נשמרה. האימונים שמושפעים מסומנים בלוח המגרשים.", edit: String(staffId) });
}

export async function deleteAbsence(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const staffId = Number(formData.get("staffId"));
  await db.delete(staffUnavailability).where(and(eq(staffUnavailability.id, id), eq(staffUnavailability.staffId, staffId)));
  await logChange({ action: "coach", summary: "הוסרה היעדרות של מאמן" });
  back({ done: "ההיעדרות הוסרה", edit: String(staffId) });
}
