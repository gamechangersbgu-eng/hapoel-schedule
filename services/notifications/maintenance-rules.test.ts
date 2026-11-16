import assert from "node:assert/strict";
import test from "node:test";
import {
  findFreeWindow,
  israelToday,
  pitchCodeFromNote,
  planGamePrepTasks,
  planWeeklyTask,
  reconcileTasks,
  visibleOpenTasks,
  isOverdue,
  officialVenueKnown,
  overridesToClear,
  unknownVenueGames,
  urgentUnknownCount,
  venueFromNote,
  type GameForMaintenance,
} from "./maintenance-rules";

function game(overrides: Partial<GameForMaintenance>): GameForMaintenance {
  return {
    slotId: 1,
    date: "2026-11-22",
    type: "home_game",
    status: "active",
    kickoff: "10:00",
    teamName: "נערים א",
    ageBandLabel: "נוער עד ילדים ב",
    opponent: "יריב",
    pitchCode: null,
    note: null,
    ...overrides,
  };
}

test("the venue in the scraper note names the pitch", () => {
  assert.equal(pitchCodeFromNote("יריב · באר שבע וסרמיל 1"), "vasermil_1");
  assert.equal(pitchCodeFromNote("גביע · יריב · באר שבע וסרמיל 3"), "vasermil_3");
  assert.equal(pitchCodeFromNote("יריב · באר שבע טאובל"), null);
  assert.equal(pitchCodeFromNote("וסרמיל 12"), null);
  assert.equal(pitchCodeFromNote(null), null);
});

test("a game on Sunday shows up on Thursday, two calendar days before", () => {
  const [task] = planGamePrepTasks([game({ date: "2026-11-22", note: "יריב · באר שבע וסרמיל 1" })]);
  assert.equal(task.pitchCode, "vasermil_1");
  assert.equal(task.showFrom, "2026-11-20");
  assert.equal(task.kind, "game_prep");
});

test("two games on the same pitch and day are one task, earliest kickoff first", () => {
  const tasks = planGamePrepTasks([
    game({ slotId: 2, kickoff: "12:00", teamName: "נוער", note: "באר שבע וסרמיל 1" }),
    game({ slotId: 1, kickoff: "09:30", note: "באר שבע וסרמיל 1" }),
    game({ slotId: 3, kickoff: "11:00", note: "באר שבע וסרמיל 3" }),
  ]);
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks[0].slotIds, [1, 2]);
  assert.equal(tasks[0].startTime, "09:30");
  assert.match(tasks[0].summary, /^09:30 נערים א/);
});

test("an admin-set pitch wins over the note", () => {
  const [task] = planGamePrepTasks([game({ pitchCode: "vasermil_3", note: "באר שבע וסרמיל 1" })]);
  assert.equal(task.pitchCode, "vasermil_3");
});

test("practice, away, cancelled, Vasermil 4 and other venues make no task", () => {
  const tasks = planGamePrepTasks([
    game({ type: "practice_game", note: "וסרמיל 1" }),
    game({ type: "away_game", note: "וסרמיל 1" }),
    game({ status: "cancelled", note: "וסרמיל 1" }),
    game({ note: "באר שבע וסרמיל 4" }),
    game({ note: "באר שבע טאובל" }),
    game({ note: null }),
  ]);
  assert.deepEqual(tasks, []);
});

test("free window skips trainings and keeps to working hours", () => {
  assert.equal(findFreeWindow([]), 8 * 60);
  assert.equal(findFreeWindow([{ start: 8 * 60, end: 9 * 60 + 30 }]), 9 * 60 + 30);
  assert.equal(findFreeWindow([{ start: 9 * 60, end: 14 * 60 }]), null);
  assert.equal(findFreeWindow([{ start: 10 * 60, end: 16 * 60 }]), 8 * 60);
});

test("weekly Vasermil 2 task takes the first day with room", () => {
  const busy = new Map([["2026-11-15", [{ start: 7 * 60, end: 15 * 60 }]]]);
  const task = planWeeklyTask("2026-11-15", busy)!;
  assert.equal(task.pitchCode, "vasermil_2");
  assert.equal(task.date, "2026-11-16");
  assert.equal(task.startTime, "08:00");
  assert.equal(task.endTime, "10:00");
  assert.equal(task.showFrom, "2026-11-14");

  const full = new Map(
    ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map((d) => [d, [{ start: 0, end: 24 * 60 }]]),
  );
  assert.equal(planWeeklyTask("2026-11-15", full)!.startTime, null);
});

test("weekly task never lands on a day that already passed", () => {
  assert.equal(planWeeklyTask("2026-11-15", new Map(), "2026-11-18")!.date, "2026-11-18");
  assert.equal(planWeeklyTask("2026-11-15", new Map(), "2026-11-20"), null);
});

