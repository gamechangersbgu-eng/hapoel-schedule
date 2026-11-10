import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { test } from "node:test";
import { toCsv } from "./csv";
import { parseClubGames, parseDate, parseTeamGames, parseTime } from "./parse";
import { saveResults } from "./save";
import { curlFetch, scrapeAll, teamGamesUrl, weeksBetween } from "./scrape";
import { DB_TEAM_BY_IFA_TEAM } from "./db-teams";
import { planWrites, writeRows } from "./write";
import { TEAMS } from "./teams";

const fixture = readFileSync(
  path.join(process.cwd(), "services/scraper/fixtures/team-games-2373.html"),
  "utf8",
);
const clubWeek = readFileSync(
  path.join(process.cwd(), "services/scraper/fixtures/club-games-2026-11-01.json"),
  "utf8",
);
const youth = TEAMS[0];

test("reads every row of a real page and drops the bye", () => {
  const { rows, games } = parseTeamGames(fixture, youth, 28);
  assert.equal(rows, 19);
  assert.equal(games.length, 18);
  assert.equal(games.filter((game) => game.homeTeam === "חופשית").length, 0);
  assert.equal(games.filter((game) => game.isHome === true).length, 10);
  assert.equal(games.filter((game) => game.isHome === false).length, 8);
});

test("reads a played game", () => {
  const [first] = parseTeamGames(fixture, youth, 28).games;
  assert.deepEqual(first, {
    key: `28:2373:הפ' ב"ש השלושה|מכבי חיפה "הרדי"`,
    gameId: "1121843",
    teamId: 2373,
    ageGroup: "נוער",
    competition: "ליגת העל לנוער",
    round: null,
    date: "2026-08-17",
    time: "19:40",
    homeTeam: `הפ' ב"ש השלושה`,
    awayTeam: `מכבי חיפה "הרדי"`,
    isHome: true,
    venue: "באר שבע וסרמיל 4",
    result: "4-2",
  });
});

test("leaves unknown details of an upcoming game empty", () => {
  const upcoming = parseTeamGames(fixture, youth, 28).games.find((g) => g.date === "2026-11-28");
  assert.ok(upcoming);
  assert.equal(upcoming.gameId, null);
  assert.equal(upcoming.time, null);
  assert.equal(upcoming.venue, null);
  assert.equal(upcoming.result, null);
});

test("every key in a season is unique", () => {
  const { games } = parseTeamGames(fixture, youth, 28);
  assert.equal(new Set(games.map((game) => game.key)).size, games.length);
});

test("dates and times in the formats the site uses", () => {
  assert.equal(parseDate("31/10/2026"), "2026-10-31");
  assert.equal(parseDate("01/11/26"), "2026-11-01");
  assert.throws(() => parseDate("soon"));
  assert.equal(parseTime("00:00"), null);
  assert.equal(parseTime("טרם נקבע"), null);
  assert.equal(parseTime("9:05"), "09:05");
});

test("a tight hyphen in a team name does not split it", () => {
  const html = `<a class="table_row link_url" href="/g?game_id=-1">
    <span class="sr-only">תאריך</span>07/11/26
    <span class="sr-only">משחק</span>הפועל י-ם  - הפ' ב&quot;ש השלושה
  </a>`;
  const [game] = parseTeamGames(html, youth, 28).games;
  assert.equal(game.homeTeam, "הפועל י-ם");
  assert.equal(game.isHome, false);
});

const respondWith = (body: string, status = 200) =>
  (async () => new Response(body, { status })) as typeof fetch;

test("requests the right page", () => {
  assert.equal(
    teamGamesUrl(2373, 28),
    "https://www.football.org.il/team-details/team-games/?team_id=2373&season_id=28",
  );
});

test("a blocked request marks the team failed, not empty", async () => {
  const output = await scrapeAll({
    fetchFn: respondWith("blocked", 403),
    teams: [youth],
    weeks: [],
    delayMs: 0,
  });
  assert.deepEqual(output.teams, [
    { teamId: 2373, ageGroup: "נוער", status: "failed", error: "HTTP 403" },
  ]);
  assert.equal(output.games.length, 0);
});

test("a page without game rows marks the team failed", async () => {
  const output = await scrapeAll({
    fetchFn: respondWith("<html>Just a moment...</html>"),
    teams: [youth],
    weeks: [],
    delayMs: 0,
  });
  assert.equal(output.teams[0].status, "failed");
});

test("one failing team does not lose the others", async () => {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return calls === 1 ? new Response("", { status: 404 }) : new Response(fixture);
  }) as typeof fetch;
  const output = await scrapeAll({ fetchFn, teams: [TEAMS[1], youth], weeks: [], delayMs: 0 });
  assert.deepEqual(output.teams.map((team) => team.status), ["failed", "ok"]);
  assert.equal(output.games.length, 18);
});

