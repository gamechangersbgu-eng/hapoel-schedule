import assert from "node:assert/strict";
import test from "node:test";
import { israeliIdChecksumOk, nationalIdError, normalizeNationalId } from "./national-id";
import {
  applyCoachLabels,
  biweeklyRepeatAllowed,
  coachFullNameByTeam,
  coachLabeledAgeGroup,
  isFootballSchoolTeam,
  teamDisplayName,
} from "./team-labels";
import { MANAGEMENT_ROLES, recipientsForTeams, type UpdateRecipient } from "./update-recipients";

test("ילדים א through טרום ג are labeled by the coach's given name", () => {
  assert.equal(teamDisplayName("ילדים ב", "נועם כהן"), "ילדים ב נועם");
  assert.equal(teamDisplayName("ילדים ב לבן", "חגי"), "ילדים ב חגי");
  assert.equal(teamDisplayName("ילדים ב ל", "חגי לוי"), "ילדים ב חגי");
  assert.equal(teamDisplayName("טרום ג אדום", "עבדאללה"), "טרום ג עבדאללה");
  assert.equal(teamDisplayName("ילדים א שחר", null), "ילדים א שחר");
  assert.equal(teamDisplayName("נוער", "דני כהן"), "נוער");
  assert.equal(teamDisplayName("נערים א", "דני"), "נערים א");
  assert.equal(teamDisplayName("ילדות א", "מיכל"), "ילדות א");
  assert.equal(teamDisplayName("בית ספר לכדורגל", "רן"), "בית ספר לכדורגל");
  assert.equal(coachLabeledAgeGroup("ילדות א"), null);
  assert.equal(coachLabeledAgeGroup("ילדים א"), "ילדים א");
});

test("biweekly repeat is only for בית הספר לכדורגל, by age band or stored name", () => {
  assert.equal(isFootballSchoolTeam({ ageBandCode: "football_school", name: "בית ספר לכדורגל" }), true);
  assert.equal(isFootballSchoolTeam({ name: "בית ספר" }), true);
  assert.equal(isFootballSchoolTeam({ name: "בית הספר לכדורגל" }), true);
  assert.equal(isFootballSchoolTeam({ name: "בית ספר לכדורגל", ageBandCode: null }), true);
  assert.equal(isFootballSchoolTeam({ ageBandCode: "football_school", name: "ילדים א שחר" }), true);
  assert.equal(isFootballSchoolTeam({ name: "נוער", ageBandCode: "noar_through_yeladim_b" }), false);
  assert.equal(isFootballSchoolTeam({ name: "ילדים ב נועם", ageBandCode: "noar_through_yeladim_b" }), false);
  assert.equal(isFootballSchoolTeam({ name: "ילדות א" }), false);
  assert.equal(isFootballSchoolTeam(null), false);

  assert.equal(biweeklyRepeatAllowed([{ ageBandCode: "football_school", name: "בית ספר לכדורגל" }]), true);
  assert.equal(
    biweeklyRepeatAllowed([
      { name: "בית ספר לכדורגל" },
      { name: "בית ספר" },
    ]),
    true,
  );
  assert.equal(
    biweeklyRepeatAllowed([
      { ageBandCode: "football_school", name: "בית ספר לכדורגל" },
      { name: "נוער" },
    ]),
    false,
  );
  assert.equal(biweeklyRepeatAllowed([]), false);
  assert.equal(biweeklyRepeatAllowed([null]), false);
  assert.equal(biweeklyRepeatAllowed([{ name: "  " }]), false);
});

test("the primary coach with the lowest id supplies the label, and the team id stays", () => {
  const links = [
    { teamId: 7, staffId: 3, coachName: "חגי", isPrimary: true },
    { teamId: 7, staffId: 2, coachName: "נועם", isPrimary: true },
    { teamId: 8, staffId: 4, coachName: "ישן", isPrimary: false },
  ];
  const names = coachFullNameByTeam(links, [
    { id: 2, name: "נועם כהן" },
    { id: 3, name: "חגי לוי" },
    { id: 4, name: "רן" },
  ]);
  const labeled = applyCoachLabels(
    [
      { id: 7, name: "ילדים ב ל" },
      { id: 8, name: "נוער" },
    ],
    names,
  );
  assert.equal(labeled[0].id, 7);
  assert.equal(labeled[0].name, "ילדים ב נועם");
  assert.equal(labeled[1].id, 8);
  assert.equal(labeled[1].name, "נוער");
});

test("management receives every team; a coach only receives their teams", () => {
  const people: UpdateRecipient[] = [
    {
      id: 1,
      name: "נועם",
      phone: "050-1",
      email: null,
      roleLabel: "מאמן",
      teamIds: [7],
      receivesAllUpdates: false,
    },
    {
      id: 2,
      name: "חגי",
      phone: "050-2",
      email: null,
      roleLabel: "מאמן",
      teamIds: [8],
      receivesAllUpdates: false,
    },
    {
      id: 3,
      name: "דנה",
      phone: null,
      email: "dana@example.com",
      roleLabel: "מנהל מקצועי",
      teamIds: [],
      receivesAllUpdates: true,
    },
  ];
  const forTeam7 = recipientsForTeams(people, [7]).map((person) => person.id);
  assert.deepEqual(forTeam7, [1, 3]);
  const everyone = recipientsForTeams(people, [7, 8]).map((person) => person.id);
  assert.deepEqual(everyone, [1, 2, 3]);
  assert.equal(MANAGEMENT_ROLES.length, 4);
});

test("Israeli ID keeps leading zeros and checks the control digit", () => {
  assert.equal(normalizeNationalId("123456782"), "123456782");
  assert.equal(normalizeNationalId("012345678"), "012345678");
  assert.equal(normalizeNationalId("12345678"), null);
  assert.equal(israeliIdChecksumOk("123456782"), true);
  assert.equal(israeliIdChecksumOk("000000018"), true);
  assert.equal(nationalIdError("123456780"), "תעודת הזהות לא עברה בדיקת ספרת ביקורת");
  assert.equal(nationalIdError("12345678"), "תעודת זהות חייבת להיות 9 ספרות (אפשר אפסים מובילים)");
  assert.equal(nationalIdError("123456782"), null);
});
