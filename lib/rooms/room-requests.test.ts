import assert from "node:assert/strict";
import test from "node:test";
import { ROOMS, type ExistingBooking } from "./room-rules";
import { approvalPlan, datesSummary, prepareRoomRequest, recurrenceLabel, requestWhenLabel } from "./room-requests";

const sunday = "2026-11-22";
const nextSunday = "2026-11-29";
const saturday = "2026-11-28";

const taken: ExistingBooking = { id: 7, teamId: 2, teamName: "נערים ב", date: sunday, start: 16 * 60, end: 17 * 60 };

test("a 75-minute request is labeled שעה ורבע and ends at 17:15", () => {
  assert.equal(requestWhenLabel("16:00", 75), "\u206616:00–17:15\u2069 · שעה ורבע");
});

test("5, 10 and 15 minute requests are labeled and approved, including back to back", () => {
  assert.equal(requestWhenLabel("10:00", 5), "\u206610:00–10:05\u2069 · 5 דק׳");
  assert.equal(requestWhenLabel("10:00", 10), "\u206610:00–10:10\u2069 · 10 דק׳");
  assert.equal(requestWhenLabel("10:10", 15), "\u206610:10–10:25\u2069 · 15 דק׳");

  const prepared = prepareRoomRequest(ROOMS.video, {
    teamId: 1,
    startTime: "10:10",
    durationMinutes: 15,
    dates: [sunday],
  });
  assert.equal(prepared.ok, true);

  const odd = prepareRoomRequest(ROOMS.gym, {
    teamId: 1,
    startTime: "10:02",
    durationMinutes: 10,
    dates: [sunday],
  });
  assert.equal(odd.ok, false);

  const held: ExistingBooking = { id: 3, teamId: 2, teamName: "נוער", date: sunday, start: 10 * 60, end: 10 * 60 + 10 };
  const follows = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "10:10", durationMinutes: 15, dates: [sunday] }, [held]);
  assert.equal(follows.ok, true);
  if (follows.ok) assert.deepEqual([follows.bookings[0].start, follows.bookings[0].end], [10 * 60 + 10, 10 * 60 + 25]);

  const crosses = approvalPlan(ROOMS.video, { teamId: 1, startTime: "10:05", durationMinutes: 10, dates: [sunday] }, [held]);
  assert.equal(crosses.ok, false);

  for (const minutes of [5, 10, 15]) {
    const plan = approvalPlan(ROOMS.video, { teamId: 1, startTime: "18:05", durationMinutes: minutes, dates: [sunday] }, []);
    assert.equal(plan.ok, true, String(minutes));
  }
  const seven = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "18:00", durationMinutes: 7, dates: [sunday] }, []);
  assert.equal(seven.ok, false);
});

test("a video series drops Saturday and keeps Sunday", () => {
  const prepared = prepareRoomRequest(ROOMS.video, {
    teamId: 1,
    startTime: "16:00",
    durationMinutes: 75,
    dates: [sunday, saturday],
    recurrence: { weekdays: [0, 6], until: saturday, extraDates: [], intervalDays: 7 },
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(prepared.dates, [sunday]);
  assert.equal(recurrenceLabel(prepared.recurrence), "כל שבוע · יום א, יום ש עד 28.11");
});

test("approval of a free 75-minute gym block returns every date", () => {
  const plan = approvalPlan(
    ROOMS.gym,
    { teamId: 1, startTime: "17:00", durationMinutes: 75, dates: [sunday, nextSunday] },
    [taken],
  );
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(
    plan.bookings.map((booking) => [booking.date, booking.start, booking.end]),
    [
      [sunday, 17 * 60, 18 * 60 + 15],
      [nextSunday, 17 * 60, 18 * 60 + 15],
    ],
  );
});

test("approval fails the whole request when any date now conflicts", () => {
  const plan = approvalPlan(
    ROOMS.gym,
    { teamId: 1, startTime: "16:30", durationMinutes: 75, dates: [sunday, nextSunday] },
    [taken],
  );
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.match(plan.error, /אי אפשר לאשר/);
  assert.match(plan.error, /נערים ב/);
  assert.equal("bookings" in plan, false);
});

test("a 75-minute block that only touches the taken hour is free", () => {
  const plan = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "17:00", durationMinutes: 75, dates: [sunday] }, [taken]);
  assert.equal(plan.ok, true);
});

test("video approval allows a 5-minute block that ends at 23:45 and refuses one that passes it", () => {
  const fits = approvalPlan(ROOMS.video, { teamId: 1, startTime: "23:40", durationMinutes: 5, dates: [sunday] }, []);
  assert.equal(fits.ok, true);
  const late = approvalPlan(ROOMS.video, { teamId: 1, startTime: "23:40", durationMinutes: 10, dates: [sunday] }, []);
  assert.equal(late.ok, false);
  if (!late.ok) assert.match(late.error, /23:45/);
  const midnight = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "23:55", durationMinutes: 5, dates: [sunday] }, []);
  assert.equal(midnight.ok, true);
  const past = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "23:50", durationMinutes: 15, dates: [sunday] }, []);
  assert.equal(past.ok, false);
});

test("video approval refuses a 75-minute block that passes 23:45, gym refuses one past midnight", () => {
  const lateVideo = approvalPlan(ROOMS.video, { teamId: 1, startTime: "23:00", durationMinutes: 75, dates: [sunday] }, []);
  assert.equal(lateVideo.ok, false);
  if (!lateVideo.ok) assert.match(lateVideo.error, /23:45/);

  const fitsVideo = approvalPlan(ROOMS.video, { teamId: 1, startTime: "22:30", durationMinutes: 75, dates: [sunday] }, []);
  assert.equal(fitsVideo.ok, true);

  const lateGym = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "23:00", durationMinutes: 75, dates: [sunday] }, []);
  assert.equal(lateGym.ok, false);
  if (!lateGym.ok) assert.match(lateGym.error, /חצות/);

  const midnight = approvalPlan(ROOMS.gym, { teamId: 1, startTime: "22:45", durationMinutes: 75, dates: [sunday] }, []);
  assert.equal(midnight.ok, true);
});

test("video approval refuses Saturday", () => {
  const plan = approvalPlan(ROOMS.video, { teamId: 1, startTime: "16:00", durationMinutes: 75, dates: [saturday] }, []);
  assert.equal(plan.ok, false);
  if (!plan.ok) assert.match(plan.error, /כיתת וידאו/);
});

test("date lists stay readable", () => {
  assert.equal(datesSummary(["2026-11-22", "2026-11-29"]), "22.11, 29.11");
});