test("curlFetch returns Hebrew text, the status and a browser User-Agent", async () => {
  let userAgent = "";
  const server = createServer((request, response) => {
    userAgent = request.headers["user-agent"] ?? "";
    response.statusCode = request.url === "/blocked" ? 403 : 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end("שורה ראשונה\nמשחק");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const ok = await curlFetch(`http://127.0.0.1:${port}/ok`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "שורה ראשונה\nמשחק");
    assert.match(userAgent, /^Mozilla\/5\.0/);
    const blocked = await curlFetch(`http://127.0.0.1:${port}/blocked`);
    assert.equal(blocked.status, 403);
  } finally {
    server.close();
  }
});

test("curlFetch rejects when the server cannot be reached", async () => {
  await assert.rejects(curlFetch("http://127.0.0.1:1/"));
});

test("CSV opens in Excel: BOM, quoted names, sorted, result kept as text", () => {
  const { games } = parseTeamGames(fixture, youth, 28);
  const csv = toCsv([...games].reverse());
  assert.equal(csv[0], "\uFEFF");
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 19);
  assert.equal(
    lines[1],
    `נוער,ליגת העל לנוער,2026-08-17,19:40,בית,"הפ' ב""ש השלושה","מכבי חיפה ""הרדי""",באר שבע וסרמיל 4,4–2,2373,1121843`,
  );
  assert.match(lines[18], /^נוער,ליגת העל לנוער,2027-01-09,,חוץ,/);
});

test("takes only the cup games of a real week and assigns each to its team", () => {
  const { games, unmatched } = parseClubGames(clubWeek, "01/11/2026", TEAMS, 28);
  assert.deepEqual(unmatched, []);
  assert.deepEqual(
    games.map((game) => game.teamId).sort((a, b) => a - b),
    [1440, 2014, 2085, 2294, 2755, 2756, 6485, 7327],
  );
  assert.ok(games.every((game) => game.competition.includes("גביע")));
  const hadera = games.find((game) => game.teamId === 2294);
  assert.deepEqual(hadera, {
    key: `28:2294:גביע נערים א' ע"ש חיים הברפלד ז"ל:4:הפועל חדרה מערב|הפועל ב"ש`,
    gameId: null,
    teamId: 2294,
    ageGroup: "נערים א",
    competition: `גביע נערים א' ע"ש חיים הברפלד ז"ל`,
    round: 4,
    date: "2026-11-07",
    time: "13:30",
    homeTeam: "הפועל חדרה מערב",
    awayTeam: `הפועל ב"ש`,
    isHome: false,
    venue: "חדרה מתחם אימונים סינטטי",
    result: null,
  });
});

test("a cup with no age group and a name shared by teams is reported, not guessed", () => {
  const text = JSON.stringify({
    d: {
      RoundTitle: "01/11/2026 - 07/11/2026",
      Games: [
        { Id: -1, GameDate: "07/11/26", LeagueName: "גביע המדינה", Round: 1, GameName: `הפועל ב"ש - מכבי חיפה`, FieldName: "", GameTime: "00:00", Result: "" },
        { Id: -1, GameDate: "07/11/26", LeagueName: "גביע המדינה", Round: 1, GameName: `הפ' ב"ש השלושה - מכבי חיפה`, FieldName: "", GameTime: "00:00", Result: "" },
      ],
    },
  });
  const { games, unmatched } = parseClubGames(text, "01/11/2026", TEAMS, 28);
  assert.deepEqual(games.map((game) => game.teamId), [2373]);
  assert.equal(unmatched.length, 1);
});

test("a response for a different week is rejected", () => {
  assert.throws(() => parseClubGames(clubWeek, "08/11/2026", TEAMS, 28));
});

test("season weeks are the Sundays the site uses", () => {
  const weeks = weeksBetween("2026-08-02", "2027-06-27");
  assert.equal(weeks.length, 48);
  assert.ok(weeks.includes("25/10/2026"));
  assert.ok(weeks.includes("01/11/2026"));
  assert.ok(weeks.includes("08/11/2026"));
});

test("cup games join the team games, repeats count once and a failed week is reported", async () => {
  const fetchWeekFn = async (week: string) =>
    week === "01/11/2026" ? new Response(clubWeek) : new Response("", { status: 403 });
  const output = await scrapeAll({
    fetchFn: async () => new Response(fixture),
    fetchWeekFn,
    teams: TEAMS,
    weeks: ["01/11/2026", "01/11/2026", "08/11/2026"],
    delayMs: 0,
  });
  assert.equal(output.games.filter((game) => game.round !== null).length, 8);
  assert.deepEqual(output.failedWeeks, [{ week: "08/11/2026", error: "HTTP 403" }]);
});

