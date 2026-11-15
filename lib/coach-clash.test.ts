import assert from "node:assert/strict";
import test from "node:test";
import type { CoachInfo } from "./coaches";
import { classifyBooking, coachClashes, type BoardBooking, type PitchDay } from "./pitch-rules";

function coach(id: number, name: string, teamIds: number[], assistantTeamIds: number[] = []): CoachInfo {
  return { id, name, phone: null, email: null, roleLabel: null, receivesAllUpdates: false, teamIds, assistantTeamIds, workDays: [], absences: [] };
}

function training(slotId: number, teamId: number, teamName: string, start: number, end: number, extra: Partial<BoardBooking> = {}): BoardBooking {
  return {
    slotId, kind: "training", teamId, teamName, pitchId: 2, subdivisionCode: "whole", start, end,
    durationMinutes: end - start, rotationTemplateId: null, note: null, opponent: null,
    status: "active", statusNote: null, substituteStaffId: null, seriesId: null, ...extra,
  };
}

// Team 1 and team 2 share coach שחר (id 10). Team 3 has its own coach.
function day(bookings: BoardBooking[], games: PitchDay["games"] = []): PitchDay {
  return {
    date: "2026-11-16",
    pitches: [
      { id: 1, code: "vasermil_1", nameHe: "וסרמיל 1", colorKey: "green", surfaceType: "synthetic", isReservedLock: false, allowsHomeGames: true },
      { id: 2, code: "vasermil_2", nameHe: "וסרמיל 2", colorKey: "orange", surfaceType: "natural", isReservedLock: false, allowsHomeGames: false },
    ],
    subdivisions: [{ code: "whole", labelHe: "מגרש שלם" }],
    durations: [],
    rotations: [],
    teams: [1, 2, 3, 4].map((id) => ({ id, name: `קבוצה ${id}`, ageBandCode: null, allowedSubdivisions: ["whole"] })),
    footballSchoolRules: [],
    bookings,
    coaches: [coach(10, "שחר", [1, 2]), coach(20, "רמי", [3]), coach(30, "מחליף", []), coach(40, "דני", [3, 4], [4])],
    games,
  };
}

const at17 = { teamId: 1, substituteStaffId: null, start: 17 * 60, end: 18 * 60 + 30 };

test("a coach of two teams cannot train both at overlapping times", () => {
  const clashes = coachClashes(day([training(5, 2, "קבוצה 2", 18 * 60, 19 * 60 + 30)]), at17);
  assert.equal(clashes.length, 1);
  assert.match(clashes[0], /שחר הוא גם מאמן בקבוצה 2/);
});

test("head coach of one team and assistant of another: both count", () => {
  const clashes = coachClashes(day([training(5, 4, "קבוצה 4", 17 * 60 + 30, 19 * 60)]), { ...at17, teamId: 3 });
  assert.equal(clashes.length, 1);
  assert.match(clashes[0], /דני הוא גם עוזר מאמן בקבוצה 4/);
});

test("back-to-back trainings of the same coach are fine", () => {
  assert.deepEqual(coachClashes(day([training(5, 2, "קבוצה 2", 18 * 60 + 30, 20 * 60)]), at17), []);
});

test("a team with a different coach does not block", () => {
  assert.deepEqual(coachClashes(day([training(5, 3, "קבוצה 3", 17 * 60, 18 * 60)]), at17), []);
});

test("a cancelled training or a substitute on the other team frees the coach", () => {
  assert.deepEqual(coachClashes(day([training(5, 2, "קבוצה 2", 17 * 60, 18 * 60, { status: "cancelled" })]), at17), []);
  assert.deepEqual(coachClashes(day([training(5, 2, "קבוצה 2", 17 * 60, 18 * 60, { substituteStaffId: 30 })]), at17), []);
});

test("a substitute on the new training frees the team's own coach", () => {
  assert.deepEqual(coachClashes(day([training(5, 2, "קבוצה 2", 17 * 60, 18 * 60)]), { ...at17, substituteStaffId: 30 }), []);
});

test("an away game of the coach's other team blocks from departure time", () => {
  const games = [{ slotId: 9, teamId: 2, teamName: "קבוצה 2", away: true, start: 16 * 60, end: 20 * 60 }];
  const clashes = coachClashes(day([], games), at17);
  assert.equal(clashes.length, 1);
  assert.match(clashes[0], /משחק חוץ/);
});

test("editing a training does not clash with itself", () => {
  assert.deepEqual(coachClashes(day([training(5, 1, "קבוצה 1", 17 * 60, 18 * 60)]), { ...at17, slotId: 5 }), []);
});

test("the pitch board treats a coach clash as a rule that cannot be overridden", () => {
  const result = classifyBooking(day([training(5, 2, "קבוצה 2", 17 * 60, 18 * 60)]), {
    teamId: 1, pitchId: 1, subdivisionCode: "whole", start: 17 * 60, durationMinutes: 90,
  });
  assert.equal(result.hard.length, 1);
  assert.match(result.hard[0], /שחר/);
});
