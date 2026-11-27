import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTIFY_TEAM_LABEL,
  shouldNotifyTeams,
  showTrainingNotifyToggle,
  teamNotificationRequested,
} from "./training-notify";

test("the team notification is off unless the owner explicitly asks", () => {
  assert.equal(NOTIFY_TEAM_LABEL, "שלח התראה לקבוצה");
  for (const value of [undefined, null, "", "0", "off", "false", false, 0, "yes"]) {
    assert.equal(teamNotificationRequested(value), false, String(value));
  }
  for (const value of ["1", "on", "true", true]) {
    assert.equal(teamNotificationRequested(value), true, String(value));
  }
});

test("training changes notify only when requested; games still notify every time", () => {
  assert.equal(shouldNotifyTeams({ training: true, requested: false }), false);
  assert.equal(shouldNotifyTeams({ training: true, requested: true }), true);
  assert.equal(shouldNotifyTeams({ training: false, requested: false }), true);
  assert.equal(shouldNotifyTeams({ training: false, requested: true }), true);
});

test("the opt-in is offered for an owner training, including a training listed beside a game", () => {
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: false, slotType: "vasermil_1" }),
    true,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: false, slotType: "camp" }),
    true,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: false, slotType: "other" }),
    true,
  );
  assert.equal(
    showTrainingNotifyToggle({
      canScheduleTrainings: true,
      commentsRow: false,
      slotType: "home_game",
      listedTypes: ["vasermil_2"],
    }),
    true,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: false, slotType: "home_game" }),
    false,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: false, slotType: "practice_game" }),
    false,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: false, slotType: "off" }),
    false,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: false, commentsRow: false, slotType: "vasermil_1" }),
    false,
  );
  assert.equal(
    showTrainingNotifyToggle({ canScheduleTrainings: true, commentsRow: true, slotType: "other" }),
    false,
  );
});
