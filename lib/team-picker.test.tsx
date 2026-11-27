import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamPicker } from "../components/TeamWeek";
import type { TeamDTO } from "./types";

const teams: TeamDTO[] = [
  { id: 1, name: "ילדים א׳", sortOrder: 1, isComments: false },
  { id: 2, name: "נערים ב׳", sortOrder: 2, isComments: false },
];

function markup(current: number[], onCancel?: () => void) {
  return renderToStaticMarkup(
    createElement(TeamPicker, {
      teams,
      current,
      alerts: {},
      pushBlocked: false,
      iosHint: false,
      onSave: () => {},
      onCancel,
    }),
  );
}

function classOf(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  assert.ok(match, `missing ${pattern}`);
  return match[1];
}

function buttonByLabel(html: string, label: string) {
  const match = html.match(new RegExp(`<button\\b([^>]*)>${label}</button>`));
  assert.ok(match, label);
  const className = match[1].match(/class="([^"]*)"/);
  assert.ok(className, label);
  return { attrs: match[1], className: className[1] };
}

/** The disabled attribute, not the `disabled:` utility inside class. */
function hasDisabledAttr(attrs: string) {
  return /(?:^|\s)disabled(?:=|(?=[\s>]|$))/.test(attrs);
}

test("the team picker title and helper stay dark on the light screen in dark mode", () => {
  const html = markup([]);
  assert.match(html, /class="[^"]*\bteam-picker\b[^"]*"/);
  assert.match(html, /dark:bg-\[#fff8f6\]/);
  assert.match(html, /dark:text-\[#111827\]/);

  const heading = classOf(html, /<h2 class="([^"]*)">אילו קבוצות לראות\?<\/h2>/);
  assert.match(heading, /(?:^|\s)text-\[#111827\](?:\s|$)/);
  assert.match(heading, /(?:^|\s)dark:text-\[#111827\](?:\s|$)/);
  assert.equal(heading.includes("text-white"), false);

  const help = classOf(html, /<p class="([^"]*)">אפשר לבחור כמה:/);
  assert.match(help, /(?:^|\s)text-\[#1f2937\](?:\s|$)/);
  assert.match(help, /(?:^|\s)dark:text-\[#1f2937\](?:\s|$)/);
  assert.equal(/text-white|text-zinc-|text-slate-300|dark:text-zinc/.test(help), false);
});

test("the confirm button is white on red, and dark on the light disabled fill", () => {
  const disabled = buttonByLabel(markup([]), "בחרו לפחות קבוצה אחת");
  assert.equal(hasDisabledAttr(disabled.attrs), true);
  assert.match(disabled.className, /bg-\[#c8102e\]/);
  assert.match(disabled.className, /dark:bg-\[#c8102e\]/);
  assert.match(disabled.className, /(?:^|\s)text-white(?:\s|$)/);
  assert.match(disabled.className, /disabled:bg-zinc-300/);
  assert.match(disabled.className, /disabled:text-\[#111827\]/);
  assert.match(disabled.className, /dark:disabled:bg-zinc-300/);
  assert.match(disabled.className, /dark:disabled:text-\[#111827\]/);

  const enabled = buttonByLabel(markup([1]), "הצגת הקבוצה");
  assert.equal(hasDisabledAttr(enabled.attrs), false);
  assert.match(enabled.className, /bg-\[#c8102e\]/);
  assert.match(enabled.className, /(?:^|\s)text-white(?:\s|$)/);

  const cancel = buttonByLabel(markup([1], () => {}), "ביטול");
  assert.match(cancel.className, /text-zinc-600/);
  assert.match(markup([1], () => {}), /dark:bg-zinc-950\/95/);
});
