import { execFile } from "node:child_process";
import { parseClubGames, parseTeamGames } from "./parse";
import {
  CLUB_ID,
  SEASON_FIRST_WEEK,
  SEASON_ID,
  SEASON_LAST_WEEK,
  TEAMS,
  type IfaTeam,
} from "./teams";
import type { ScrapeOutput, TeamStatus } from "./types";

const BASE_URL = "https://www.football.org.il";
// Omer approved a browser User-Agent, as the club's earlier scraper used.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT_SECONDS = 30;
const ATTEMPTS = 2;

type FetchPage = (url: string) => Promise<Response>;

type FetchWeek = (week: string) => Promise<Response>;

export type ScrapeOptions = {
  fetchFn?: FetchPage;
  fetchWeekFn?: FetchWeek;
  /** DD/MM/YYYY Sundays of the club's weekly list. */
  weeks?: string[];
  teams?: IfaTeam[];
  seasonId?: number;
  /** Pause between requests. One request at a time, to stay gentle on the site. */
  delayMs?: number;
  now?: () => Date;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function teamGamesUrl(teamId: number, seasonId: number): string {
  return `${BASE_URL}/team-details/team-games/?team_id=${teamId}&season_id=${seasonId}`;
}

/**
 * Fetches through curl, because the site answers 403 to Node's built-in fetch even with
 * the same User-Agent, while the same request from curl gets 200.
 */
function curlRequest(url: string, extraArgs: string[]): Promise<Response> {
  return new Promise((resolve, reject) => {
    const args = [
      ...extraArgs,
      "--silent",
      "--show-error",
      "--max-time",
      String(TIMEOUT_SECONDS),
      "--user-agent",
      USER_AGENT,
      "--write-out",
      "\n%{http_code}",
      url,
    ];
    execFile("curl", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      const split = stdout.lastIndexOf("\n");
      const status = Number(stdout.slice(split + 1));
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        reject(new Error(`unexpected curl status: "${stdout.slice(split + 1)}"`));
        return;
      }
      resolve(new Response([204, 205, 304].includes(status) ? null : stdout.slice(0, split), { status }));
    });
  });
}

export const curlFetch: FetchPage = (url) => curlRequest(url, []);

const clubGamesRequest: FetchWeek = (week) =>
  curlRequest(`${BASE_URL}/__svws__/SvService.asmx/GetClubGames`, [
    "--header",
    "Content-Type: application/json; charset=utf-8",
    "--data-binary",
    JSON.stringify({ clubGamesSearcher: { ClubId: CLUB_ID, Week: week } }),
  ]);

/** Every Sunday between two YYYY-MM-DD dates, as DD/MM/YYYY. */
export function weeksBetween(first: string, last: string): string[] {
  const weeks: string[] = [];
  const end = Date.parse(`${last}T00:00:00Z`);
  for (let time = Date.parse(`${first}T00:00:00Z`); time <= end; time += 7 * 86_400_000) {
    const [year, month, day] = new Date(time).toISOString().slice(0, 10).split("-");
    weeks.push(`${day}/${month}/${year}`);
  }
  return weeks;
}

async function fetchPage(url: string, fetchFn: FetchPage, delayMs: number): Promise<string> {
  let lastError = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) await sleep(delayMs);
    try {
      const response = await fetchFn(url);
      if (response.ok) return await response.text();
      lastError = `HTTP ${response.status}`;
      // A refusal or a missing page will not change on an immediate retry.
      if (response.status < 500) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

export async function scrapeAll(options: ScrapeOptions = {}): Promise<ScrapeOutput> {
  const {
    fetchFn = curlFetch,
    fetchWeekFn = clubGamesRequest,
    weeks = weeksBetween(SEASON_FIRST_WEEK, SEASON_LAST_WEEK),
    teams = TEAMS,
    seasonId = SEASON_ID,
    delayMs = 1000,
    now = () => new Date(),
  } = options;

  const output: ScrapeOutput = {
    scrapedAt: now().toISOString(),
    seasonId,
    failedWeeks: [],
    unmatched: [],
    teams: [],
    games: [],
  };

  for (const [index, team] of teams.entries()) {
    if (index > 0) await sleep(delayMs);
    let status: TeamStatus;
    try {
      const html = await fetchPage(teamGamesUrl(team.id, seasonId), fetchFn, delayMs);
      const { rows, games } = parseTeamGames(html, team, seasonId);
      // Every team in the list plays this season, so an empty page means a problem.
      if (rows === 0) throw new Error("no game rows found: the page layout may have changed");
      output.games.push(...games);
      status = { teamId: team.id, ageGroup: team.ageGroup, status: "ok", games: games.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status = { teamId: team.id, ageGroup: team.ageGroup, status: "failed", error: message };
    }
    output.teams.push(status);
  }

  // Cup games are only in the club's weekly list, so walk the whole season.
  const seen = new Set<string>();
  for (const week of weeks) {
    await sleep(delayMs);
    try {
      const text = await fetchPage(week, fetchWeekFn, delayMs);
      const parsed = parseClubGames(text, week, teams, seasonId);
      for (const game of parsed.games) {
        if (seen.has(game.key)) continue;
        seen.add(game.key);
        output.games.push(game);
      }
      output.unmatched.push(...parsed.unmatched);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.failedWeeks.push({ week, error: message });
    }
  }
  return output;
}
