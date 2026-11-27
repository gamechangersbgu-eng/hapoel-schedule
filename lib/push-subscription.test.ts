import assert from "node:assert/strict";
import test from "node:test";
import {
  GITHUB_PAGES_ORIGIN,
  NETLIFY_APP_ORIGIN,
  appBasePathFrom,
  resolvePushApiOrigin,
  schedulePathFor,
  serviceWorkerScript,
  shouldShowIosPushHint,
} from "./app-base";
import {
  isAllowedPushOrigin,
  namesForChange,
  parsePushSubscription,
  parseSchedulePath,
  parseUnsubscribe,
  pushBodyForTeams,
  pushCorsHeaders,
  pushPayload,
  subscriptionGone,
  subscriptionsForTeamChange,
} from "./push-subscription";
import { vapidPublicKey, vapidSenderConfig } from "./vapid";

const validBody = {
  endpoint: "https://push.example/device/1",
  keys: { p256dh: "p256dhKey", auth: "authKey" },
  teamIds: [2, 2, 5],
  schedulePath: "/hapoel-schedule/",
};

test("subscriptions for a team change are matched once, and only when a team overlaps", () => {
  const subscriptions = [
    { endpoint: "https://push.example/a", teamIds: [1, 2] },
    { endpoint: "https://push.example/b", teamIds: [3] },
    { endpoint: "https://push.example/a", teamIds: [1] },
    { endpoint: "https://push.example/c", teamIds: [] },
  ];
  const both = subscriptionsForTeamChange(subscriptions, [1, 2]);
  assert.deepEqual(
    both.map((item) => item.endpoint),
    ["https://push.example/a"],
  );
  assert.equal(both.length, 1);
  assert.deepEqual(
    subscriptionsForTeamChange(subscriptions, [3, 9]).map((item) => item.endpoint),
    ["https://push.example/b"],
  );
  assert.deepEqual(subscriptionsForTeamChange(subscriptions, []), []);
  assert.deepEqual(subscriptionsForTeamChange(subscriptions, [0, -1]), []);

  const names = namesForChange([1, 2, 3], [2, 3], new Map([[2, "נוער"], [3, "ילדים א"]]));
  assert.deepEqual(names, ["נוער", "ילדים א"]);
  assert.equal(pushBodyForTeams(names), "יש עדכון בלוח של נוער · ילדים א");
  assert.equal(pushBodyForTeams(["נוער"]), "יש עדכון בלוח של נוער");
  assert.equal(pushPayload(["נוער"], "/").tag, "hapoel-schedule-update");
  assert.equal(pushPayload(["נוער"], "/").title, "עדכון בלוח האימונים");
  assert.equal(pushPayload(["נוער"], "/").body, "יש עדכון בלוח של נוער");
  const logistics = pushPayload([], "/?week=2026-11-22", {
    title: "עדכון למאמן",
    body: "עדכון למאמן: משחק חוץ · יציאה מבאר שבע: 14:30",
    tag: "hapoel-schedule-coach-update",
  });
  assert.equal(logistics.title, "עדכון למאמן");
  assert.equal(logistics.body, "עדכון למאמן: משחק חוץ · יציאה מבאר שבע: 14:30");
  assert.equal(logistics.tag, "hapoel-schedule-coach-update");
  assert.equal(logistics.url, "/?week=2026-11-22");
  assert.equal(pushPayload(["נוער"], "/").body, "יש עדכון בלוח של נוער");
});

test("push CORS allows the Pages origin and the Netlify app only", () => {
  assert.equal(isAllowedPushOrigin(GITHUB_PAGES_ORIGIN), true);
  assert.equal(isAllowedPushOrigin(NETLIFY_APP_ORIGIN), true);
  assert.equal(isAllowedPushOrigin("https://evil.example"), false);
  assert.equal(isAllowedPushOrigin("http://gamechangersbgu-eng.github.io"), false);
  assert.equal(isAllowedPushOrigin(null), false);
  assert.equal(isAllowedPushOrigin(`${GITHUB_PAGES_ORIGIN}/hapoel-schedule`), false);
  const headers = pushCorsHeaders(GITHUB_PAGES_ORIGIN);
  assert.equal(headers?.["Access-Control-Allow-Origin"], GITHUB_PAGES_ORIGIN);
  assert.equal(pushCorsHeaders("https://evil.example"), null);
});

