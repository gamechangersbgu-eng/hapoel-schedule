"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, staff, staffUnavailability, staffWorkDays, teamCoaches, teams } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ABSENCE_TYPES, absenceLabel } from "@/lib/coaches";
import { formatDateHe, logChange } from "@/lib/history";
import { isManagementRole } from "@/lib/update-recipients";
import { nationalIdError, normalizeNationalId } from "@/lib/national-id";

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
  // The role is chosen per team below (מאמן / עוזר מאמן); the general title stays "מאמן".
  const roleLabel = "מאמן";
  const nationalIdRaw = String(formData.get("nationalId") ?? "").trim();
  // One choice per team: "head" (מאמן), "assistant" (עוזר מאמן) or empty.
  const teamRoles = [...formData.entries()]
    .filter(([key, value]) => key.startsWith("teamRole-") && (value === "head" || value === "assistant"))
    .map(([key, value]) => ({ teamId: Number(key.slice("teamRole-".length)), isPrimary: value === "head" }))
    .filter((item) => item.teamId > 0);
  const teamIds = teamRoles.map((item) => item.teamId);
  const workDays = formData.getAll("workDays").map(Number).filter((d) => d >= 0 && d <= 6);
  if (!name) back({ error: "יש למלא שם", ...(id ? { edit: String(id) } : { new: "1" }) });
  // The ID is optional; when filled it must be a valid Israeli ID.
  const idError = nationalIdRaw ? nationalIdError(nationalIdRaw) : null;
  if (idError) back({ error: idError, ...(id ? { edit: String(id) } : { new: "1" }) });
  const nationalId = nationalIdRaw ? normalizeNationalId(nationalIdRaw) : null;

  let staffId = id;
  if (id) {
    const [existing] = await db
      .select({ receivesAllUpdates: staff.receivesAllUpdates })
      .from(staff)
      .where(eq(staff.id, id))
      .limit(1);
    if (existing?.receivesAllUpdates) back({ error: "איש הנהלה נערך במקטע ההנהלה", edit: String(id) });
    await db.update(staff).set({ displayName: name, phone, nationalId }).where(eq(staff.id, id));
  } else {
    const [created] = await db.insert(staff).values({ displayName: name, phone, roleLabel, nationalId }).returning({ id: staff.id });
    staffId = created.id;
  }

  await db.delete(teamCoaches).where(eq(teamCoaches.staffId, staffId));
  if (teamIds.length) {
    await db
      .insert(teamCoaches)
      .values(teamRoles.map(({ teamId, isPrimary }) => ({ teamId, staffId, coachName: name, isPrimary })));
  }
  await db.delete(staffWorkDays).where(eq(staffWorkDays.staffId, staffId));
  if (workDays.length) {
    await db.insert(staffWorkDays).values(workDays.map((weekday) => ({ staffId, weekday })));
  }

  const teamNames = teamIds.length
    ? (await db.select({ id: teams.id, name: teams.name }).from(teams))
        .filter((t) => teamIds.includes(t.id))
        .map((t) => (teamRoles.find((item) => item.teamId === t.id)?.isPrimary ? t.name : `${t.name} – עוזר`))
    : [];
  await logChange({
    action: "coach",
    summary: `${id ? "עודכן" : "נוסף"} מאמן ${name}${teamNames.length ? ` (${teamNames.join(", ")})` : ""}`,
  });
  back({ done: `${name} נשמר` });
}

/** Optional assistant for one team. Head-coach links stay as they are. */
export async function saveTeamAssistant(formData: FormData) {
  await requireAdmin();
  const teamId = Number(formData.get("teamId"));
  const staffId = Number(formData.get("assistantStaffId") || 0) || null;
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team || team.isComments) back({ error: "הקבוצה לא נמצאה" });

  if (!staffId) {
    await db.delete(teamCoaches).where(and(eq(teamCoaches.teamId, teamId), eq(teamCoaches.isPrimary, false)));
    await logChange({ action: "coach", summary: `הוסר עוזר המאמן של ${team.name}` });
    back({ done: `ל${team.name} אין עוזר מאמן` });
  }

  const [person] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  if (!person || person.receivesAllUpdates) back({ error: "יש לבחור מאמן מהרשימה" });
  const [headLink] = await db
    .select({ id: teamCoaches.id })
    .from(teamCoaches)
    .where(and(eq(teamCoaches.teamId, teamId), eq(teamCoaches.staffId, staffId), eq(teamCoaches.isPrimary, true)))
    .limit(1);
  if (headLink) back({ error: `${person.displayName} כבר המאמן של ${team.name}. עוזר המאמן הוא אדם נוסף.` });

  await db.delete(teamCoaches).where(and(eq(teamCoaches.teamId, teamId), eq(teamCoaches.isPrimary, false)));
  await db.insert(teamCoaches).values({
    teamId,
    staffId,
    coachName: person.displayName,
    isPrimary: false,
  });
  await logChange({ action: "coach", summary: `עוזר מאמן ${person.displayName} בקבוצה ${team.name}` });
  back({ done: `עוזר המאמן של ${team.name}: ${person.displayName}` });
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Add or update a management contact. They are told about every team, and are not linked to one team. */
export async function saveManagement(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const roleLabel = String(formData.get("roleLabel") ?? "").trim();
  if (!name || !isManagementRole(roleLabel)) {
    back({ error: "יש למלא שם ולבחור תפקיד מהרשימה" });
  }
  if (!phone && !email) back({ error: "צריך טלפון או אימייל — זה ערוץ העדכון, כמו אצל המאמנים" });
  if (email && !EMAIL_RE.test(email)) back({ error: "האימייל לא תקין" });

  if (id) {
    await db.update(staff).set({ displayName: name, phone, email, roleLabel, receivesAllUpdates: true }).where(eq(staff.id, id));
    await db.delete(teamCoaches).where(eq(teamCoaches.staffId, id));
    await db.delete(staffWorkDays).where(eq(staffWorkDays.staffId, id));
  } else {
    await db.insert(staff).values({ displayName: name, phone, email, roleLabel, receivesAllUpdates: true });
  }

  await logChange({
    action: "coach",
    summary: `${id ? "עודכן" : "נוסף"} איש הנהלה ${name} (${roleLabel})`,
  });
  back({ done: `${name} נשמר ויקבל עדכונים מכל הקבוצות` });
}

export async function deleteManagement(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const [row] = await db.delete(staff).where(and(eq(staff.id, id), eq(staff.receivesAllUpdates, true))).returning();
  if (row) await logChange({ action: "coach", summary: `הוסר איש הנהלה ${row.displayName}` });
  back({ done: `${row?.displayName ?? "איש ההנהלה"} הוסר` });
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
