import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeamPicker } from "../components/TeamWeek";

test("the public team picker heading and helper stay black on a white panel", () => {
  const html = renderToStaticMarkup(
    createElement(TeamPicker, {
      teams: [{ id: 1, name: "נוער", sortOrder: 1, isComments: false }],
      current: [],
      alerts: {},
      pushBlocked: false,
      iosHint: false,
      onSave: () => {},
    }),
  );
  const heading = html.match(/<h2\b[^>]*>אילו קבוצות לראות\?<\/h2>/)?.[0] ?? "";
  const helper = html.match(/<p\b[^>]*>אפשר לבחור כמה:[\s\S]*?<\/p>/)?.[0] ?? "";
  for (const node of [heading, helper]) {
    assert.match(node, /text-black/);
    assert.match(node, /opacity-100/);
    assert.match(node, /color:#000000/);
    assert.match(node, /opacity:1/);
    assert.equal(node.includes("dark:"), false);
    assert.equal(/slate-|zinc-/.test(node), false);
  }
  assert.match(html, /background-color:#ffffff|background-color:rgb\(255, 255, 255\)/);
  assert.match(html, /bg-white/);
});
