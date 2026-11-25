import "server-only";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { ensureTrainingDuration, resolveRotationTemplateId } from "@/db/reference-seed";
import { db, pitches, slotTrainingDetails, slots, teams, trainingSeries } from "@/lib/db";
import { classifyDates } from "@/lib/pitch-board";
import { DEFAULT_TRAINING_MINUTES, toMinutes, toTime } from "@/lib/pitch-rules";
import {
  occurrenceDecision,
  type OccurrencePreview,
  type SeriesChoice,
  type SeriesIntervalDays,
} from "@/lib/recurrence";
import { isFootballSchoolTeam } from "@/lib/team-labels";

export type SeriesSaveInput = {
  anchor: string;
  dates: string[];
  choices: Record<string, SeriesChoice>;
  teamId: number;
  type: string;
  startTime: string;
  durationMinutes: number;
  note: string | null;
  rotationTemplateId: number | null;
  pitchId: number | null;
  subdivisionCode: string | null;
  weekdays: number[];
  untilDate: string | null;
  /** 14 only for בית הספר לכדורגל. Omit or 7 for the existing weekly series. */
  intervalDays?: SeriesIntervalDays;
  status: string;
  statusNote: string | null;
  substituteStaffId: number | null;
  /** Academy טורניר/ליגה. Omitted means a normal training. */
  sessionKind?: "training" | "tournament";
};

export type SeriesSaveResult = {
  created: number;
  skipped: { date: string; reason: string }[];
  error?: string;
  seriesId?: number;
};

function blockedReason(item: OccurrencePreview) {
  const lines = [...item.hard, ...item.conflicts.filter((conflict) => !conflict.overridable).map((conflict) => conflict.summary)];
  return lines.join(" ");
}

/** Pitch-board rules when the training has a pitch; otherwise the same team overlapping itself. */
export async function previewSeries(input: {
  dates: string[];
  teamId: number;
  pitchId: number | null;
  subdivisionCode: string | null;
  startTime: string;
  durationMinutes: number;
  substituteStaffId?: number | null;
  openHours?: boolean;
}): Promise<OccurrencePreview[]> {
  const dates = [...new Set(input.dates)].sort();
  if (input.pitchId) {
    const classified = await classifyDates(dates, {
      teamId: input.teamId,
      pitchId: input.pitchId,
      subdivisionCode: input.subdivisionCode || "whole",
      start: toMinutes(input.startTime),
      durationMinutes: input.durationMinutes,
      substituteStaffId: input.substituteStaffId ?? null,
      openHours: input.openHours === true,
    });
    return classified.map((item) => ({
      date: item.date,
      hard: item.hard,
      conflicts: item.conflicts.map((conflict) => ({
        slotId: conflict.slotId,
        summary: conflict.summary,
        overridable: conflict.overridable,
      })),
    }));
  }

  if (dates.length === 0) return [];
  const rows = await db
    .select({ slot: slots, training: slotTrainingDetails })
    .from(slots)
    .leftJoin(slotTrainingDetails, eq(slotTrainingDetails.slotId, slots.id))
    .where(and(eq(slots.teamId, input.teamId), inArray(slots.date, dates), ne(slots.status, "cancelled")));

  return dates.map((date) => {
    const start = toMinutes(input.startTime);
    const end = start + input.durationMinutes;
    const conflicts = rows
      .filter(({ slot }) => slot.date === date && slot.startTime)
      .flatMap(({ slot, training }) => {
        const otherStart = toMinutes(slot.startTime!);
        const otherEnd = otherStart + (training?.durationMinutes ?? DEFAULT_TRAINING_MINUTES);
        if (!(start < otherEnd && otherStart < end)) return [];
        return [
          {
            slotId: slot.id,
            summary: `לקבוצה כבר יש אימון ב-${toTime(otherStart)}–${toTime(otherEnd)}.`,
            overridable: true,
          },
        ];
      });
    return { date, hard: [], conflicts };
  });
}

