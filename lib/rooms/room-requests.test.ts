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
