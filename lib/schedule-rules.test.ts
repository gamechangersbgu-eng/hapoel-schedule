import assert from "node:assert/strict";
import test from "node:test";
import { TRAINING_DURATION_MINUTES } from "../shared/practice";
import { matchCityInName } from "./opponent-city-match";
import {
  DURATION_PRESETS,
  ROTATION_PRESETS,
  clocksAfterDurationChange,
  clocksAfterEndChange,
  clocksAfterStartChange,
  durationAllowedForSave,
  isOfficialDuration,
  isQuarterHour,
  roundToQuarterHour,
} from "./pitch-rules";
import { buildOccurrenceDates, occurrenceDecision, parseSeriesChoices } from "./recurrence";

const cities = [
  { id: 1, name: "תל אביב" },
  { id: 2, name: "באר שבע" },
  { id: 3, name: "ירושלים" },
  { id: 4, name: "חיפה" },
  { id: 5, name: "אשדוד" },
];

test("training length is only the official options", () => {
  assert.deepEqual(
    DURATION_PRESETS.map((item) => item.minutes),
    [60, 90, 105, 120],
  );
  assert.deepEqual(
    [...TRAINING_DURATION_MINUTES],
    DURATION_PRESETS.map((item) => item.minutes),
  );
  assert.equal(DURATION_PRESETS.find((item) => item.minutes === 90)?.labelHe, "שעה וחצי");
  assert.equal(DURATION_PRESETS.find((item) => item.minutes === 105)?.labelHe, "שעה ו־45 דקות");
  assert.equal(isOfficialDuration(60), true);
  assert.equal(isOfficialDuration(90), true);
  assert.equal(isOfficialDuration(105), true);
  assert.equal(isOfficialDuration(120), true);
  for (const minutes of [30, 45, 75, 135, 150, 165, 180]) {
    assert.equal(isOfficialDuration(minutes), false);
    assert.equal(durationAllowedForSave(minutes, null), false);
  }
  assert.equal(durationAllowedForSave(75, 75), true);
  assert.equal(durationAllowedForSave(90, null), true);
  assert.equal(durationAllowedForSave(60, 90), true);
  assert.equal(durationAllowedForSave(75, 90), false);

  const kept = clocksAfterStartChange({ startTime: "16:30", endTime: "18:15", duration: 105 }, "17:00");
  assert.deepEqual(kept, { startTime: "17:00", endTime: "18:45", duration: 105 });

  const legacy = clocksAfterStartChange({ startTime: "16:30", endTime: "17:45", duration: 75 }, "17:15");
  assert.deepEqual(legacy, { startTime: "17:15", endTime: "18:30", duration: 75 });

  const halfHour = clocksAfterDurationChange({ startTime: "16:00", endTime: "", duration: 0 }, 90);
  assert.deepEqual(halfHour, { startTime: "16:00", endTime: "17:30", duration: 90 });

  const fromEnd = clocksAfterEndChange({ startTime: "16:00", endTime: "", duration: 0 }, "17:45");
  assert.deepEqual(fromEnd, { startTime: "16:00", endTime: "17:45", duration: 105 });

  const acceptedHalf = clocksAfterEndChange({ startTime: "16:30", endTime: "18:15", duration: 105 }, "18:00");
  assert.deepEqual(acceptedHalf, { startTime: "16:30", endTime: "18:00", duration: 90 });

  const rejected = clocksAfterEndChange({ startTime: "16:30", endTime: "18:15", duration: 105 }, "17:45");
  assert.deepEqual(rejected, { startTime: "16:30", endTime: "18:15", duration: 105 });

  const chosen = clocksAfterDurationChange({ startTime: "16:30", endTime: "", duration: 90 }, 60);
  assert.deepEqual(chosen, { startTime: "16:30", endTime: "17:30", duration: 60 });
  const ignored = clocksAfterDurationChange({ startTime: "16:30", endTime: "18:00", duration: 90 }, 45);
  assert.deepEqual(ignored, { startTime: "16:30", endTime: "18:00", duration: 90 });

  assert.deepEqual(
    ROTATION_PRESETS.map((item) => [item.number, item.times]),
    [
      [1, ["16:30"]],
      [2, ["16:30", "18:30"]],
      [3, ["16:00", "17:45", "19:15"]],
      [4, ["15:30", "17:00", "18:30", "20:00"]],
      [5, ["08:30", "10:00", "11:30", "13:00", "14:30"]],
    ],
  );
});

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
