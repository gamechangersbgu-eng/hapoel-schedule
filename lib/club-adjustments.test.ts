import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Legend } from "../components/Legend";
import { PracticeGameFields } from "../components/PracticeGameFields";
import { practiceGameDetail } from "../components/display-utils";
import { readPracticeText } from "./practice-game";
import {
  allowedSubdivisionsForTeam,
  classifyBooking,
  GIRLS_EXTRA_SUBDIVISIONS,
  type BoardBooking,
  type PitchDay,
} from "./pitch-rules";
import { getSlotType } from "./slot-types";

function hexRgb(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function contrast(bg: string, fg: string) {
  const lum = (hex: string) => {
    const { r, g, b } = hexRgb(hex);
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const [R, G, B] = [channel(r), channel(g), channel(b)];
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const lighter = Math.max(lum(bg), lum(fg));
  const darker = Math.min(lum(bg), lum(fg));
  return (lighter + 0.05) / (darker + 0.05);
}

const PARTS = [
  { code: "whole", labelHe: "מגרש שלם" },
  { code: "half_north", labelHe: "חצי מגרש (צפון)" },
  { code: "half_south", labelHe: "חצי מגרש (דרום)" },
  { code: "third_north", labelHe: "שליש מגרש (צפון)" },
  { code: "third_center", labelHe: "שליש מגרש (מרכז)" },
  { code: "third_south", labelHe: "שליש מגרש (דרום)" },
  { code: "quarter_north_1", labelHe: "רבע מגרש (צפון 1)" },
  { code: "quarter_north_2", labelHe: "רבע מגרש (צפון 2)" },
  { code: "quarter_south_1", labelHe: "רבע מגרש (דרום 1)" },
  { code: "quarter_south_2", labelHe: "רבע מגרש (דרום 2)" },
];

const OLDER = ["whole", "half_north", "half_south"];

function labelsFor(name: string) {
  const allowed = new Set(allowedSubdivisionsForTeam({ name, allowedSubdivisions: OLDER }));
  return PARTS.filter((item) => allowed.has(item.code)).map((item) => item.labelHe);
}

function pitch(): PitchDay["pitches"][number] {
  return {
    id: 1,
    code: "vasermil_1",
    nameHe: "וסרמיל 1",
    colorKey: "green",
    surfaceType: "synthetic",
    isReservedLock: false,
    allowsHomeGames: true,
  };
}

function booking(partial: Partial<BoardBooking> & Pick<BoardBooking, "slotId" | "teamId" | "teamName" | "subdivisionCode">): BoardBooking {
  return {
    kind: "training",
    pitchId: 1,
    start: 16 * 60,
    end: 17 * 60,
    durationMinutes: 60,
    rotationTemplateId: null,
    note: null,
    opponent: null,
    status: "active",
    statusNote: null,
    substituteStaffId: null,
    seriesId: null,
    ...partial,
  };
}

function day(teams: PitchDay["teams"], bookings: BoardBooking[] = []): PitchDay {
  return {
    date: "2026-11-16",
    pitches: [pitch()],
    subdivisions: PARTS,
    durations: [],
    rotations: [],
    teams,
    footballSchoolRules: [],
    bookings,
    coaches: [],
  };
}

test("חופש is pink and the label stays readable", () => {
  const off = getSlotType("off");
  assert.equal(off.label, "חופש");
  assert.equal(off.bg, "#F48FB1");
  assert.equal(off.fg, "#1a1a1a");
  const { r, g, b } = hexRgb(off.bg);
  assert.equal(r > g && b > g && r > 200, true);
  assert.equal(contrast(off.bg, off.fg) >= 4.5, true);

  const html = renderToStaticMarkup(createElement(Legend));
  assert.match(html, /#F48FB1/);
  assert.match(html, /חופש/);
  assert.match(html, /משחק אימון/);
  assert.match(html, /#00695C/);
});

test("a practice game keeps opponent and medic text, and shows both", () => {
  assert.deepEqual(readPracticeText("  מכבי   אשדוד  "), { value: "מכבי אשדוד" });
  assert.deepEqual(readPracticeText("   "), { value: null });
  assert.equal("error" in readPracticeText("א".repeat(121)), true);

  const slot = { type: "practice_game", opponent: "מ.ס. אשדוד", medicName: "יוסי כהן" };
  assert.equal(practiceGameDetail(slot), "נגד מ.ס. אשדוד · חובש: יוסי כהן");
  assert.equal(practiceGameDetail({ type: "off", opponent: "מ.ס. אשדוד", medicName: "יוסי" }), null);
  assert.equal(practiceGameDetail({ type: "practice_game", opponent: "  ", medicName: null }), null);

  const html = renderToStaticMarkup(
    createElement(PracticeGameFields, {
      opponent: "מ.ס. אשדוד",
      medicName: "יוסי כהן",
      opponentNames: ["מ.ס. אשדוד", "הפועל תל אביב"],
    }),
  );
  assert.match(html, /name="opponent"/);
  assert.match(html, /name="medicName"/);
  assert.match(html, /value="מ\.ס\. אשדוד"/);
  assert.match(html, /value="יוסי כהן"/);
  assert.match(html, /הפועל תל אביב/);
  assert.match(html, /יריבה/);
  assert.match(html, /חובש/);
});

test("ילדות א, ילדות ב, and טרומיות gain a third and a quarter", () => {
  for (const name of ["ילדות א", "ילדות ב", "טרומיות", "  טרומיות  "]) {
    const allowed = allowedSubdivisionsForTeam({ name, allowedSubdivisions: OLDER });
    for (const code of GIRLS_EXTRA_SUBDIVISIONS) assert.equal(allowed.includes(code), true, name);
    assert.equal(allowed.filter((code) => code === "third_north").length, 1);
  }
  const girlsLabels = labelsFor("ילדות א");
  assert.equal(girlsLabels.includes("שליש מגרש (צפון)"), true);
  assert.equal(girlsLabels.includes("רבע מגרש (צפון 1)"), true);
  assert.equal(girlsLabels.includes("מגרש שלם"), true);

  for (const name of ["נוער", "נערים א", "ילדים א אדום", "ילדים ב לבן", "ילדות"]) {
    const allowed = allowedSubdivisionsForTeam({ name, allowedSubdivisions: OLDER });
    assert.deepEqual(allowed, OLDER, name);
    const labels = labelsFor(name);
    assert.equal(labels.some((label) => label.includes("שליש") || label.includes("רבע")), false, name);
  }

  const already = allowedSubdivisionsForTeam({
    name: "ילדות ב",
    allowedSubdivisions: [...OLDER, ...GIRLS_EXTRA_SUBDIVISIONS],
  });
  assert.equal(already.length, OLDER.length + GIRLS_EXTRA_SUBDIVISIONS.length);
});

test("טרומיות can book a quarter beside a non-overlapping third", () => {
  const tromiyot = { id: 7, name: "טרומיות", ageBandCode: "yeladot", allowedSubdivisions: OLDER };
  const other = { id: 2, name: "נוער", ageBandCode: "noar_through_yeladim_b", allowedSubdivisions: OLDER };
  const allowed = classifyBooking(
    day([tromiyot, other], [booking({ slotId: 3, teamId: 2, teamName: "נוער", subdivisionCode: "third_south" })]),
    { teamId: 7, pitchId: 1, subdivisionCode: "quarter_north_1", start: 16 * 60, durationMinutes: 60 },
  );
  assert.deepEqual(allowed.hard, []);
  assert.deepEqual(allowed.conflicts, []);

  const third = classifyBooking(day([tromiyot]), {
    teamId: 7,
    pitchId: 1,
    subdivisionCode: "third_center",
    start: 16 * 60,
    durationMinutes: 60,
  });
  assert.deepEqual(third.hard, []);
});

test("a girls' quarter shares the pitch with a part that does not overlap", () => {
  const girls = { id: 1, name: "ילדות א", ageBandCode: "noar_through_yeladim_b", allowedSubdivisions: OLDER };
  const other = { id: 2, name: "נוער", ageBandCode: "noar_through_yeladim_b", allowedSubdivisions: OLDER };
  const propose = (teamId: number, subdivisionCode: string) => ({
    teamId,
    pitchId: 1,
    subdivisionCode,
    start: 16 * 60,
    durationMinutes: 60,
  });

  const beside = classifyBooking(
    day([girls, other], [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "quarter_south_2" })]),
    propose(1, "quarter_north_1"),
  );
  assert.deepEqual(beside.hard, []);
  assert.deepEqual(beside.conflicts, []);

  const thirdClear = classifyBooking(
    day([girls, other], [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "quarter_south_1" })]),
    propose(1, "third_north"),
  );
  assert.deepEqual(thirdClear.conflicts, []);

  const overlapQuarter = classifyBooking(
    day([girls, other], [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "half_north" })]),
    propose(1, "quarter_north_1"),
  );
  assert.equal(overlapQuarter.conflicts.length, 1);

  const overlapThird = classifyBooking(
    day([girls, other], [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "quarter_north_2" })]),
    propose(1, "third_north"),
  );
  assert.equal(overlapThird.conflicts.length, 1);

  const wholeBlocks = classifyBooking(
    day([girls, other], [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "whole" })]),
    propose(1, "quarter_south_2"),
  );
  assert.equal(wholeBlocks.conflicts.length, 1);

  const otherPitch = classifyBooking(
    day([girls, other], [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "whole", pitchId: 2 })]),
    propose(1, "third_center"),
  );
  assert.deepEqual(otherPitch.conflicts, []);

  const cancelled = classifyBooking(
    day(
      [girls, other],
      [booking({ slotId: 8, teamId: 2, teamName: "נוער", subdivisionCode: "whole", status: "cancelled" })],
    ),
    propose(1, "quarter_north_1"),
  );
  assert.deepEqual(cancelled.conflicts, []);

  const noarQuarter = classifyBooking(day([other]), propose(2, "quarter_north_1"));
  assert.equal(noarQuarter.hard.length, 1);
  assert.match(noarQuarter.hard[0], /נוער יכולה להתאמן רק ב/);
  assert.equal(noarQuarter.hard[0].includes("רבע"), false);

  const girlsQuarter = classifyBooking(day([girls]), propose(1, "third_south"));
  assert.deepEqual(girlsQuarter.hard, []);
});