export async function saveTrainingSeries(input: SeriesSaveInput): Promise<SeriesSaveResult> {
  const dates = [...new Set(input.dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (!dates.includes(input.anchor)) dates.unshift(input.anchor);
  const ordered = [...new Set(dates)].sort();
  if (ordered.length < 2) return { created: 0, skipped: [], error: "סדרה צריכה לפחות שני מועדים" };

  if (input.intervalDays === 14) {
    const [team] = await db
      .select({ name: teams.name, ageBandCode: teams.ageBandCode })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .limit(1);
    if (!isFootballSchoolTeam(team)) {
      return { created: 0, skipped: [], error: "פעם בשבועיים זמין רק לאקדמיה לכדורגל" };
    }
  }

  const cancelled = input.status === "cancelled";
  const preview = cancelled
    ? ordered.map((date) => ({ date, hard: [], conflicts: [] }))
    : await previewSeries({
        dates: ordered,
        teamId: input.teamId,
        pitchId: input.pitchId,
        subdivisionCode: input.subdivisionCode,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        substituteStaffId: input.substituteStaffId,
        openHours: input.sessionKind === "tournament",
      });
  const byDate = new Map(preview.map((item) => [item.date, item]));

  const anchor = byDate.get(input.anchor);
  if (anchor && occurrenceDecision(anchor) === "skip-hard") {
    return { created: 0, skipped: [], error: blockedReason(anchor) || "אי אפשר לשבץ את המועד הראשון" };
  }

  const skipped: { date: string; reason: string }[] = [];
  const toCreate: { date: string; replaceIds: number[] }[] = [];
  for (const date of ordered) {
    const item = byDate.get(date) ?? { date, hard: [], conflicts: [] };
    const decision = occurrenceDecision(item);
    if (decision === "skip-hard") {
      skipped.push({ date, reason: blockedReason(item) || "אי אפשר לשבץ" });
      continue;
    }
    if (decision === "choose") {
      const choice = input.choices[date];
      if (choice !== "override" && choice !== "skip") {
        return { created: 0, skipped: [], error: "יש לבחור מה לעשות עם כל התנגשות לפני השמירה" };
      }
      if (choice === "skip") {
        skipped.push({ date, reason: item.conflicts.map((conflict) => conflict.summary).join(" ") });
        continue;
      }
      toCreate.push({ date, replaceIds: item.conflicts.map((conflict) => conflict.slotId) });
      continue;
    }
    toCreate.push({ date, replaceIds: [] });
  }

  if (toCreate.length === 0) {
    return { created: 0, skipped, error: "לא נשמר אף מועד" };
  }

  const [series] = await db
    .insert(trainingSeries)
    .values({
      teamId: input.teamId,
      weekdays: input.weekdays.length ? input.weekdays.join(",") : null,
      untilDate: input.untilDate,
      createdAt: new Date().toISOString(),
    })
    .returning({ id: trainingSeries.id });

  if (input.durationMinutes > 0) await ensureTrainingDuration(db, input.durationMinutes);
  const rotationTemplateId = await resolveRotationTemplateId(db, input.rotationTemplateId);

  for (const item of toCreate) {
    if (item.replaceIds.length) {
      const removed = await db
        .delete(slots)
        .where(inArray(slots.id, item.replaceIds))
        .returning({ seriesId: slots.seriesId });
      const seriesIds = [...new Set(removed.map((row) => row.seriesId).filter((id): id is number => id != null))];
      for (const id of seriesIds) {
        const [left] = await db.select({ id: slots.id }).from(slots).where(eq(slots.seriesId, id)).limit(1);
        if (!left) await db.delete(trainingSeries).where(eq(trainingSeries.id, id));
      }
    }
    const [created] = await db
      .insert(slots)
      .values({
        teamId: input.teamId,
        date: item.date,
        endDate: null,
        startTime: input.startTime,
        type: input.type,
        note: input.note,
        status: input.status,
        statusNote: input.statusNote,
        substituteStaffId: input.substituteStaffId,
        seriesId: series.id,
      })
      .returning({ id: slots.id });
    if (input.pitchId || input.durationMinutes > 0 || rotationTemplateId) {
      await db.insert(slotTrainingDetails).values({
        slotId: created.id,
        pitchId: input.pitchId,
        subdivisionCode: input.subdivisionCode,
        durationMinutes: input.durationMinutes > 0 ? input.durationMinutes : null,
        rotationTemplateId,
        sessionKind: input.sessionKind === "tournament" ? "tournament" : "training",
      });
    }
  }

  return { created: toCreate.length, skipped, seriesId: series.id };
}

export async function deleteTrainingScope(slotId: number, scope: "one" | "future" | "series") {
  const [slot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!slot) return null;
  const seriesId = slot.seriesId;

  if (scope === "series" && seriesId) {
    const removed = await db.delete(slots).where(eq(slots.seriesId, seriesId)).returning();
    await db.delete(trainingSeries).where(eq(trainingSeries.id, seriesId));
    return { slot, removed, scope };
  }

  if (scope === "future" && seriesId) {
    const removed = await db
      .delete(slots)
      .where(and(eq(slots.seriesId, seriesId), gte(slots.date, slot.date)))
      .returning();
    const [left] = await db.select({ id: slots.id }).from(slots).where(eq(slots.seriesId, seriesId)).limit(1);
    if (!left) await db.delete(trainingSeries).where(eq(trainingSeries.id, seriesId));
    return { slot, removed, scope };
  }

  const removed = await db.delete(slots).where(eq(slots.id, slotId)).returning();
  if (seriesId) {
    const [left] = await db.select({ id: slots.id }).from(slots).where(eq(slots.seriesId, seriesId)).limit(1);
    if (!left) await db.delete(trainingSeries).where(eq(trainingSeries.id, seriesId));
  }
  return { slot, removed, scope: "one" as const };
}

export async function pitchByCode(code: string) {
  const [pitch] = await db.select().from(pitches).where(eq(pitches.code, code)).limit(1);
  return pitch ?? null;
}

export async function teamName(teamId: number) {
  const [team] = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
  return team?.name ?? "";
}
