import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AppHeader } from "../components/AppHeader";
import { ClubLogo } from "../components/ClubLogo";
import { TvBoard } from "../components/TvBoard";
import type { WeekData } from "./types";

const router = {
  back() {},
  forward() {},
  prefetch() {},
  push() {},
  refresh() {},
  replace() {},
  bfcacheId: "test",
};

function renderHeader(node: ReactNode) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, node));
}

const week: WeekData = {
  clubName: "הפועל באר שבע",
  seasonStartDate: "2026-08-01",
  weekStart: "2026-11-22",
  weekNumber: 12,
  dates: ["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"],
  teams: [],
  slots: [],
};

function assertLogoOnWhiteDisc(html: string) {
  assert.match(html, /<header[\s\S]*src="\/hbs-academy-logo\.png"[\s\S]*<\/header>/);
  assert.match(html, /alt="HBS Academy"/);
  assert.match(html, /rounded-full bg-white/);
}

test("the schedule header shows the academy logo on a white disc", () => {
  const phone = renderHeader(
    createElement(AppHeader, {
      clubName: "הפועל באר שבע",
      weekNumber: 12,
      weekStart: "2026-11-22",
      basePath: "/",
      compactOnMobile: true,
    }),
  );
  assertLogoOnWhiteDisc(phone);

  const desktop = renderHeader(
    createElement(AppHeader, {
      clubName: "הפועל באר שבע",
      weekNumber: 12,
      weekStart: "2026-11-22",
      basePath: "/",
    }),
  );
  assertLogoOnWhiteDisc(desktop);

  const admin = renderHeader(
    createElement(AppHeader, {
      clubName: "הפועל באר שבע",
      weekNumber: 12,
      weekStart: "2026-11-22",
      basePath: "/admin",
      adminMode: true,
    }),
  );
  assertLogoOnWhiteDisc(admin);
  assert.match(admin, /מצב מנהל/);
});

test("the TV header shows the academy logo on a white disc", () => {
  const html = renderToStaticMarkup(createElement(TvBoard, { data: week }));
  assertLogoOnWhiteDisc(html);
  assert.match(html, /תכנית אימונים — שבוע 12/);
});

test("the crest sits directly on a white surface, and on a disc when the bar is red", () => {
  const onRed = renderToStaticMarkup(createElement(ClubLogo, { plate: true }));
  assert.match(onRed, /src="\/hbs-academy-logo\.png"/);
  assert.match(onRed, /rounded-full bg-white p-0\.5/);
  const onWhite = renderToStaticMarkup(createElement(ClubLogo, { plate: false, size: "login" }));
  assert.match(onWhite, /src="\/hbs-academy-logo\.png"/);
  assert.equal(onWhite.includes("bg-white"), false);
});
