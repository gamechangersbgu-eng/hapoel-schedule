"use server";

import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db, players, staff, teamCoaches, teams } from "@/lib/db";
import { defaultCoachForTeam, isISODate } from "@/lib/injuries";

function back(params: Record<string, string>): never {
  redirect(`/admin/players?${new URLSearchParams(params).toString()}`);
}

function refresh() {
  revalidatePath("/admin/players");
  revalidatePath("/admin/injuries");
}

/** One form per team: coach_<playerId> = staff id, or "" for no coach. */
export async function saveTeamCoachesAction(formData: FormData) {
  await requireAdmin();
  const teamId = Number(formData.get("teamId"));
  const staffIds = new Set((await db.select({ id: staff.id }).from(staff)).map((row) => row.id));
  const roster = await db.select({ id: players.id, coachStaffId: players.coachStaffId }).from(players).where(eq(players.teamId, teamId));
  let changed = 0;
  for (const player of roster) {
    const raw = formData.get(`coach_${player.id}`);
    if (raw === null) continue;
    const value = raw === "" ? null : Number(raw);
    if (value !== null && !staffIds.has(value)) continue;
    if (value === player.coachStaffId) continue;
    await db.update(players).set({ coachStaffId: value }).where(eq(players.id, player.id));
    changed += 1;
  }
  refresh();
  back({ done: changed ? `עודכנו ${changed} שחקנים` : "לא שונה כלום", team: String(teamId) });
}

/** Every player without a coach gets the head coach of their team. */
export async function assignDefaultCoachesAction() {
  await requireAdmin();
  const [links, unassigned] = await Promise.all([
    db.select().from(teamCoaches),
    db.select({ id: players.id, teamId: players.teamId }).from(players).where(isNull(players.coachStaffId)),
  ]);
  let assigned = 0;
  for (const player of unassigned) {
    const coach = defaultCoachForTeam(links, player.teamId);
    if (coach == null) continue;
    await db.update(players).set({ coachStaffId: coach }).where(eq(players.id, player.id));
    assigned += 1;
  }
  refresh();
  const left = unassigned.length - assigned;
  back({
    done: `שויכו ${assigned} שחקנים למאמן הראשי של הקבוצה${left ? `. ${left} נשארו בלי מאמן: לקבוצה שלהם אין מאמן ברשימת המאמנים.` : ""}`,
  });
}

export async function addPlayerAction(formData: FormData) {
  await requireAdmin();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const teamId = Number(formData.get("teamId"));
  const birthDate = String(formData.get("birthDate") ?? "").trim() || null;
  const parentPhone = String(formData.get("parentPhone") ?? "").trim() || null;
  if (!displayName) back({ error: "יש למלא שם שחקן" });
  if (birthDate && !isISODate(birthDate)) back({ error: "תאריך לידה לא תקין" });
  const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) back({ error: "יש לבחור קבוצה" });
  const links = await db.select().from(teamCoaches).where(eq(teamCoaches.teamId, teamId));
  await db.insert(players).values({
    teamId,
    displayName,
    birthDate,
    parentPhone,
    coachStaffId: defaultCoachForTeam(links, teamId),
  });
  refresh();
  back({ done: `${displayName} נוסף/ה ל${team.name}`, team: String(teamId) });
}

/** "הסרה" beside a player (bound to the player's id, inside the team's coach form). */
export async function removePlayerAction(id: number) {
  const formData = new FormData();
  formData.set("id", String(id));
  formData.set("active", "0");
  await setPlayerActiveAction(formData);
}

/** Players are never deleted here (injury history stays); they are set inactive. */
export async function setPlayerActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "1";
  const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
  if (!player) back({ error: "השחקן לא נמצא" });
  await db.update(players).set({ isActive: active }).where(eq(players.id, id));
  refresh();
  back({ done: active ? `${player.displayName} הוחזר/ה לרשימה` : `${player.displayName} הוסר/ה מהרשימה`, team: String(player.teamId) });
}
