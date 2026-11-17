import assert from "node:assert/strict";
import test from "node:test";
import {
  canMoveInjury,
  daysOut,
  defaultCoachForTeam,
  isISODate,
  isReturnOverdue,
  nextStatuses,
  physioClash,
  sessionStartTimes,
  sortInjuries,
  toCoachView,
  todayInIsrael,
  toMinutes,
  validateSession,
  type SessionSlot,
} from "./injuries";
import { canEditInjuries, canSeeInjuryDetails, homePathForRole, isManager, normalizeRole } from "./roles";

test("an injury moves forward freely, and back only on a setback", () => {
  assert.equal(canMoveInjury("injured", "treatment"), true);
  assert.equal(canMoveInjury("injured", "fit"), true, "a light knock can close at once");
  assert.equal(canMoveInjury("gradual_return", "treatment"), true, "setback");
  assert.equal(canMoveInjury("treatment", "injured"), false);
  assert.equal(canMoveInjury("gradual_return", "injured"), false);
  assert.equal(canMoveInjury("fit", "treatment"), false, "a closed injury stays closed");
  assert.equal(canMoveInjury("treatment", "treatment"), false);
  assert.deepEqual(nextStatuses("treatment"), ["gradual_return", "fit"]);
  assert.deepEqual(nextStatuses("gradual_return"), ["treatment", "fit"]);
  assert.deepEqual(nextStatuses("fit"), []);
});

test("days out count to today while open, and to the closing day once fit", () => {
  assert.equal(daysOut({ injuredAt: "2026-11-01", closedAt: null }, "2026-11-17"), 16);
  assert.equal(daysOut({ injuredAt: "2026-11-01", closedAt: "2026-11-05T10:00:00.000Z" }, "2026-11-17"), 4);
  assert.equal(daysOut({ injuredAt: "2026-11-17", closedAt: null }, "2026-11-17"), 0);
});

test("overdue only when the expected return passed and the player is not fit", () => {
  assert.equal(isReturnOverdue({ status: "treatment", expectedReturn: "2026-11-10" }, "2026-11-17"), true);
  assert.equal(isReturnOverdue({ status: "treatment", expectedReturn: "2026-11-17" }, "2026-11-17"), false);
  assert.equal(isReturnOverdue({ status: "fit", expectedReturn: "2026-11-10" }, "2026-11-17"), false);
  assert.equal(isReturnOverdue({ status: "injured", expectedReturn: null }, "2026-11-17"), false);
});

test("the list shows overdue first, then the nearest return, then no date, closed last", () => {
  const row = (playerName: string, status: "injured" | "fit", expectedReturn: string | null) => ({
    playerName,
    status,
    expectedReturn,
    injuredAt: "2026-11-01",
  });
  const sorted = sortInjuries(
    [row("no date", "injured", null), row("closed", "fit", null), row("later", "injured", "2026-12-01"), row("soon", "injured", "2026-11-20"), row("late", "injured", "2026-11-10")],
    "2026-11-17",
  );
  assert.deepEqual(sorted.map((r) => r.playerName), ["late", "soon", "later", "no date", "closed"]);
});

test("a coach's view carries no body part or notes", () => {
  const view = toCoachView({
    id: 1,
    playerName: "דני",
    teamName: "נערים א",
    status: "treatment",
    expectedReturn: "2026-12-01",
    bodyPart: "ברך",
    note: "סודי",
  });
  assert.deepEqual(Object.keys(view).sort(), ["expectedReturn", "id", "playerName", "status", "teamName"]);
});

test("dates and times are validated", () => {
  assert.equal(isISODate("2026-11-17"), true);
  assert.equal(isISODate("2026-02-30"), false);
  assert.equal(isISODate("17/11/2026"), false);
  assert.equal(toMinutes("17:30"), 1050);
  assert.equal(toMinutes("24:00"), null);
  assert.equal(toMinutes("7:30"), null);
  assert.equal(validateSession({ date: "2026-11-18", startTime: "16:00", durationMinutes: 30 }), null);
  assert.match(validateSession({ date: "", startTime: "16:00", durationMinutes: 30 }) ?? "", /תאריך/);
  assert.match(validateSession({ date: "2026-11-18", startTime: "21:45", durationMinutes: 30 }) ?? "", /22:00/);
  assert.match(validateSession({ date: "2026-11-18", startTime: "16:00", durationMinutes: 25 }) ?? "", /משך/);
  const times = sessionStartTimes();
  assert.equal(times[0], "07:00");
  assert.equal(times.at(-1), "21:30");
});

test("a physio cannot have two treatments at overlapping times", () => {
  const existing: SessionSlot[] = [
    { id: 1, physioUserId: 5, date: "2026-11-18", startTime: "16:00", durationMinutes: 30, status: "scheduled" },
    { id: 2, physioUserId: 5, date: "2026-11-18", startTime: "17:00", durationMinutes: 30, status: "cancelled" },
    { id: 3, physioUserId: 6, date: "2026-11-18", startTime: "18:00", durationMinutes: 45, status: "scheduled" },
  ];
  const at = (startTime: string, durationMinutes = 30, physioUserId = 5): SessionSlot => ({
    physioUserId,
    date: "2026-11-18",
    startTime,
    durationMinutes,
    status: "scheduled",
  });
  assert.equal(physioClash(existing, at("16:15"))?.id, 1);
  assert.equal(physioClash(existing, at("15:45"))?.id, 1, "ends inside the other one");
  assert.equal(physioClash(existing, at("16:30")), null, "back to back is fine");
  assert.equal(physioClash(existing, at("15:30")), null);
  assert.equal(physioClash(existing, at("17:00")), null, "a cancelled treatment frees the time");
  assert.equal(physioClash(existing, at("18:00", 30, 5)), null, "another physio's treatment");
  assert.equal(physioClash(existing, { ...at("16:00"), date: "2026-11-19" }), null, "another day");
});

test("a player's default coach is the team's head coach", () => {
  const links = [
    { id: 1, teamId: 1, staffId: 20, isPrimary: false },
    { id: 2, teamId: 1, staffId: 10, isPrimary: true },
    { id: 3, teamId: 2, staffId: null, isPrimary: true },
    { id: 4, teamId: 3, staffId: 30, isPrimary: false },
  ];
  assert.equal(defaultCoachForTeam(links, 1), 10);
  assert.equal(defaultCoachForTeam(links, 2), null, "a coach not in the staff list");
  assert.equal(defaultCoachForTeam(links, 3), 30, "only an assistant");
  assert.equal(defaultCoachForTeam(links, 9), null);
});

test("roles: managers keep everything, physio and coach get their own screens", () => {
  assert.equal(normalizeRole("owner"), "owner");
  assert.equal(normalizeRole("coach"), "coach");
  assert.equal(normalizeRole("something"), "admin", "old rows behave as before");
  assert.equal(isManager("physio"), false);
  assert.equal(isManager("coach"), false);
  assert.equal(canSeeInjuryDetails("physio"), true);
  assert.equal(canSeeInjuryDetails("coach"), false);
  assert.equal(canEditInjuries("coach"), false);
  assert.equal(homePathForRole("admin"), "/admin");
  assert.equal(homePathForRole("physio"), "/admin/physio");
  assert.equal(homePathForRole("coach"), "/admin/injuries");
});

test("today is taken in Israel time", () => {
  // 23:30 UTC on Nov 17 is already Nov 18 in Israel (UTC+2).
  assert.equal(todayInIsrael(new Date("2026-11-17T23:30:00Z")), "2026-11-18");
  assert.equal(todayInIsrael(new Date("2026-11-17T10:00:00Z")), "2026-11-17");
});
