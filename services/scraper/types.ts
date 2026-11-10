/**
 * Proposed shape of a scraped match. This is a draft for the shared contract:
 * it lives here until the team agrees on it and it moves to shared/ (Omer's approval).
 */
export type ScrapedGame = {
  /**
   * Stable identity across runs. The association has no id for upcoming games
   * (game_id=-1), and dates and times may change, so neither can be part of this key.
   */
  key: string;
  /** The association's game id, or null until it assigns one. */
  gameId: string | null;
  teamId: number;
  ageGroup: string;
  /** League or cup name. */
  competition: string;
  /** Cup round. Null for league games: the team page does not publish it. */
  round: number | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, or null when not scheduled yet. */
  time: string | null;
  homeTeam: string;
  awayTeam: string;
  /** null when neither side matches the team's name in teams.ts: check that list. */
  isHome: boolean | null;
  venue: string | null;
  /** As published, e.g. "4-2", or null before the game is played. */
  result: string | null;
};

export type TeamStatus =
  | { teamId: number; ageGroup: string; status: "ok"; games: number }
  | { teamId: number; ageGroup: string; status: "failed"; error: string };

/** A cup game that could not be assigned to a team in teams.ts. */
export type UnmatchedGame = { date: string; competition: string; title: string };

export type ScrapeOutput = {
  scrapedAt: string;
  seasonId: number;
  /** Weeks of the club's list that failed, so their cup games may be missing. */
  failedWeeks: { week: string; error: string }[];
  unmatched: UnmatchedGame[];
  /** A failed team says nothing about its games: never treat them as cancelled. */
  teams: TeamStatus[];
  games: ScrapedGame[];
};
