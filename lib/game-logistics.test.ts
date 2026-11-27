import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_UPDATE_INTENT,
  COACH_UPDATE_TITLE,
  awayDepartureWarning,
  canNotifyCoach,
  coachNotifyPlan,
  coachUpdateBody,
  coachUpdatePageMessage,
  coachUpdateRequested,
  coachUpdateStatus,
  effectiveDepartureTime,
  homeGamePitchText,
  readManualDeparture,
  tvHomeGameLine,
  type CoachUpdateNotice,
} from "./game-logistics";

const home: CoachUpdateNotice = {
  teamName: "נוער א",
  kind: "home_game",
  dateLabel: "27.11",
  kickoff: "18:00",
  opponent: "מכבי תל אביב",
  pitchName: "וסרמיל 2",
  medicName: "דני כהן",
  medicPhone: "050-1111111",
  driverName: null,
  driverPhone: null,
  cityName: null,
  departureTime: null,
};

const away: CoachUpdateNotice = {
  ...home,
  kind: "away_game",
  pitchName: null,
  medicName: null,
  medicPhone: null,
  driverName: "יוסי לוי",
  driverPhone: "050-2222222",
  cityName: "חיפה",
  departureTime: "14:30",
};

test("manual departure overrides the suggestion and an empty manual falls back", () => {
  assert.equal(effectiveDepartureTime("16:05", "14:30"), "16:05");
  assert.equal(effectiveDepartureTime("16:05:00", "14:30"), "16:05");
  assert.equal(effectiveDepartureTime(null, "14:30"), "14:30");
  assert.equal(effectiveDepartureTime("", "14:30"), "14:30");
  assert.equal(effectiveDepartureTime("   ", "09:00"), "09:00");
  assert.equal(effectiveDepartureTime(null, null), null);
  assert.equal(effectiveDepartureTime("nope", "14:30"), "14:30");
  assert.deepEqual(readManualDeparture(""), { ok: true, time: null });
  assert.deepEqual(readManualDeparture(null), { ok: true, time: null });
  assert.deepEqual(readManualDeparture("16:05"), { ok: true, time: "16:05" });
  assert.deepEqual(readManualDeparture("25:00"), { ok: false });
  assert.deepEqual(readManualDeparture("יציאה"), { ok: false });
});

test("a home game shows its pitch on the schedule only when one is set", () => {
  assert.equal(homeGamePitchText({ type: "home_game", pitchName: "וסרמיל 1" }), "מגרש וסרמיל 1");
  assert.equal(homeGamePitchText({ type: "home_game", pitchName: "  " }), null);
  assert.equal(homeGamePitchText({ type: "home_game", pitchName: null }), null);
  assert.equal(homeGamePitchText({ type: "away_game", pitchName: "וסרמיל 1" }), null);
  assert.equal(
    tvHomeGameLine({ type: "home_game", opponent: "מכבי", pitchName: "וסרמיל 3" }),
    "בית · מכבי · מגרש וסרמיל 3",
  );
  assert.equal(tvHomeGameLine({ type: "home_game", opponent: null, pitchName: null }), "משחק בית");
  assert.equal(tvHomeGameLine({ type: "away_game", opponent: "מכבי", pitchName: "וסרמיל 1" }), null);
});

test("away warning keeps the old sentence until a departure exists", () => {
  assert.equal(awayDepartureWarning({ cityId: null, departureTime: null }), "לא נבחרה עיר, ולכן אין שעת יציאה");
  assert.equal(awayDepartureWarning({ cityId: null, departureTime: "16:00" }), "לא נבחרה עיר");
  assert.equal(awayDepartureWarning({ cityId: 4, departureTime: null }), "אין שעת יציאה");
  assert.equal(awayDepartureWarning({ cityId: 4, departureTime: "16:00" }), null);
});

test("coach update is a manager web-push and names medic, driver, and departure", () => {
  assert.equal(canNotifyCoach("owner"), true);
  assert.equal(canNotifyCoach("admin"), true);
  assert.equal(canNotifyCoach("coach"), false);
  assert.equal(canNotifyCoach("physio"), false);
  assert.equal(coachUpdateRequested(COACH_UPDATE_INTENT), true);
  assert.equal(coachUpdateRequested("save"), false);
  assert.equal(coachUpdateRequested(undefined), false);

  const homePlan = coachNotifyPlan({ role: "owner", intent: COACH_UPDATE_INTENT, notice: home });
  assert.equal(homePlan.notify, true);
  if (!homePlan.notify) return;
  assert.equal(homePlan.title, COACH_UPDATE_TITLE);
  assert.match(homePlan.body, /עדכון למאמן: משחק בית של נוער א ב-27\.11 18:00/);
  assert.match(homePlan.body, /מגרש וסרמיל 2/);
  assert.match(homePlan.body, /חובש: דני כהן 050-1111111/);
  assert.equal(homePlan.body.includes("נהג"), false);
  assert.equal(/whatsapp|sms|וואטסאפ/i.test(homePlan.body), false);

  const awayPlan = coachNotifyPlan({ role: "admin", intent: COACH_UPDATE_INTENT, notice: away });
  assert.equal(awayPlan.notify, true);
  if (!awayPlan.notify) return;
  assert.match(awayPlan.body, /נהג: יוסי לוי 050-2222222/);
  assert.match(awayPlan.body, /יציאה מבאר שבע: 14:30/);
  assert.match(awayPlan.body, /חיפה/);
  assert.equal(awayPlan.body.includes("חובש"), false);

  const missing = coachUpdateBody({ ...away, driverName: null, driverPhone: null, departureTime: null, cityName: null });
  assert.match(missing, /נהג: לא שובץ/);
  assert.match(missing, /יציאה מבאר שבע: לא נקבעה/);

  assert.deepEqual(coachNotifyPlan({ role: "coach", intent: COACH_UPDATE_INTENT, notice: home }), { notify: false });
  assert.deepEqual(coachNotifyPlan({ role: "owner", intent: "save", notice: home }), { notify: false });
});

test("the games page reports how many subscribers got the coach update", () => {
  assert.equal(
    coachUpdatePageMessage("sent", 3, 3),
    "נשלח עדכון למאמן (3 מנויים).",
  );
  assert.equal(
    coachUpdatePageMessage("sent", 4, 2),
    "נשלח עדכון למאמן ל-2 מתוך 4 מנויים.",
  );
  assert.match(coachUpdatePageMessage("none", 0, 0) ?? "", /נשמר/);
  assert.match(coachUpdatePageMessage("none", 0, 0) ?? "", /אין מנויים/);
  assert.match(coachUpdatePageMessage("vapid", 0, 0) ?? "", /נשמר/);
  assert.equal(coachUpdatePageMessage(undefined, 1, 1), null);
  assert.equal(coachUpdatePageMessage("sent", Number.NaN, 1), "נשלח עדכון למאמן ל-1 מתוך 0 מנויים.");

  assert.equal(coachUpdateStatus({ subscribers: 2, sent: 2, failed: 0, skipped: null }), "sent");
  assert.equal(coachUpdateStatus({ subscribers: 0, sent: 0, failed: 0, skipped: "no_subscribers" }), "none");
  assert.equal(coachUpdateStatus({ subscribers: 0, sent: 0, failed: 0, skipped: "no_vapid" }), "vapid");
  assert.equal(coachUpdateStatus({ subscribers: 2, sent: 0, failed: 2, skipped: null }), "failed");
  assert.equal(coachUpdateStatus({ subscribers: 0, sent: 0, failed: 0, skipped: "error" }), "error");
});
