import assert from "node:assert/strict";
import test from "node:test";
import { dayElementId, todayJump } from "./mobile-day-nav";

test("today on the loaded week is selected in place", () => {
  // Sunday 22 Nov 2026 through Saturday 28 Nov. Friday the 27th is in that week.
  const jump = todayJump("2026-11-22", "2026-11-27");
  assert.deepEqual(jump, { kind: "select", day: "2026-11-27" });
  assert.equal(dayElementId("2026-11-27"), "day-2026-11-27");
});

test("today from another week opens the current week and selects today", () => {
  const fromNext = todayJump("2026-11-29", "2026-11-27");
  assert.deepEqual(fromNext, {
    kind: "navigate",
    day: "2026-11-27",
    week: "2026-11-22",
    href: "/?week=2026-11-22&day=2026-11-27",
  });

  const fromPrevious = todayJump("2026-11-15", "2026-11-22");
  assert.deepEqual(fromPrevious, {
    kind: "navigate",
    day: "2026-11-22",
    week: "2026-11-22",
    href: "/?week=2026-11-22&day=2026-11-22",
  });
});