test("subscription input is validated and team ids are de-duplicated", () => {
  const parsed = parsePushSubscription(validBody);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value.teamIds, [2, 5]);
  assert.equal(parsed.value.schedulePath, "/hapoel-schedule/");
  assert.equal(parsed.value.endpoint, "https://push.example/device/1");

  assert.equal(parsePushSubscription(null).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, endpoint: "http://push.example/a" }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, endpoint: "not a url" }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, keys: { p256dh: "", auth: "authKey" } }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, keys: { p256dh: "bad key", auth: "authKey" } }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, teamIds: [] }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, teamIds: [0] }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, teamIds: ["2"] }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, teamIds: [1.5] }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, schedulePath: "https://evil.example/" }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, schedulePath: "/../admin" }).ok, false);
  assert.equal(parsePushSubscription({ ...validBody, schedulePath: "//evil.example" }).ok, false);
  assert.equal(parseSchedulePath("/"), "/");
  assert.equal(parseUnsubscribe({ endpoint: validBody.endpoint }).ok, true);
  assert.equal(parseUnsubscribe({ endpoint: "http://push.example/a" }).ok, false);
});

test("gone subscriptions are the ones push services report as 410 or 404", () => {
  assert.equal(subscriptionGone(410), true);
  assert.equal(subscriptionGone(404), true);
  assert.equal(subscriptionGone(500), false);
  assert.equal(subscriptionGone(undefined), false);
});

test("Pages registers under /hapoel-schedule and posts subscriptions to Netlify", () => {
  assert.equal(appBasePathFrom("/hapoel-schedule/"), "/hapoel-schedule");
  assert.equal(appBasePathFrom("/", "/hapoel-schedule"), "/hapoel-schedule");
  assert.equal(serviceWorkerScript("/hapoel-schedule/"), "/hapoel-schedule/sw.js");
  assert.equal(serviceWorkerScript("/"), "/sw.js");
  assert.equal(schedulePathFor("/hapoel-schedule"), "/hapoel-schedule/");
  assert.equal(schedulePathFor(""), "/");
  assert.equal(resolvePushApiOrigin(GITHUB_PAGES_ORIGIN), NETLIFY_APP_ORIGIN);
  assert.equal(resolvePushApiOrigin(NETLIFY_APP_ORIGIN), "");
  assert.equal(resolvePushApiOrigin("http://localhost:3000"), "");
  assert.equal(resolvePushApiOrigin(GITHUB_PAGES_ORIGIN, "https://preview.example"), "https://preview.example");
  assert.equal(resolvePushApiOrigin("https://preview.example", "https://preview.example"), "");
});

test("the iOS Home Screen hint shows once, only when bells are on and the app is not installed", () => {
  assert.equal(shouldShowIosPushHint({ hasAlerts: true, ios: true, standalone: false, alreadyShown: false }), true);
  assert.equal(shouldShowIosPushHint({ hasAlerts: true, ios: true, standalone: false, alreadyShown: true }), false);
  assert.equal(shouldShowIosPushHint({ hasAlerts: true, ios: true, standalone: true, alreadyShown: false }), false);
  assert.equal(shouldShowIosPushHint({ hasAlerts: false, ios: true, standalone: false, alreadyShown: false }), false);
  assert.equal(shouldShowIosPushHint({ hasAlerts: true, ios: false, standalone: false, alreadyShown: false }), false);
});

test("sender config stays empty until the public key, private key, and subject are all set", () => {
  const keys = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(vapidPublicKey(), null);
    assert.equal(vapidSenderConfig(), null);
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-test";
    assert.equal(vapidPublicKey(), "public-test");
    assert.equal(vapidSenderConfig(), null);
    process.env.VAPID_PRIVATE_KEY = "private-test";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    assert.deepEqual(vapidSenderConfig(), {
      publicKey: "public-test",
      privateKey: "private-test",
      subject: "mailto:test@example.com",
    });
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
