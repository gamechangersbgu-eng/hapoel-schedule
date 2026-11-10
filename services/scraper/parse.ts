import { EXCLUDED_COMPETITIONS, type IfaTeam } from "./teams";
import type { ScrapedGame, UnmatchedGame } from "./types";

const BYE = "חופשית";
const ROW = /<a\b[^>]*\btable_row\b[^>]*>[\s\S]*?<\/a>/g;
const GAME_ID = /game_id=(-?\d+)/;
const CELL = /<span[^>]*sr-only[^>]*>\s*([^<]*?)\s*<\/span>([^<]*)/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
    const hex = code[1].toLowerCase() === "x";
    return String.fromCodePoint(parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function clean(text: string): string {
  return decode(text).replace(/\s+/g, " ").trim();
}

/** Accepts both forms the site uses: 31/10/2026 and 01/11/26. */
export function parseDate(text: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
  if (!match) throw new Error(`unrecognised date: "${text}"`);
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** The site publishes 00:00 or "טרם נקבע" for a time that has not been set. */
export function parseTime(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match || (Number(match[1]) === 0 && match[2] === "00")) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseResult(text: string): string | null {
  return /\d/.test(text) ? text : null;
}

/** Names may hold a tight hyphen (הפועל י-ם), so only a spaced hyphen separates the sides. */
function splitSides(title: string, teamName: string): [string, string] {
  const parts = title.split(" - ");
  if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
  if (title.startsWith(`${teamName} - `)) return [teamName, title.slice(teamName.length + 3).trim()];
  if (title.endsWith(` - ${teamName}`)) return [title.slice(0, -(teamName.length + 3)).trim(), teamName];
  throw new Error(`cannot split the teams in: "${title}"`);
}

export type ParsedPage = { rows: number; games: ScrapedGame[] };

/**
 * Parses /team-details/team-games/. Byes are dropped from `games` but counted in `rows`,
 * so a caller can tell a page with no rows (layout change or block) from a real schedule.
 * Throws on an unreadable row, because silently losing a match is worse than a failed team.
 */
export function parseTeamGames(html: string, team: IfaTeam, seasonId: number): ParsedPage {
  const games: ScrapedGame[] = [];
  const seen = new Map<string, number>();
  let rows = 0;

  for (const [row] of html.matchAll(ROW)) {
    const id = GAME_ID.exec(row);
    if (!id) continue;
    const cells = new Map<string, string>();
    for (const [, label, value] of row.matchAll(CELL)) cells.set(clean(label), clean(value));
    const title = cells.get("משחק");
    const rawDate = cells.get("תאריך");
    if (title === undefined || rawDate === undefined) continue;
    rows += 1;

    const [homeTeam, awayTeam] = splitSides(title, clean(team.name));
    if (homeTeam === BYE || awayTeam === BYE) continue;

    // The same pairing can repeat in a season, so number the repeats in page order.
    const pairing = `${seasonId}:${team.id}:${homeTeam}|${awayTeam}`;
    const repeat = (seen.get(pairing) ?? 0) + 1;
    seen.set(pairing, repeat);

    const name = clean(team.name);
    games.push({
      key: repeat === 1 ? pairing : `${pairing}#${repeat}`,
      gameId: Number(id[1]) > 0 ? id[1] : null,
      teamId: team.id,
      ageGroup: team.ageGroup,
      competition: team.league,
      round: null,
      date: parseDate(rawDate),
      time: parseTime(cells.get("שעה") ?? ""),
      homeTeam,
      awayTeam,
      isHome: homeTeam === name ? true : awayTeam === name ? false : null,
      venue: cells.get("אצטדיון") || null,
      result: parseResult(cells.get("תוצאה") ?? ""),
    });
  }
  return { rows, games };
}

const NOT_A_LETTER = "(?![א-ת])";
const AGE_PATTERNS: [RegExp, string][] = [
  ...["א", "ב", "ג"].map((letter): [RegExp, string] => [
    new RegExp(`(?:ילדים טרום|טרום ילדים) ${letter}${NOT_A_LETTER}`),
    `טרום ילדים ${letter}`,
  ]),
  ...["א", "ב", "ג"].map((letter): [RegExp, string] => [
    new RegExp(`ילדים ${letter}${NOT_A_LETTER}`),
    `ילדים ${letter}`,
  ]),
  ...["א", "ב", "ג"].map((letter): [RegExp, string] => [
    new RegExp(`נערים ${letter}${NOT_A_LETTER}`),
    `נערים ${letter}`,
  ]),
  [/נוער/, "נוער"],
];

function ageOfCompetition(competition: string): string | null {
  return AGE_PATTERNS.find(([pattern]) => pattern.test(competition))?.[1] ?? null;
}

type ClubGame = {
  Id: number;
  GameDate: string;
  LeagueName: string;
  Round: number | null;
  GameName: string;
  FieldName: string | null;
  GameTime: string | null;
  Result: string | null;
};

export type ParsedWeek = { games: ScrapedGame[]; unmatched: UnmatchedGame[] };

/**
 * Parses one week of GetClubGames and keeps the competitions missing from the team pages.
 * League games are skipped because the team pages already list the whole season. The list
 * names no team id, so a cup game is assigned by its age group and the team's name.
 */
export function parseClubGames(
  text: string,
  week: string,
  teams: IfaTeam[],
  seasonId: number,
): ParsedWeek {
  const data = (JSON.parse(text) as { d?: { RoundTitle?: string; Games?: ClubGame[] | null } }).d;
  if (!data || !data.RoundTitle?.startsWith(week)) {
    throw new Error(`expected week ${week}, got "${data?.RoundTitle ?? "no data"}"`);
  }

  const skipped = new Set([...teams.map((team) => clean(team.league)), ...EXCLUDED_COMPETITIONS]);
  const result: ParsedWeek = { games: [], unmatched: [] };

  for (const game of data.Games ?? []) {
    const competition = clean(game.LeagueName);
    if (skipped.has(competition)) continue;

    const title = clean(game.GameName);
    const date = parseDate(game.GameDate);
    const parts = title.split(" - ");
    if (parts.length !== 2) {
      result.unmatched.push({ date, competition, title });
      continue;
    }
    const [homeTeam, awayTeam] = parts;
    if (homeTeam === BYE || awayTeam === BYE) continue;

    const named = teams.filter((team) => [homeTeam, awayTeam].includes(clean(team.name)));
    const age = ageOfCompetition(competition);
    // Without an age group only a name no other team uses is safe to assign.
    const matches = age ? named.filter((team) => team.ageGroup === age) : named;
    if (matches.length === 0 || (!age && matches.length > 1)) {
      result.unmatched.push({ date, competition, title });
      continue;
    }

    for (const team of matches) {
      const name = clean(team.name);
      result.games.push({
        key: `${seasonId}:${team.id}:${competition}:${game.Round ?? ""}:${homeTeam}|${awayTeam}`,
        gameId: game.Id > 0 ? String(game.Id) : null,
        teamId: team.id,
        ageGroup: team.ageGroup,
        competition,
        round: game.Round ?? null,
        date,
        time: parseTime(clean(game.GameTime ?? "")),
        homeTeam,
        awayTeam,
        isHome: homeTeam === name,
        venue: clean(game.FieldName ?? "") || null,
        result: parseResult(clean(game.Result ?? "")),
      });
    }
  }
  return result;
}
