import assert from "node:assert/strict";
import test from "node:test";
import {
  ROOMS,
  datesToSave,
  findRoomConflict,
  needsConfirmation,
  overlaps,
  reviewOccurrences,
  teamClashWarnings,
  validateBooking,
  type ExistingBooking,
} from "./room-rules";

const gym = ROOMS.gym;
const video = ROOMS.video;
const sunday = "2026-11-22";
const saturday = "2026-11-28";

const taken: ExistingBooking = { id: 7, teamId: 2, teamName: "נערים ב", date: sunday, start: 16 * 60, end: 17 * 60 };

test("sessions that touch end to end do not overlap", () => {
  assert.equal(overlaps({ start: 960, end: 1020 }, { start: 1020, end: 1080 }), false);
  assert.equal(overlaps({ start: 960, end: 1020 }, { start: 1005, end: 1080 }), true);
});

test("validation: team, quarter hours, allowed day, listed duration, ends by 23:45", () => {
  const ok = { teamId: 1, date: sunday, startTime: "16:00", durationMinutes: 60 };
  assert.deepEqual(validateBooking(gym, ok), { booking: { teamId: 1, date: sunday, start: 960, end: 1020 } });
  assert.ok("error" in validateBooking(gym, { ...ok, teamId: 0 }));
  assert.ok("error" in validateBooking(gym, { ...ok, startTime: "16:10" }));
  assert.ok("error" in validateBooking(gym, { ...ok, durationMinutes: 50 }));
  assert.ok("booking" in validateBooking(gym, { ...ok, startTime: "23:00" }), "gym is open until midnight");
  assert.ok("booking" in validateBooking(gym, { ...ok, startTime: "00:00" }), "gym is open from midnight");
  assert.ok("error" in validateBooking(gym, { ...ok, startTime: "23:30" }), "no session past midnight");
  assert.ok("error" in validateBooking(video, { ...ok, startTime: "23:00" }), "video room ends by 23:45");
  assert.ok("error" in validateBooking(video, { ...ok, startTime: "05:00" }), "video room opens at 06:00");
  assert.ok("booking" in validateBooking(gym, { ...ok, date: saturday }));
  assert.ok("error" in validateBooking(video, { ...ok, date: saturday }), "video room is open Sunday to Friday");
});

test("one team at a time: the second team is told who holds the room", () => {
  const conflict = findRoomConflict([taken], { date: sunday, start: 16 * 60 + 30, end: 17 * 60 + 30 });
  assert.equal(conflict?.id, 7);
  assert.equal(findRoomConflict([taken], { date: sunday, start: 17 * 60, end: 18 * 60 }), null);
  assert.equal(findRoomConflict([taken], { date: sunday, start: 16 * 60, end: 17 * 60 }, 7), null, "editing itself");
});

test("same-team training or game at that time is a warning, not a block", () => {
  const warnings = teamClashWarnings(
    [
      { teamId: 1, date: sunday, start: 17 * 60, end: 18 * 60 + 30, label: "אימון בוסרמיל 1" },
      { teamId: 2, date: sunday, start: 16 * 60, end: 18 * 60, label: "אימון" },
    ],
    { teamId: 1, date: sunday, start: 16 * 60 + 30, end: 17 * 60 + 30 },
  );
  assert.deepEqual(warnings, ["באותה שעה לקבוצה יש אימון בוסרמיל 1 (\u206617:00–18:30\u2069)"]);
});

test("a recurring booking skips taken dates and closed days, keeps the rest", () => {
  const review = reviewOccurrences(
    video,
    [sunday, "2026-11-29", saturday],
    { teamId: 1, startTime: "16:00", durationMinutes: 60 },
    [taken],
    [{ teamId: 1, date: "2026-11-29", start: 15 * 60, end: 16 * 60 + 30, label: "אימון" }],
  );
  assert.equal(review.error, undefined);
  assert.deepEqual(
    review.items.map((item) => [item.date, Boolean(item.blockedBy), item.warnings.length]),
    [
      [sunday, true, 0],
      [saturday, true, 0],
      ["2026-11-29", false, 1],
    ],
  );
  assert.equal(needsConfirmation(review.items), true);
  assert.deepEqual(datesToSave(review.items), ["2026-11-29"]);
});

test("a single booking on a closed day is an error, not a skipped date", () => {
  const review = reviewOccurrences(video, [saturday], { teamId: 1, startTime: "16:00", durationMinutes: 60 }, [], []);
  assert.ok(review.error);
});
