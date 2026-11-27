import "server-only";

// Database side of the internal room schedules (gym, video room). Rules: lib/rooms/room-rules.ts.
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, gymBookings, slotGameDetails, slotTrainingDetails, slots, teams, videoRoomBookings } from "@/lib/db";
import { effectiveDepartureTime } from "@/lib/game-logistics";
import { sortTeamsByAge } from "@/lib/team-labels";
import { formatDateHe, logChange } from "@/lib/history";
import { getSlotType, isPitchSlot } from "@/lib/slot-types";
import { approvalPlan } from "./room-requests";
import {
  ROOMS,
  datesToSave,
  formatRange,
  isOverlapError,
  reviewOccurrences,
  validateBooking,
  type ExistingBooking,
  type OccurrenceReview,
  type RoomKind,
  type TeamEvent,
  type ValidBooking,
} from "./room-rules";

const DEFAULT_TRAINING_MINUTES = 90;
const GAME_BLOCK_MINUTES = 120;

/** Both tables have the same columns; the gym table's type stands for either. */
function tableFor(kind: RoomKind): typeof gymBookings {
  return kind === "gym" ? gymBookings : (videoRoomBookings as unknown as typeof gymBookings);
}

export type RoomBookingView = ExistingBooking & { note: string | null; seriesId: string | null };
export type TeamOption = { id: number; name: string };

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

async function loadBookings(kind: RoomKind, from: string, to: string): Promise<RoomBookingView[]> {
  const table = tableFor(kind);
  const rows = await db
    .select({ booking: table, teamName: teams.name })
    .from(table)
    .innerJoin(teams, eq(teams.id, table.teamId))
    .where(and(gte(table.date, from), lte(table.date, to)))
    .orderBy(asc(table.date), asc(table.startMin));
  return rows.map(({ booking, teamName }) => ({
    id: booking.id,
    teamId: booking.teamId,
    teamName,
    date: booking.date,
    start: booking.startMin,
    end: booking.endMin,
    note: booking.note,
    seriesId: booking.seriesId,
  }));
}

export async function loadTeamOptions(): Promise<TeamOption[]> {
  const rows = await db
    .select({ id: teams.id, name: teams.name, sortOrder: teams.sortOrder })
    .from(teams)
    .where(eq(teams.isComments, false))
    .orderBy(asc(teams.sortOrder));
  return sortTeamsByAge(rows);
}

export async function getRoomWeek(kind: RoomKind, from: string, to: string) {
  const [bookings, teamOptions] = await Promise.all([loadBookings(kind, from, to), loadTeamOptions()]);
  return { bookings, teams: teamOptions };
}

/** What else the team does on these dates: trainings, games, and the other room. */
async function loadTeamEvents(kind: RoomKind, teamId: number, dates: string[]): Promise<TeamEvent[]> {
  if (dates.length === 0) return [];
  const otherKind: RoomKind = kind === "gym" ? "video" : "gym";
  const otherTable = tableFor(otherKind);
  const [slotRows, otherRows] = await Promise.all([
    db
      .select({ slot: slots, training: slotTrainingDetails, game: slotGameDetails })
      .from(slots)
      .leftJoin(slotTrainingDetails, eq(slotTrainingDetails.slotId, slots.id))
      .leftJoin(slotGameDetails, eq(slotGameDetails.slotId, slots.id))
      .where(and(eq(slots.teamId, teamId), inArray(slots.date, dates))),
    db
      .select()
      .from(otherTable)
      .where(and(eq(otherTable.teamId, teamId), inArray(otherTable.date, dates))),
  ]);

  const events: TeamEvent[] = [];
  for (const { slot, training, game } of slotRows) {
    if (slot.status === "cancelled") continue;
    if (isPitchSlot(slot.type) && slot.startTime) {
      const start = toMinutes(slot.startTime);
      events.push({
        teamId,
        date: slot.date,
        start,
        end: start + (training?.durationMinutes ?? DEFAULT_TRAINING_MINUTES),
        label: `אימון ב${getSlotType(slot.type).label}`,
      });
      continue;
    }
    if (["home_game", "away_game", "practice_game"].includes(slot.type)) {
      const kickoff = game?.kickoffTime || slot.startTime;
      if (!kickoff) continue;
      const kick = toMinutes(kickoff);
      const leave =
        slot.type === "away_game" ? effectiveDepartureTime(game?.manualDepartureTime, game?.departureTime) : null;
      const departure = leave ? toMinutes(leave) : null;
      events.push({
        teamId,
        date: slot.date,
        start: departure != null && departure < kick ? departure : kick,
        end: kick + GAME_BLOCK_MINUTES,
        label: getSlotType(slot.type).label,
      });
    }
  }
  for (const row of otherRows) {
    events.push({ teamId, date: row.date, start: row.startMin, end: row.endMin, label: ROOMS[otherKind].label });
  }
  return events;
}

