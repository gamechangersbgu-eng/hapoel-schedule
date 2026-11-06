import type { IfaGameUpsert } from "@/shared/game";
import { DB_TEAM_BY_IFA_TEAM } from "./db-teams";
import type { ScrapedGame } from "./types";

export type SkippedGame = { key: string; reason: string };
export type WritePlan = { rows: IfaGameUpsert[]; skipped: SkippedGame[] };

/** The public grid shows only the time and the note, so the note carries the match details. */
export function gameNote(game: ScrapedGame, opponent: string): string {
  const parts = game.round === null ? [opponent] : ["גביע", opponent];
  if (game.venue) parts.push(game.venue);
  return parts.join(" · ");
}

/**
 * Turns scraped games into database rows. `externalId` is our stable key and not the
 * association's game id, because upcoming games get an id only around match day and
 * switching ids would create a duplicate slot. A calendar row missing from the database
 * throws before anything is written.
 */
export function planWrites(
  games: ScrapedGame[],
  teamIds: Map<string, number>,
  cityNames: string[],
): WritePlan {
  const plan: WritePlan = { rows: [], skipped: [] };
  for (const game of games) {
    const row = DB_TEAM_BY_IFA_TEAM[game.teamId];
    if (!row) {
      plan.skipped.push({ key: game.key, reason: `no calendar row for team ${game.teamId}` });
      continue;
    }
    const teamId = teamIds.get(row);
    if (teamId === undefined) throw new Error(`calendar row "${row}" is not in the database`);
    if (game.isHome === null) {
      plan.skipped.push({ key: game.key, reason: "unknown home or away" });
      continue;
    }
    const opponent = game.isHome ? game.awayTeam : game.homeTeam;
    plan.rows.push({
      teamId,
      date: game.date,
      startTime: game.time,
      gameKind: game.isHome ? "home_game" : "away_game",
      externalId: game.key,
      opponent,
      kickoffTime: game.time,
      cityName: cityNames.find((city) => game.venue?.startsWith(city)) ?? null,
      note: gameNote(game, opponent),
    });
  }
  return plan;
}

export type GameWriter = {
  upsert: (row: IfaGameUpsert) => Promise<unknown>;
  bumpRevision: () => Promise<void>;
};

/** Screens refresh once at the end, even when a failure stops the writing part way through. */
export async function writeRows(rows: IfaGameUpsert[], writer: GameWriter): Promise<number> {
  let written = 0;
  try {
    for (const row of rows) {
      await writer.upsert(row);
      written += 1;
    }
  } finally {
    if (written > 0) await writer.bumpRevision();
  }
  return written;
}
