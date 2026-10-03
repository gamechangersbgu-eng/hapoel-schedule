const DAY_MS = 24 * 60 * 60 * 1000;

export const HEBREW_DAY_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;

function atNoon(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return atNoon(y, m - 1, d);
}

export function formatISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sundayOf(date: Date) {
  const copy = atNoon(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export function currentWeekStart() {
  return formatISODate(sundayOf(new Date()));
}

export function addDaysISO(iso: string, days: number) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

export function weekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
}

export function weekNumber(weekStart: string, seasonStart: string) {
  const start = sundayOf(parseISODate(seasonStart));
  const week = parseISODate(weekStart);
  const diff = Math.round((week.getTime() - start.getTime()) / (7 * DAY_MS));
  return diff + 1;
}

export function formatDayMonth(iso: string) {
  const date = parseISODate(iso);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

export function formatWeekRange(weekStart: string) {
  const end = addDaysISO(weekStart, 6);
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(end)}`;
}

export function isValidWeekStart(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return parseISODate(value).getDay() === 0;
}

export function resolveWeekStart(value: string | null | undefined) {
  if (isValidWeekStart(value)) return value as string;
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatISODate(sundayOf(parseISODate(value)));
  }
  return currentWeekStart();
}
