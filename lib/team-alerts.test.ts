import assert from "node:assert/strict";
import test from "node:test";
import {
  alertingTeamIds,
  isTeamAlertOn,
  parseStoredTeamAlerts,
  serializeTeamAlerts,
  withBell,
  withNewlySelectedTeam,
} from "./team-alerts";

test("a newly selected team defaults to the bell on", () => {
  assert.equal(isTeamAlertOn({}, 4, true), true);
  assert.equal(isTeamAlertOn(withNewlySelectedTeam({}, 4), 4, true), true);
  assert.equal(isTeamAlertOn(withNewlySelectedTeam({ 4: false }, 4), 4, true), true);
  assert.deepEqual(alertingTeamIds([4, 9], {}), [4, 9]);
});

test("an explicit off is remembered, and a team that is not selected is not alerting", () => {
  const stored = serializeTeamAlerts(withBell({ 3: true }, 7, false));
  const prefs = parseStoredTeamAlerts(stored);
  assert.equal(isTeamAlertOn(prefs, 7, true), false);
  assert.equal(isTeamAlertOn(prefs, 3, true), true);
  assert.equal(isTeamAlertOn(prefs, 8, true), true);
  assert.equal(isTeamAlertOn(prefs, 7, false), false);
  assert.equal(isTeamAlertOn({ 7: true }, 7, false), false);
  assert.deepEqual(alertingTeamIds([3, 7, 8], prefs), [3, 8]);
});

test("broken alert storage is ignored", () => {
  assert.deepEqual(parseStoredTeamAlerts(null), {});
  assert.deepEqual(parseStoredTeamAlerts("not-json"), {});
  assert.deepEqual(parseStoredTeamAlerts(JSON.stringify({ "0": true, "-2": false, x: true, "5": "yes" })), {});
});
