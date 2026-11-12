import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecurrenceFields } from "../components/RecurrenceFields";

function markup(allowBiweekly: boolean, enabled = false, intervalDays: 7 | 14 = 7) {
  return renderToStaticMarkup(
    createElement(RecurrenceFields, {
      anchor: "2026-11-12",
      enabled,
      onEnabled: () => {},
      weekdays: enabled ? [4] : [],
      onWeekdays: () => {},
      until: enabled ? "2026-12-24" : "",
      onUntil: () => {},
      extraDates: [],
      onExtraDates: () => {},
      allowBiweekly,
      intervalDays,
      onIntervalDays: () => {},
    }),
  );
}

test("other teams keep the weekly repeat control and do not see every two weeks", () => {
  const html = markup(false, true, 14);
  assert.match(html, /אימון חוזר — אותה שעה בימים ובמועדים שתבחרו/);
  assert.equal(html.includes("פעם בשבועיים"), false);
  assert.equal(html.includes("לחזור על זה כל שבוע"), false);
  assert.match(html, /יישמרו \d+ מועדים, כולל היום הזה/);
  assert.equal(html.includes("פעם בשבועיים, כולל"), false);
});

test("football school sees weekly and every-two-weeks, and the count follows the 14-day cadence", () => {
  const closed = markup(true, false, 7);
  assert.match(closed, /אימון חוזר — אותה שעה בימים ובמועדים שתבחרו/);
  assert.match(closed, /לחזור על זה כל שבוע/);
  assert.match(closed, /לחזור על זה פעם בשבועיים/);

  const biweekly = markup(true, true, 14);
  assert.match(biweekly, /יישמרו 4 מועדים, פעם בשבועיים, כולל היום הזה/);
  assert.equal(biweekly.includes("2026-11-19"), false);
});
