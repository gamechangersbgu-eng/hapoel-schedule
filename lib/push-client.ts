"use client";

// Browser side of parent/player web push. Preferences stay in localStorage even when
// this no-ops (missing VAPID key, no service worker, or a browser without PushManager).

import { appBasePathFrom, isIosBrowser, isStandaloneDisplay, resolvePushApiOrigin, schedulePathFor, serviceWorkerScript, shouldShowIosPushHint } from "@/lib/app-base";

const IOS_PUSH_HINT_SESSION = "hapoel-ios-push-hint-v1";

export type PushSetupResult = "subscribed" | "denied" | "skipped";

function configuredBasePath() {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

function configuredApiOrigin() {
  return process.env.NEXT_PUBLIC_PUSH_API_ORIGIN ?? "";
}

export function currentSchedulePath() {
  if (typeof window === "undefined") return schedulePathFor(appBasePathFrom("/", configuredBasePath()));
  return schedulePathFor(appBasePathFrom(window.location.pathname, configuredBasePath()));
}

function apiUrl(path: string) {
  const origin =
    typeof window === "undefined" ? "" : resolvePushApiOrigin(window.location.origin, configuredApiOrigin());
  return `${origin}${path}`;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function takeIosPushHint(hasAlerts: boolean): boolean {
  if (typeof window === "undefined" || !hasAlerts) return false;
  const ios = isIosBrowser(navigator.userAgent, navigator.maxTouchPoints);
  const standalone = isStandaloneDisplay(
    window.matchMedia("(display-mode: standalone)").matches,
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
  let alreadyShown = false;
  try {
    alreadyShown = window.sessionStorage.getItem(IOS_PUSH_HINT_SESSION) === "1";
  } catch {
    alreadyShown = false;
  }
  if (!shouldShowIosPushHint({ hasAlerts, ios, standalone, alreadyShown })) return false;
  try {
    window.sessionStorage.setItem(IOS_PUSH_HINT_SESSION, "1");
  } catch {
    /* show it this once anyway */
  }
  return true;
}

export function notificationsAreBlocked() {
  return typeof Notification !== "undefined" && Notification.permission === "denied";
}

async function loadPublicKey(): Promise<string | null> {
  const baked = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
  if (baked) return baked;
  try {
    const response = await fetch(apiUrl("/api/push/config"), { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { publicKey?: unknown };
    return typeof body.publicKey === "string" && body.publicKey.trim() ? body.publicKey.trim() : null;
  } catch {
    return null;
  }
}

async function postSubscription(subscription: PushSubscription, teamIds: number[]) {
  const json = subscription.toJSON();
  const response = await fetch(apiUrl("/api/push/subscription"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      teamIds,
      schedulePath: currentSchedulePath(),
    }),
  });
  if (!response.ok) console.warn("[web-push] register failed");
}

export async function clearPushSubscription() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(apiUrl("/api/push/subscription"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    console.warn("[web-push] unsubscribe failed");
  }
}

export async function enablePushForTeams(teamIds: number[]): Promise<PushSetupResult> {
  if (typeof window === "undefined") return "skipped";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "skipped";
  if (teamIds.length === 0) {
    await clearPushSubscription();
    return "skipped";
  }

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return "skipped";
    }
  }
  if (permission !== "granted") return "denied";

  // Dev unregisters the worker (see PwaSetup). The bell preference is already stored.
  if (process.env.NODE_ENV !== "production") return "skipped";

  try {
    const script = serviceWorkerScript(window.location.pathname, configuredBasePath());
    await navigator.serviceWorker.register(script);
    const registration = await navigator.serviceWorker.ready;
    const publicKey = await loadPublicKey();
    if (!publicKey) {
      console.warn("[web-push] public VAPID key is unset; preference saved, subscription skipped");
      return "skipped";
    }
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await postSubscription(subscription, teamIds);
    return "subscribed";
  } catch {
    console.warn("[web-push] could not subscribe");
    return "skipped";
  }
}

/** Refresh the server's team list when permission was already granted. Does not prompt. */
export async function resyncPushIfGranted(teamIds: number[]) {
  if (teamIds.length === 0) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  await enablePushForTeams(teamIds);
}

export async function applyPushChoice(teamIds: number[]): Promise<PushSetupResult> {
  try {
    if (teamIds.length === 0) {
      await clearPushSubscription();
      return "skipped";
    }
    return await enablePushForTeams(teamIds);
  } catch {
    console.warn("[web-push] subscribe failed");
    return "skipped";
  }
}