export type RoomBookingRequest = {
  teamId: number;
  startTime: string;
  durationMinutes: number;
  /** One date, or every date of a recurring booking. */
  dates: string[];
  note?: string | null;
  /** Editing this booking (single date only). */
  id?: number;
};

/** A real team row: not the schedule's "הערות" row, which is a team in the table but not a team. */
async function bookableTeam(teamId: number) {
  if (!Number.isInteger(teamId) || teamId <= 0) return null;
  const [team] = await db
    .select({ name: teams.name, isComments: teams.isComments })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  return team && !team.isComments ? team : null;
}

export async function previewRoomBooking(kind: RoomKind, request: RoomBookingRequest) {
  const dates = [...new Set(request.dates)].sort();
  if (dates.length === 0) return { items: [] as OccurrenceReview[], error: "יש לבחור תאריך" };
  if (request.teamId > 0 && !(await bookableTeam(request.teamId))) {
    return { items: [] as OccurrenceReview[], error: "יש לבחור קבוצה" };
  }
  const [existing, events] = await Promise.all([
    loadBookings(kind, dates[0], dates[dates.length - 1]),
    loadTeamEvents(kind, request.teamId, dates),
  ]);
  return reviewOccurrences(
    ROOMS[kind],
    dates,
    { teamId: request.teamId, startTime: request.startTime, durationMinutes: request.durationMinutes },
    existing,
    events,
    request.id,
  );
}


export type SaveRoomResult = { ok: true; saved: string[]; skipped: string[] } | { ok: false; error: string };

/**
 * Saves the dates the review allows. Taken dates are skipped. The database's exclusion
 * constraint is the last word: a date another admin took a moment ago is skipped too.
 */
export async function saveRoomBooking(kind: RoomKind, request: RoomBookingRequest, adminName: string): Promise<SaveRoomResult> {
  const room = ROOMS[kind];
  const table = tableFor(kind);
  const review = await previewRoomBooking(kind, request);
  if (review.error) return { ok: false, error: review.error };
  const allowed = datesToSave(review.items);
  const skipped = review.items.filter((item) => item.blockedBy).map((item) => item.date);
  const note = request.note?.trim() || null;
  const stamp = new Date().toISOString();
  const team = await bookableTeam(request.teamId);
  if (!team) return { ok: false, error: "יש לבחור קבוצה" };

  if (request.id) {
    if (allowed.length !== 1) return { ok: false, error: review.items[0]?.blockedBy ?? "לא ניתן לשמור" };
    const checked = validateBooking(room, { ...request, date: allowed[0] });
    if ("error" in checked) return { ok: false, error: checked.error };
    try {
      const updated = await db
        .update(table)
        .set({
          teamId: request.teamId,
          date: allowed[0],
          startMin: checked.booking.start,
          endMin: checked.booking.end,
          note,
          updatedAt: stamp,
        })
        .where(eq(table.id, request.id))
        .returning({ id: table.id });
      // Another admin deleted it while this one was editing.
      if (updated.length === 0) return { ok: false, error: "השיבוץ כבר לא קיים (אולי נמחק בינתיים)" };
    } catch (error) {
      if (isOverlapError(error)) return { ok: false, error: `${room.label} ${room.feminine ? "נתפסה" : "נתפס"} הרגע בשעות האלה` };
      throw error;
    }
    await logChange({
      action: "room",
      summary: `${room.label}: עודכן שיבוץ של ${team.name} ב-${formatDateHe(allowed[0])} ${formatRange(checked.booking.start, checked.booking.end)}`,
      teamId: request.teamId,
      date: allowed[0],
    });
    return { ok: true, saved: allowed, skipped };
  }

  if (allowed.length === 0) return { ok: false, error: review.items[0]?.blockedBy ?? "אין תאריך פנוי לשמירה" };
  const seriesId = allowed.length > 1 ? randomUUID() : null;
  const saved: string[] = [];
  for (const date of allowed) {
    const checked = validateBooking(room, { ...request, date });
    if ("error" in checked) {
      skipped.push(date);
      continue;
    }
    try {
      await db.insert(table).values({
        teamId: request.teamId,
        date,
        startMin: checked.booking.start,
        endMin: checked.booking.end,
        note,
        seriesId,
        createdBy: adminName,
        createdAt: stamp,
        updatedAt: stamp,
      });
      saved.push(date);
    } catch (error) {
      if (!isOverlapError(error)) throw error;
      skipped.push(date);
    }
  }
  if (saved.length > 0) {
    const first = validateBooking(room, { ...request, date: saved[0] });
    const range = "booking" in first ? formatRange(first.booking.start, first.booking.end) : request.startTime;
    await logChange({
      action: "room",
      summary:
        saved.length === 1
          ? `${room.label}: שובצה ${team.name} ב-${formatDateHe(saved[0])} ${range}`
          : `${room.label}: שיבוץ חוזר ל-${team.name} ${range}, ${saved.length} מועדים מ-${formatDateHe(saved[0])} עד ${formatDateHe(saved[saved.length - 1])}`,
      teamId: request.teamId,
      date: saved[0],
    });
  }
  return { ok: true, saved, skipped: [...new Set(skipped)].sort() };
}

