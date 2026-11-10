import assert from "node:assert/strict";
import test from "node:test";
import { matchCityInName } from "./opponent-city-match";
import { isQuarterHour, roundToQuarterHour } from "./pitch-rules";
import { buildOccurrenceDates, occurrenceDecision, parseSeriesChoices } from "./recurrence";

const cities = [
  { id: 1, name: "תל אביב" },
  { id: 2, name: "באר שבע" },
  { id: 3, name: "ירושלים" },
  { id: 4, name: "חיפה" },
  { id: 5, name: "אשדוד" },
];

test("quarter hours round to 00, 15, 30 or 45", () => {
  assert.equal(roundToQuarterHour("19:07"), "19:00");
  assert.equal(roundToQuarterHour("19:08"), "19:15");
  assert.equal(roundToQuarterHour("19:40"), "19:45");
  assert.equal(roundToQuarterHour("23:53"), "23:45");
  assert.equal(roundToQuarterHour(""), "");
  assert.equal(isQuarterHour("16:30"), true);
  assert.equal(isQuarterHour("16:10"), false);
});

test("weekly dates include the anchor, chosen weekdays and extra days", () => {
  const built = buildOccurrenceDates({
    anchor: "2026-11-10",
    weekdays: [2],
    until: "2026-11-24",
    extraDates: ["2026-12-01"],
  });
  assert.deepEqual(built.dates, ["2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01"]);
  assert.equal(built.truncated, false);
});

test("choices ignore anything that is not override or skip", () => {
  assert.deepEqual(parseSeriesChoices('{"2026-11-10":"override","2026-11-17":"nope","bad":"skip"}'), {
    "2026-11-10": "override",
  });
});

test("a home-game overlap cannot be overridden", () => {
  assert.equal(
    occurrenceDecision({
      date: "2026-11-10",
      hard: [],
      conflicts: [{ slotId: 1, summary: "משחק", overridable: false }],
    }),
    "skip-hard",
  );
  assert.equal(
    occurrenceDecision({
      date: "2026-11-10",
      hard: [],
      conflicts: [{ slotId: 2, summary: "אימון", overridable: true }],
    }),
    "choose",
  );
});

test("the longest city name inside the opponent wins", () => {
  assert.equal(matchCityInName('מכבי ס.נ כלנוע באר שבע', cities)?.name, "באר שבע");
  assert.equal(matchCityInName('בית"ר ירושלים', cities)?.name, "ירושלים");
  assert.equal(matchCityInName("הפועל תל אביב", cities)?.name, "תל אביב");
  assert.equal(matchCityInName("מ.ס. אשדוד", cities)?.name, "אשדוד");
  assert.equal(matchCityInName("מ.כ. גבעתיים", cities), null);
  assert.equal(matchCityInName("בית״ר ירושלים", cities)?.name, "ירושלים");
});
