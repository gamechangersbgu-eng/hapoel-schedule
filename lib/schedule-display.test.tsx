import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameSaveButtons } from "../components/GameSaveButtons";
import { GameScheduleDetail } from "../components/GameScheduleDetail";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { COACH_UPDATE_INTENT } from "./game-logistics";
import type { SlotDTO, TeamDTO } from "./types";

function slot(partial: Partial<SlotDTO> & Pick<SlotDTO, "type">): SlotDTO {
  return {
    id: 1,
    teamId: 1,
    date: "2026-11-29",
    endDate: null,
    startTime: "18:00",
    note: null,
    ...partial,
  };
}

const team: TeamDTO = { id: 1, name: "נוער א", sortOrder: 1, isComments: false };

test("the desktop schedule prints the pitch of a home game", () => {
  const html = renderToStaticMarkup(
    createElement(ScheduleGrid, {
      dates: ["2026-11-29"],
      teams: [team],
      slots: [slot({ type: "home_game", pitchName: "וסרמיל 2", opponent: "מכבי" })],
    }),
  );
  assert.match(html, /משחק בית/);
  assert.match(html, /מגרש וסרמיל 2/);

  const empty = renderToStaticMarkup(
    createElement(ScheduleGrid, {
      dates: ["2026-11-29"],
      teams: [team],
      slots: [slot({ type: "home_game", pitchName: null })],
    }),
  );
  assert.equal(empty.includes("מגרש"), false);
});

test("the phone schedule shows the pitch and the effective departure", () => {
  const home = renderToStaticMarkup(
    createElement(GameScheduleDetail, {
      slot: slot({ type: "home_game", opponent: "מכבי", pitchName: "וסרמיל 4" }),
    }),
  );
  assert.match(home, /נגד מכבי/);
  assert.match(home, /מגרש וסרמיל 4/);
  assert.equal(home.includes("יציאה"), false);

  const away = renderToStaticMarkup(
    createElement(GameScheduleDetail, {
      slot: slot({ type: "away_game", opponent: "הפועל חיפה", departureTime: "16:05", pitchName: "וסרמיל 1" }),
    }),
  );
  assert.match(away, /יציאה מבאר שבע/);
  assert.match(away, /16:05/);
  assert.equal(away.includes("וסרמיל"), false);

  assert.equal(
    renderToStaticMarkup(createElement(GameScheduleDetail, { slot: slot({ type: "training" }) })),
    "",
  );
});

test("the notify-coach button posts the coach intent and does not mention WhatsApp", () => {
  const html = renderToStaticMarkup(createElement(GameSaveButtons, { closeHref: "/admin/games?week=2026-11-29" }));
  assert.match(html, /שלח עדכון למאמן/);
  assert.match(html, new RegExp(`name="intent"[^>]*value="${COACH_UPDATE_INTENT}"|value="${COACH_UPDATE_INTENT}"[^>]*name="intent"`));
  assert.match(html, /value="save"/);
  assert.match(html, /התראת דפדפן/);
  assert.equal(/whatsapp|sms|וואטסאפ/i.test(html), false);
});
