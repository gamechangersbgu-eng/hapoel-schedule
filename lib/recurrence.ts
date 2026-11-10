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

/** Anchor date, plus weekly weekdays through `until`, plus any extra dates. */
export function buildOccurrenceDates(input: {
  anchor: string;
  weekdays: number[];
  until: string;
  extraDates: string[];
}): BuiltDates {
  const dates = new Set<string>();
  if (DATE_RE.test(input.anchor)) dates.add(input.anchor);
  for (const extra of input.extraDates) {
    if (DATE_RE.test(extra)) dates.add(extra);
  }

  const weekdays = [...new Set(input.weekdays.filter((day) => day >= 0 && day <= 6))];
  let truncated = false;
  if (weekdays.length > 0 && DATE_RE.test(input.anchor) && DATE_RE.test(input.until) && input.until >= input.anchor) {
    let cursor = input.anchor;
    for (let step = 0; step <= MAX_SPAN_DAYS && cursor <= input.until; step += 1) {
      if (weekdays.includes(weekdayOf(cursor))) dates.add(cursor);
      const next = addDaysISO(cursor, 1);
      if (next <= cursor) break;
      cursor = next;
    }
    if (cursor <= input.until) truncated = true;
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
