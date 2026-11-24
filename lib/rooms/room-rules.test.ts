import assert from "node:assert/strict";
import test from "node:test";
import {
  ROOMS,
  ROOM_DURATIONS,
  isOverlapError,
  roomDurationLabel,
  startHours,
  startMinutes,
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

test("validation: team, five-minute steps, allowed day, listed duration, ends by closing time", () => {
  const ok = { teamId: 1, date: sunday, startTime: "16:00", durationMinutes: 60 };
  assert.deepEqual(validateBooking(gym, ok), { booking: { teamId: 1, date: sunday, start: 960, end: 1020 } });
  assert.ok("error" in validateBooking(gym, { ...ok, teamId: 0 }));
  assert.ok("booking" in validateBooking(gym, { ...ok, startTime: "16:10", durationMinutes: 10 }));
  assert.ok("error" in validateBooking(gym, { ...ok, startTime: "16:07" }), "starts stay on a 5-minute grid");
  assert.ok("error" in validateBooking(gym, { ...ok, durationMinutes: 7 }));
  assert.ok("error" in validateBooking(gym, { ...ok, durationMinutes: 185 }));
  assert.ok("booking" in validateBooking(gym, { ...ok, durationMinutes: 5 }));
  assert.ok("booking" in validateBooking(gym, { ...ok, durationMinutes: 50 }));
  assert.ok("booking" in validateBooking(gym, { ...ok, startTime: "23:00" }), "gym is open until midnight");
  assert.ok("booking" in validateBooking(gym, { ...ok, startTime: "00:00" }), "gym is open from midnight");
  assert.ok("error" in validateBooking(gym, { ...ok, startTime: "23:30" }), "no session past midnight");
  assert.ok("error" in validateBooking(video, { ...ok, startTime: "23:00" }), "video room ends by 23:45");
  assert.ok("error" in validateBooking(video, { ...ok, startTime: "05:00" }), "video room opens at 06:00");
  assert.ok("booking" in validateBooking(gym, { ...ok, date: saturday }));
  assert.ok("error" in validateBooking(video, { ...ok, date: saturday }), "video room is open Sunday to Friday");
});

test("5, 10 and 15 minute bookings can sit back to back without a gap", () => {
  const ten = validateBooking(gym, { teamId: 1, date: sunday, startTime: "10:00", durationMinutes: 10 });
  const fifteen = validateBooking(gym, { teamId: 2, date: sunday, startTime: "10:10", durationMinutes: 15 });
  const five = validateBooking(video, { teamId: 3, date: sunday, startTime: "10:25", durationMinutes: 5 });
  assert.ok("booking" in ten && "booking" in fifteen && "booking" in five);
  if (!("booking" in ten) || !("booking" in fifteen) || !("booking" in five)) return;
  assert.deepEqual([ten.booking.start, ten.booking.end], [10 * 60, 10 * 60 + 10]);
  assert.deepEqual([fifteen.booking.start, fifteen.booking.end], [10 * 60 + 10, 10 * 60 + 25]);
  assert.equal(overlaps(ten.booking, fifteen.booking), false);
  assert.equal(overlaps(fifteen.booking, five.booking), false);
  const crossing = validateBooking(gym, { teamId: 4, date: sunday, startTime: "10:05", durationMinutes: 10 });
  assert.ok("booking" in crossing);
  if (!("booking" in crossing)) return;
  assert.equal(overlaps(ten.booking, crossing.booking), true);
  assert.equal(
    findRoomConflict(
      [{ id: 1, teamId: 1, teamName: "נוער", date: sunday, start: ten.booking.start, end: ten.booking.end }],
      crossing.booking,
    )?.id,
    1,
  );
  assert.equal(
    findRoomConflict(
      [{ id: 1, teamId: 1, teamName: "נוער", date: sunday, start: ten.booking.start, end: ten.booking.end }],
      fifteen.booking,
    ),
    null,
  );
});

test("a short session may end exactly at closing, and not a minute later", () => {
  assert.ok("booking" in validateBooking(video, { teamId: 1, date: sunday, startTime: "23:40", durationMinutes: 5 }));
  assert.ok("error" in validateBooking(video, { teamId: 1, date: sunday, startTime: "23:40", durationMinutes: 10 }));
  assert.ok("error" in validateBooking(video, { teamId: 1, date: sunday, startTime: "23:45", durationMinutes: 5 }));
  assert.ok("booking" in validateBooking(video, { teamId: 1, date: sunday, startTime: "06:00", durationMinutes: 5 }));
  assert.ok("booking" in validateBooking(gym, { teamId: 1, date: sunday, startTime: "23:55", durationMinutes: 5 }));
  assert.ok("error" in validateBooking(gym, { teamId: 1, date: sunday, startTime: "23:55", durationMinutes: 10 }));
});

test("durations are every 5 minutes from 5 through 180, with the existing Hebrew labels", () => {
  assert.equal(ROOM_DURATIONS[0], 5);
  assert.equal(ROOM_DURATIONS.at(-1), 180);
  assert.equal(ROOM_DURATIONS.length, 36);
  for (let index = 1; index < ROOM_DURATIONS.length; index += 1) {
    assert.equal(ROOM_DURATIONS[index] - ROOM_DURATIONS[index - 1], 5);
  }
  for (const minutes of [30, 45, 60, 75, 90, 105, 120, 150, 180]) {
    assert.equal(ROOM_DURATIONS.includes(minutes), true);
  }
  assert.equal(roomDurationLabel(5), "5 דק׳");
  assert.equal(roomDurationLabel(10), "10 דק׳");
  assert.equal(roomDurationLabel(15), "15 דק׳");
  assert.equal(roomDurationLabel(30), "30 דק׳");
  assert.equal(roomDurationLabel(45), "45 דק׳");
  assert.equal(roomDurationLabel(60), "שעה");
  assert.equal(roomDurationLabel(75), "שעה ורבע");
  assert.equal(roomDurationLabel(90), "שעה וחצי");
  assert.equal(roomDurationLabel(105), "שעה ו־45 דק׳");
  assert.equal(roomDurationLabel(120), "שעתיים");
  assert.equal(roomDurationLabel(135), "שעתיים ורבע");
  assert.equal(roomDurationLabel(150), "שעתיים וחצי");
  assert.equal(roomDurationLabel(180), "3 שעות");
  assert.equal(roomDurationLabel(65), "שעה ו־5 דק׳");
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

test("the form never offers a start time that cannot fit the shortest session", () => {
  const everyFive = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  assert.deepEqual(startMinutes(video, 23), [0, 5, 10, 15, 20, 25, 30, 35, 40]);
  assert.deepEqual(startMinutes(video, 6), everyFive);
  assert.deepEqual(startMinutes(video, 22), everyFive);
  assert.deepEqual(startMinutes(video, 5), []);
  assert.equal(startHours(video)[0], 6);
  assert.equal(startHours(video).at(-1), 23);
  assert.deepEqual(startMinutes(gym, 23), everyFive);
  assert.deepEqual(startMinutes(gym, 0), everyFive);
  assert.deepEqual([startHours(gym)[0], startHours(gym).at(-1)], [0, 23]);
});

test("overlap errors are recognised however the driver wraps them", () => {
  assert.equal(isOverlapError({ code: "23P01" }), true);
  assert.equal(isOverlapError({ message: "Failed query", cause: { code: "23P01" } }), true);
  assert.equal(isOverlapError(new Error("x", { cause: new Error("x", { cause: { code: "23P01" } }) })), true);
  assert.equal(isOverlapError({ message: 'violates exclusion constraint "gym_bookings_no_overlap"' }), true);
  assert.equal(isOverlapError({ code: "23505" }), false);
  assert.equal(isOverlapError(null), false);
});
