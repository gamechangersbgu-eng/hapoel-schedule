import { weekdayOf } from "@/lib/pitch-rules";
import { addDaysISO } from "@/lib/week";

export const MAX_SERIES_OCCURRENCES = 120;
const MAX_SPAN_DAYS = 366 * 2;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SeriesChoice = "override" | "skip";

export type OccurrenceConflict = {
  slotId: number;
  summary: string;
  overridable: boolean;
};

export type OccurrencePreview = {
  date: string;
  hard: string[];
  conflicts: OccurrenceConflict[];
};

export type BuiltDates = {
  dates: string[];
  truncated: boolean;
};

/** 7 = the same weekdays every week. 14 = those weekdays every second week. */
export type SeriesIntervalDays = 7 | 14;

export function readSeriesInterval(raw: unknown): SeriesIntervalDays {
  const value = typeof raw === "string" ? raw.trim() : raw;
  return value === 14 || value === "14" ? 14 : 7;
}

/** Weekly unless biweekly was explicitly chosen and this form is allowed to offer it. */
export function effectiveInterval(allowBiweekly: boolean, intervalDays: number | null | undefined): SeriesIntervalDays {
  return allowBiweekly && intervalDays === 14 ? 14 : 7;
}

/**
 * Anchor date, plus the chosen weekdays through `until`, plus any extra dates.
 * Omit `intervalDays` (or pass 7) for every week. Pass 14 for every second week:
 * each selected weekday lands 14 days apart, on the same fortnight as the anchor.
 */
export function buildOccurrenceDates(input: {
  anchor: string;
  weekdays: number[];
  until: string;
  extraDates: string[];
  intervalDays?: number;
}): BuiltDates {
  const dates = new Set<string>();
  if (DATE_RE.test(input.anchor)) dates.add(input.anchor);
  for (const extra of input.extraDates) {
    if (DATE_RE.test(extra)) dates.add(extra);
  }

  const weekdays = [...new Set(input.weekdays.filter((day) => day >= 0 && day <= 6))];
  let truncated = false;
  const biweekly = input.intervalDays === 14;
  if (weekdays.length > 0 && DATE_RE.test(input.anchor) && DATE_RE.test(input.until) && input.until >= input.anchor) {
    if (biweekly) {
      const anchorWeekday = weekdayOf(input.anchor);
      for (const weekday of weekdays) {
        const delta = (weekday - anchorWeekday + 14) % 14;
        let cursor = addDaysISO(input.anchor, delta);
        let traveled = delta;
        while (cursor <= input.until && traveled <= MAX_SPAN_DAYS) {
          dates.add(cursor);
          const next = addDaysISO(cursor, 14);
          if (next <= cursor) break;
          cursor = next;
          traveled += 14;
        }
        if (cursor <= input.until) truncated = true;
      }
    } else {
      let cursor = input.anchor;
      for (let step = 0; step <= MAX_SPAN_DAYS && cursor <= input.until; step += 1) {
        if (weekdays.includes(weekdayOf(cursor))) dates.add(cursor);
        const next = addDaysISO(cursor, 1);
        if (next <= cursor) break;
        cursor = next;
      }
      if (cursor <= input.until) truncated = true;
    }
  }

  const sorted = [...dates].sort();
  if (sorted.length > MAX_SERIES_OCCURRENCES) {
    return { dates: sorted.slice(0, MAX_SERIES_OCCURRENCES), truncated: true };
  }
  return { dates: sorted, truncated };
}

export function parseSeriesChoices(raw: string): Record<string, SeriesChoice> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const choices: Record<string, SeriesChoice> = {};
    for (const [date, value] of Object.entries(parsed)) {
      if (!DATE_RE.test(date)) continue;
      if (value === "override" || value === "skip") choices[date] = value;
    }
    return choices;
  } catch {
    return {};
  }
}

/** A home-game overlap or a pitch rule blocks the date. Training overlaps need a choice. */
export function occurrenceDecision(item: OccurrencePreview): "save" | "skip-hard" | "choose" {
  if (item.hard.length > 0 || item.conflicts.some((conflict) => !conflict.overridable)) return "skip-hard";
  if (item.conflicts.length > 0) return "choose";
  return "save";
}