/** Deletes one booking, or it and every later date of its recurring series. */
export async function deleteRoomBooking(kind: RoomKind, id: number, scope: "one" | "following") {
  const room = ROOMS[kind];
  const table = tableFor(kind);
  const [booking] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!booking) return;
  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, booking.teamId)).limit(1);
  let count = 1;
  if (scope === "following" && booking.seriesId) {
    const removed = await db
      .delete(table)
      .where(and(eq(table.seriesId, booking.seriesId), gte(table.date, booking.date)))
      .returning({ id: table.id });
    count = removed.length;
  } else {
    await db.delete(table).where(eq(table.id, id));
  }
  await logChange({
    action: "room",
    summary:
      count > 1
        ? `${room.label}: נמחקו ${count} מועדים של ${team.name} מ-${formatDateHe(booking.date)}`
        : `${room.label}: נמחק שיבוץ של ${team.name} ב-${formatDateHe(booking.date)}`,
    teamId: booking.teamId,
    date: booking.date,
  });
}

/**
 * Inserts every date of an approved request, or none of them.
 * A conflict found before insert, or an exclusion-constraint race during insert,
 * leaves the schedule unchanged and returns a Hebrew error.
 */
export async function insertApprovedRoomBookings(
  kind: RoomKind,
  request: { teamId: number; startTime: string; durationMinutes: number; dates: string[]; note?: string | null },
  adminName: string,
): Promise<{ ok: true; saved: string[]; ids: number[]; summary: string } | { ok: false; error: string }> {
  const room = ROOMS[kind];
  const table = tableFor(kind);
  const dates = [...new Set(request.dates)].sort();
  const existing = dates.length > 0 ? await loadBookings(kind, dates[0], dates[dates.length - 1]) : [];
  const plan = approvalPlan(room, { ...request, dates }, existing);
  if (!plan.ok) return plan;
  const team = await bookableTeam(request.teamId);
  if (!team) return { ok: false, error: "יש לבחור קבוצה" };

  const note = request.note?.trim() || null;
  const stamp = new Date().toISOString();
  const seriesId = plan.bookings.length > 1 ? randomUUID() : null;
  const inserted: number[] = [];
  try {
    for (const booking of plan.bookings) {
      const [row] = await db
        .insert(table)
        .values({
          teamId: request.teamId,
          date: booking.date,
          startMin: booking.start,
          endMin: booking.end,
          note,
          seriesId,
          createdBy: adminName,
          createdAt: stamp,
          updatedAt: stamp,
        })
        .returning({ id: table.id });
      inserted.push(row.id);
    }
  } catch (error) {
    if (inserted.length > 0) await db.delete(table).where(inArray(table.id, inserted));
    if (isOverlapError(error)) {
      return { ok: false, error: `${room.label} ${room.feminine ? "נתפסה" : "נתפס"} הרגע בשעות האלה. הבקשה נשארה ממתינה.` };
    }
    throw error;
  }

  return {
    ok: true,
    saved: plan.bookings.map((booking) => booking.date),
    ids: inserted,
    summary: approvedSummary(room.label, team.name, plan.bookings),
  };
}

export async function removeRoomBookings(kind: RoomKind, ids: number[]) {
  if (ids.length === 0) return;
  const table = tableFor(kind);
  await db.delete(table).where(inArray(table.id, ids));
}

function approvedSummary(label: string, teamName: string, bookings: ValidBooking[]) {
  const first = bookings[0];
  const range = formatRange(first.start, first.end);
  if (bookings.length === 1) {
    return `${label}: אושר שיבוץ של ${teamName} ב-${formatDateHe(first.date)} ${range}`;
  }
  const last = bookings[bookings.length - 1];
  return `${label}: אושר שיבוץ חוזר ל-${teamName} ${range}, ${bookings.length} מועדים מ-${formatDateHe(first.date)} עד ${formatDateHe(last.date)}`;
}

/** Today's bookings in both rooms, for the club TV. Pending requests are not included. Never throws. */
export async function getTodayRooms(today: string): Promise<{ kind: RoomKind; label: string; bookings: RoomBookingView[] }[]> {
  try {
    const [gym, video] = await Promise.all([loadBookings("gym", today, today), loadBookings("video", today, today)]);
    return [
      { kind: "gym", label: ROOMS.gym.label, bookings: gym },
      { kind: "video", label: ROOMS.video.label, bookings: video },
    ];
  } catch (error) {
    console.error("[rooms] could not load today's bookings", error);
    return [];
  }
}
