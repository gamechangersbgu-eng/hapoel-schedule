import { formatISODate, parseISODate, sundayOf } from "@/lib/week";

export function dayElementId(date: string) {
  return `day-${date}`;
}

export type TodayJump =
  | { kind: "select"; day: string }
  | { kind: "navigate"; day: string; week: string; href: string };

/**
 * Jump to today. The phone view keeps the loaded week when today is in it,
 * and otherwise opens the week that contains today with that day selected.
 */
export function todayJump(viewingWeekStart: string, today: string): TodayJump {
  const week = formatISODate(sundayOf(parseISODate(today)));
  if (viewingWeekStart === week) return { kind: "select", day: today };
  return { kind: "navigate", day: today, week, href: `/?week=${week}&day=${today}` };
}

export function scrollToDay(date: string) {
  if (typeof document === "undefined") return;
  document.getElementById(dayElementId(date))?.scrollIntoView({ behavior: "smooth", block: "start" });
}