test("a run with failures never replaces the saved files", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "scraper-"));
  const csvFile = path.join(directory, "games.csv");
  try {
    writeFileSync(csvFile, "good data");
    const blockedTeam = await scrapeAll({
      fetchFn: respondWith("blocked", 403),
      teams: [youth],
      weeks: [],
      delayMs: 0,
    });
    assert.equal(await saveResults(blockedTeam, directory), false);
    assert.equal(readFileSync(csvFile, "utf8"), "good data");
    assert.equal(existsSync(path.join(directory, "games.json")), false);

    const blockedWeek = await scrapeAll({
      fetchFn: async () => new Response(fixture),
      fetchWeekFn: async () => new Response("", { status: 403 }),
      teams: [youth],
      weeks: ["01/11/2026"],
      delayMs: 0,
    });
    assert.equal(await saveResults(blockedWeek, directory), false);
    assert.equal(readFileSync(csvFile, "utf8"), "good data");
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("a successful run replaces both files", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "scraper-"));
  try {
    writeFileSync(path.join(directory, "games.csv"), "old");
    const output = await scrapeAll({
      fetchFn: async () => new Response(fixture),
      teams: [youth],
      weeks: [],
      delayMs: 0,
    });
    assert.equal(await saveResults(output, directory), true);
    assert.equal(JSON.parse(readFileSync(path.join(directory, "games.json"), "utf8")).games.length, 18);
    assert.notEqual(readFileSync(path.join(directory, "games.csv"), "utf8"), "old");
    assert.equal(existsSync(path.join(directory, "games.csv.tmp")), false);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

const calendar = new Map(
  Object.values(DB_TEAM_BY_IFA_TEAM)
    .filter((name) => name !== null)
    .map((name, index) => [name, index + 1]),
);

test("every team on the site has a mapping entry and rows are not shared", () => {
  assert.deepEqual(
    TEAMS.map((team) => team.id).sort(),
    Object.keys(DB_TEAM_BY_IFA_TEAM).map(Number).sort(),
  );
  const rows = Object.values(DB_TEAM_BY_IFA_TEAM).filter((name) => name !== null);
  assert.equal(new Set(rows).size, rows.length);
});

test("a game becomes a database row with a stable id and readable note", () => {
  const { games } = parseTeamGames(fixture, youth, 28);
  const { rows, skipped } = planWrites(games, calendar, ["ירושלים", "נתניה"]);
  assert.equal(rows.length, 18);
  assert.deepEqual(skipped, []);
  assert.deepEqual(rows[0], {
    teamId: calendar.get("נוער"),
    date: "2026-08-17",
    startTime: "19:40",
    gameKind: "home_game",
    externalId: games[0].key,
    opponent: `מכבי חיפה "הרדי"`,
    kickoffTime: "19:40",
    cityName: null,
    note: `מכבי חיפה "הרדי" · באר שבע וסרמיל 4`,
  });
  const away = rows.find((row) => row.date === "2026-10-14");
  assert.equal(away?.gameKind, "away_game");
  assert.equal(away?.cityName, "ירושלים");
  const upcoming = rows.find((row) => row.date === "2026-11-28");
  assert.equal(upcoming?.startTime, null);
  assert.equal(upcoming?.note, "מכבי ת\"א שחר");
});

test("a cup game is labelled in its note", () => {
  const { games } = parseClubGames(clubWeek, "01/11/2026", TEAMS, 28);
  const { rows } = planWrites(games, calendar, []);
  assert.ok(rows.every((row) => row.note?.startsWith("גביע · ")));
});

test("a team without a calendar row is skipped, not guessed", () => {
  const { games } = parseClubGames(clubWeek, "01/11/2026", TEAMS, 28);
  const { skipped } = planWrites(games, calendar, []);
  assert.deepEqual(skipped.map((game) => game.reason), ["no calendar row for team 6485"]);
});

test("a calendar row missing from the database stops before any write", () => {
  const { games } = parseTeamGames(fixture, youth, 28);
  assert.throws(() => planWrites(games, new Map(), []), /נוער/);
});

test("the revision is bumped once, also after a failure part way through", async () => {
  const { rows } = planWrites(parseTeamGames(fixture, youth, 28).games, calendar, []);
  let bumps = 0;
  let upserts = 0;
  const bumpRevision = async () => {
    bumps += 1;
  };
  assert.equal(await writeRows(rows, { upsert: async () => (upserts += 1), bumpRevision }), 18);
  assert.equal(bumps, 1);

  bumps = 0;
  upserts = 0;
  await assert.rejects(
    writeRows(rows, {
      upsert: async () => {
        upserts += 1;
        if (upserts === 3) throw new Error("database down");
      },
      bumpRevision,
    }),
  );
  assert.equal(bumps, 1);
});

test("no successful row means no refresh", async () => {
  let bumps = 0;
  await writeRows([], {
    upsert: async () => undefined,
    bumpRevision: async () => {
      bumps += 1;
    },
  });
  assert.equal(bumps, 0);
});
