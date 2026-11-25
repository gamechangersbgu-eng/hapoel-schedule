import assert from "node:assert/strict";
import test from "node:test";
import { USER_ROLES, canScheduleTrainings } from "./roles";
import { defaultSlotType, isTrainingScheduleType, slotTypesForScheduler } from "./slot-types";

test("only the owner role can schedule trainings", () => {
  for (const role of USER_ROLES) {
    assert.equal(canScheduleTrainings(role), role === "owner", role);
  }
});

test("pitch sessions, off-site sessions and camps are trainings; games and a day off are not", () => {
  for (const type of ["vasermil_1", "vasermil_2", "vasermil_3", "vasermil_4", "other", "camp"]) {
    assert.equal(isTrainingScheduleType(type), true, type);
  }
  for (const type of ["home_game", "away_game", "practice_game", "off"]) {
    assert.equal(isTrainingScheduleType(type), false, type);
  }
  assert.equal(isTrainingScheduleType("other", { commentsRow: true }), false);
  assert.equal(isTrainingScheduleType("vasermil_1", { commentsRow: true }), false);
});

test("a manager who cannot schedule trainings is not offered those types", () => {
  const ids = slotTypesForScheduler(false, false).map((item) => item.id);
  assert.deepEqual(ids, ["home_game", "away_game", "practice_game", "off"]);
  assert.ok(slotTypesForScheduler(false, true).some((item) => item.id === "other"));
  assert.ok(slotTypesForScheduler(true, false).some((item) => item.id === "vasermil_1"));
  assert.equal(defaultSlotType(true, false), "vasermil_1");
  assert.equal(defaultSlotType(false, false), "off");
  assert.equal(defaultSlotType(false, true), "other");
  assert.equal(defaultSlotType(false, false, "home_game"), "home_game");
});