test("reconcile: done tasks stay, open tasks without games become obsolete", () => {
  const planned = planGamePrepTasks([game({ date: "2026-11-22", note: "וסרמיל 1" })]);
  const changes = reconcileTasks(
    planned,
    [
      { id: 1, pitchCode: "vasermil_1", kind: "game_prep", periodKey: "2026-11-22", date: "2026-11-22", status: "done" },
      { id: 2, pitchCode: "vasermil_3", kind: "game_prep", periodKey: "2026-11-23", date: "2026-11-23", status: "open" },
      { id: 3, pitchCode: "vasermil_3", kind: "game_prep", periodKey: "2026-11-01", date: "2026-11-01", status: "open" },
    ],
    "2026-11-16",
  );
  assert.deepEqual(changes.upserts, []);
  assert.deepEqual(changes.obsoleteIds, [2]);

  const reopened = reconcileTasks(
    planned,
    [{ id: 1, pitchCode: "vasermil_1", kind: "game_prep", periodKey: "2026-11-22", date: "2026-11-22", status: "obsolete" }],
    "2026-11-16",
  );
  assert.equal(reopened.upserts.length, 1);
});

test("only open tasks from show date through the day are visible", () => {
  const tasks = [
    { id: 1, status: "open", showFrom: "2026-11-14", date: "2026-11-16" },
    { id: 2, status: "open", showFrom: "2026-11-18", date: "2026-11-20" },
    { id: 3, status: "done", showFrom: "2026-11-14", date: "2026-11-16" },
    { id: 4, status: "open", showFrom: "2026-11-10", date: "2026-11-12" },
  ];
  assert.deepEqual(visibleOpenTasks(tasks, "2026-11-16").map((t) => t.id), [4, 1]);
});

test("a task whose day passed stays open, overdue, and is not moved by the plan", () => {
  assert.equal(isOverdue({ status: "open", date: "2026-11-15" }, "2026-11-16"), true);
  assert.equal(isOverdue({ status: "open", date: "2026-11-16" }, "2026-11-16"), false);
  assert.equal(isOverdue({ status: "done", date: "2026-11-15" }, "2026-11-16"), false);

  const replanned = planWeeklyTask("2026-11-15", new Map(), "2026-11-17")!;
  const changes = reconcileTasks(
    [replanned],
    [{ id: 5, pitchCode: "vasermil_2", kind: "weekly", periodKey: "2026-11-15", date: "2026-11-16", status: "open" }],
    "2026-11-17",
  );
  assert.deepEqual(changes.upserts, []);
});

test("today is the Israel date, not the server's UTC date", () => {
  assert.equal(israelToday(new Date("2026-11-16T22:30:00Z")), "2026-11-17");
  assert.equal(israelToday(new Date("2026-07-01T21:30:00Z")), "2026-07-02");
});

test("venue in a scraper note: after the opponent, cup prefix skipped", () => {
  assert.equal(venueFromNote("יריב · באר שבע וסרמיל 1", "יריב"), "באר שבע וסרמיל 1");
  assert.equal(venueFromNote("גביע · יריב · באר שבע טאובל", "יריב"), "באר שבע טאובל");
  assert.equal(venueFromNote("יריב", "יריב"), null);
  assert.equal(venueFromNote("גביע · יריב", "יריב"), null);
  assert.equal(venueFromNote(null, "יריב"), null);
});

const ifa = (overrides: Partial<GameForMaintenance>) =>
  game({ source: "ifa_scraper", opponent: "יריב", note: "יריב", ...overrides });

test("no venue from the association: listed as unknown, a temporary pick makes the task", () => {
  const noVenue = ifa({ slotId: 9, date: "2026-11-22" });
  assert.equal(officialVenueKnown(noVenue), false);
  assert.deepEqual(unknownVenueGames([noVenue]).map((g) => g.slotId), [9]);
  assert.deepEqual(planGamePrepTasks([noVenue]), []);

  const picked = { ...noVenue, overrideCode: "vasermil_3" };
  const [task] = planGamePrepTasks([picked]);
  assert.equal(task.pitchCode, "vasermil_3");
  assert.deepEqual(unknownVenueGames([picked]).map((g) => g.slotId), [9], "stays in the temporary column");
  assert.deepEqual(planGamePrepTasks([{ ...noVenue, overrideCode: "other" }]), [], "'other' makes no task");
});

test("once the association gives a venue, it wins and the temporary pick is cleared", () => {
  const updated = ifa({ slotId: 9, note: "יריב · באר שבע וסרמיל 1", overrideCode: "vasermil_3" });
  assert.equal(planGamePrepTasks([updated])[0].pitchCode, "vasermil_1");
  assert.deepEqual(overridesToClear([updated]), [9]);
  assert.deepEqual(unknownVenueGames([updated]), []);

  const elsewhere = ifa({ slotId: 10, note: "יריב · באר שבע טאובל", overrideCode: "vasermil_3" });
  assert.deepEqual(planGamePrepTasks([elsewhere]), [], "known venue off Vasermil: no task");
  assert.deepEqual(overridesToClear([elsewhere]), [10]);

  const adminPitch = ifa({ slotId: 11, pitchCode: "vasermil_2", overrideCode: "vasermil_3" });
  assert.deepEqual(overridesToClear([adminPitch]), [11], "an admin's pitch on the games screen also clears it");
  assert.deepEqual(overridesToClear([ifa({ slotId: 12, overrideCode: "vasermil_3" })]), []);
});

test("urgent unknown: no pick and the task would already be showing", () => {
  const games = [
    ifa({ slotId: 1, date: "2026-11-18" }),
    ifa({ slotId: 2, date: "2026-11-25" }),
    ifa({ slotId: 3, date: "2026-11-17", overrideCode: "vasermil_1" }),
  ];
  assert.equal(urgentUnknownCount(games, "2026-11-16"), 1);
});
