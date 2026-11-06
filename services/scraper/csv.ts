import type { ScrapedGame } from "./types";

const HEADERS = [
  "קבוצת גיל",
  "מסגרת",
  "תאריך",
  "שעה",
  "בית/חוץ",
  "קבוצת בית",
  "קבוצת חוץ",
  "מגרש",
  "תוצאה",
  "מזהה קבוצה",
  "מזהה משחק",
];

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function homeOrAway(isHome: boolean | null): string {
  if (isHome === null) return "";
  return isHome ? "בית" : "חוץ";
}

/** Excel opens with a UTF-8 BOM and CRLF without garbling Hebrew. Sorted by date, then time. */
export function toCsv(games: ScrapedGame[]): string {
  const sorted = [...games].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.teamId - b.teamId,
  );
  const rows = sorted.map((game) => [
    game.ageGroup,
    game.competition,
    game.date,
    game.time ?? "",
    homeOrAway(game.isHome),
    game.homeTeam,
    game.awayTeam,
    game.venue ?? "",
    // A plain hyphen would make Excel read 4-2 as a date, so results use an en dash.
    game.result?.replace("-", "–") ?? "",
    String(game.teamId),
    game.gameId ?? "",
  ]);
  const lines = [HEADERS, ...rows].map((row) => row.map(escapeCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
