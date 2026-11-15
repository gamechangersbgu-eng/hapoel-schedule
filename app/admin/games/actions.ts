"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cities, db, slotGameDetails, slots, teams } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { departureFor } from "@/lib/game-rules";
import { cityForOpponent, rememberOpponentCity } from "@/lib/opponent-cities";
import { roundToQuarterHour } from "@/lib/pitch-rules";
import { formatDateHe, logChange } from "@/lib/history";
import { bumpScheduleRevision } from "@/lib/schedule-revision";
import { notifyTeamsScheduleChanged } from "@/lib/web-push";
import { GAME_DETAIL_SOURCES } from "@/shared/game";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function sundayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d, 12);
  day.setDate(day.getDate() - day.getDay());
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

async function refresh() {
  await bumpScheduleRevision();
  for (const path of ["/", "/admin", "/admin/games", "/admin/pitches", "/tv"]) revalidatePath(path);
}

export async function saveGame(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id") || 0);
  const week = String(formData.get("week") ?? "");
  const teamId = Number(formData.get("teamId"));
  const date = String(formData.get("date") ?? "");
  const kind = formData.get("kind") === "away_game" ? "away_game" : "home_game";
  const kickoff = roundToQuarterHour(String(formData.get("kickoff") ?? ""));
  const opponent = String(formData.get("opponent") ?? "").trim() || null;
  const num = (name: string) => Number(formData.get(name) || 0) || null;
  const cancelled = formData.get("status") === "cancelled";
  const statusNote = String(formData.get("statusNote") ?? "").trim() || null;

  const back = (error: string): never =>
    redirect(`/admin/games?week=${week}&${id ? `edit=${id}` : "new=1"}&error=${encodeURIComponent(error)}`);
  if (!teamId) back("יש לבחור קבוצה");
  if (!DATE_RE.test(date)) back("יש לבחור תאריך");
  if (!TIME_RE.test(kickoff)) back("יש לבחור שעת שריקה");

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) back("הקבוצה לא נמצאה");

  let departureTime: string | null = null;
  let travelMinutes: number | null = null;
  let cityId = kind === "away_game" ? num("cityId") : null;
  if (kind === "away_game") {
    if (cityId) await rememberOpponentCity(opponent, cityId);
    else cityId = await cityForOpponent(opponent);
  }
  if (cityId) {
    const [city] = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1);
    if (city) {
      travelMinutes = city.travelMinutesFromBeerSheva;
      departureTime = departureFor({
        teamName: team.name,
        date,
        kickoff,
        travelMinutes,
        north: city.northOfHaderaLine,
      }).departure;
    }
  }

  const slotValues = {
    teamId,
    date,
    endDate: null,
    startTime: kickoff,
    type: kind,
    status: cancelled ? "cancelled" : "active",
    statusNote: cancelled ? statusNote : null,
  };
  const details = {
    gameKind: kind,
    opponent,
    kickoffTime: kickoff,
    pitchId: kind === "home_game" ? num("pitchId") : null,
    medicId: kind === "home_game" ? num("medicId") : null,
    medicName: null,
    cityId,
    driverId: kind === "away_game" ? num("driverId") : null,
    departureTime,
    travelMinutes,
  };

  let slotId = id;
  if (id) {
    await db.update(slots).set(slotValues).where(eq(slots.id, id));
    await db
      .insert(slotGameDetails)
      .values({ slotId: id, ...details, source: GAME_DETAIL_SOURCES.ADMIN })
      .onConflictDoUpdate({ target: slotGameDetails.slotId, set: details });
  } else {
    const [created] = await db.insert(slots).values(slotValues).returning({ id: slots.id });
    slotId = created.id;
    await db.insert(slotGameDetails).values({ slotId, ...details, source: GAME_DETAIL_SOURCES.ADMIN });
  }

  const what = `${kind === "home_game" ? "משחק בית" : "משחק חוץ"} של ${team.name} ב-${formatDateHe(date)} ${kickoff}${opponent ? ` נגד ${opponent}` : ""}`;
  await logChange({
    action: cancelled ? "cancel" : id ? "game" : "create",
    summary: cancelled ? `בוטל ${what}${statusNote ? ` (${statusNote})` : ""}` : `${id ? "עודכן" : "נוסף"} ${what}`,
    teamId,
    slotId,
    date,
  });
  await refresh();
  await notifyTeamsScheduleChanged([teamId]);
  redirect(`/admin/games?week=${sundayOf(date)}&saved=1`);
}

export async function deleteGame(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const week = String(formData.get("week") ?? "");
  const [slot] = await db.select().from(slots).where(eq(slots.id, id)).limit(1);
  if (slot) {
    const [team] = await db.select().from(teams).where(eq(teams.id, slot.teamId)).limit(1);
    await db.delete(slots).where(eq(slots.id, id));
    await logChange({
      action: "delete",
      summary: `נמחק משחק של ${team?.name ?? ""} ב-${formatDateHe(slot.date)}`,
      teamId: slot.teamId,
      date: slot.date,
    });
    await refresh();
    await notifyTeamsScheduleChanged([slot.teamId]);
  }
  redirect(`/admin/games?week=${week}`);
}
