import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileDayNav } from "../components/MobileDayNav";
import { NotifyTeamField, NotifyTeamToggle } from "../components/NotifyTeamToggle";

test("the training notification checkbox is off by default and labeled in Hebrew", () => {
  const html = renderToStaticMarkup(createElement(NotifyTeamToggle, { name: "notifyTeam" }));
  assert.match(html, /שלח התראה לקבוצה/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /name="notifyTeam"/);
  assert.match(html, /value="1"/);
  assert.equal(html.includes("checked"), false);

  const on = renderToStaticMarkup(
    createElement(NotifyTeamToggle, { checked: true, onChange: () => {}, name: "notifyTeam" }),
  );
  assert.match(on, /checked/);
  const off = renderToStaticMarkup(
    createElement(NotifyTeamToggle, { checked: false, onChange: () => {} }),
  );
  assert.equal(off.includes("checked"), false);
});

test("a separate delete form receives the opt-in only when the owner asked", () => {
  assert.equal(renderToStaticMarkup(createElement(NotifyTeamField, { requested: false })), "");
  const html = renderToStaticMarkup(createElement(NotifyTeamField, { requested: true }));
  assert.match(html, /type="hidden"/);
  assert.match(html, /name="notifyTeam"/);
  assert.match(html, /value="1"/);
});

test("the mobile day row offers previous, today, and next", () => {
  const html = renderToStaticMarkup(
    createElement(MobileDayNav, {
      dayTitle: "יום שישי",
      dateLabel: "27.11",
      onPrevious: () => {},
      onToday: () => {},
      onNext: () => {},
    }),
  );
  assert.match(html, /יום קודם/);
  assert.match(html, />היום</);
  assert.match(html, /יום הבא/);
  assert.equal(html.includes("aria-current"), false);

  const current = renderToStaticMarkup(
    createElement(MobileDayNav, {
      dayTitle: "יום שישי",
      dateLabel: "27.11",
      onPrevious: () => {},
      onToday: () => {},
      onNext: () => {},
      todayCurrent: true,
    }),
  );
  assert.match(current, /aria-current="date"/);
});
