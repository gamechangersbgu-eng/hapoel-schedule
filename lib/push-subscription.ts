// Pure checks for the public push API and for who hears about a schedule change.
// No database and no network. Coach WhatsApp/SMS stays in lib/update-recipients.ts.

import { GITHUB_PAGES_ORIGIN, NETLIFY_APP_ORIGIN } from "@/lib/app-base";

export const PUSH_TITLE = "עדכון בלוח האימונים";
export const PUSH_TAG = "hapoel-schedule-update";
/** Replaces the previous logistics note instead of stacking on the generic schedule tag. */
export const COACH_UPDATE_PUSH_TAG = "hapoel-schedule-coach-update";

export const PUSH_ALLOWED_ORIGINS = [GITHUB_PAGES_ORIGIN, NETLIFY_APP_ORIGIN] as const;

const ENDPOINT_MAX = 2000;
const KEY_MAX = 200;
const PATH_MAX = 200;
const TEAMS_MAX = 100;

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  teamIds: number[];
  schedulePath: string;
};

export type PushSubscriptionTarget = {
  endpoint: string;
  teamIds: number[];
};

export function isAllowedPushOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  return (PUSH_ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

export function pushCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!isAllowedPushOrigin(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** 410 Gone (and 404 from push services) means the browser dropped the subscription. */
export function subscriptionGone(statusCode: number | undefined): boolean {
  return statusCode === 410 || statusCode === 404;
}

export function parseEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > ENDPOINT_MAX) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

function parseKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > KEY_MAX) return null;
  if (!/^[A-Za-z0-9+/_=-]+$/.test(trimmed)) return null;
  return trimmed;
}

/** Positive integer team ids, de-duplicated. Empty or garbage is rejected. */
export function parseTeamIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > TEAMS_MAX) return null;
  const ids: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item <= 0) return null;
    ids.push(item);
  }
  return [...new Set(ids)];
}

/** Same-origin path only, so a notification cannot open another site. */
export function parseSchedulePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > PATH_MAX) return null;
  if (!value.startsWith("/")) return null;
  if (value.includes("\\") || value.includes("..") || value.includes("//")) return null;
  if (/[\s?#]/.test(value)) return null;
  return value;
}

export function parsePushSubscription(
  body: unknown,
): { ok: true; value: PushSubscriptionInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_body" };
  const record = body as Record<string, unknown>;
  const endpoint = parseEndpoint(record.endpoint);
  if (!endpoint) return { ok: false, error: "invalid_endpoint" };
  const keys = record.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return { ok: false, error: "invalid_keys" };
  const keyRecord = keys as Record<string, unknown>;
  const p256dh = parseKey(keyRecord.p256dh);
  const auth = parseKey(keyRecord.auth);
  if (!p256dh || !auth) return { ok: false, error: "invalid_keys" };
  const teamIds = parseTeamIds(record.teamIds);
  if (!teamIds) return { ok: false, error: "invalid_team_ids" };
  const schedulePath = parseSchedulePath(record.schedulePath);
  if (!schedulePath) return { ok: false, error: "invalid_schedule_path" };
  return { ok: true, value: { endpoint, p256dh, auth, teamIds, schedulePath } };
}

export function parseUnsubscribe(body: unknown): { ok: true; endpoint: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid_body" };
  const endpoint = parseEndpoint((body as Record<string, unknown>).endpoint);
  if (!endpoint) return { ok: false, error: "invalid_endpoint" };
  return { ok: true, endpoint };
}

/** One row per subscription, and only rows watching at least one changed team. */
export function subscriptionsForTeamChange<T extends PushSubscriptionTarget>(
  subscriptions: T[],
  changedTeamIds: number[],
): T[] {
  const changed = new Set(changedTeamIds.filter((id) => Number.isInteger(id) && id > 0));
  if (changed.size === 0) return [];
  const seen = new Set<string>();
  const matches: T[] = [];
  for (const subscription of subscriptions) {
    if (seen.has(subscription.endpoint)) continue;
    if (!subscription.teamIds.some((id) => changed.has(id))) continue;
    seen.add(subscription.endpoint);
    matches.push(subscription);
  }
  return matches;
}

export function namesForChange(
  subscriptionTeamIds: number[],
  changedTeamIds: number[],
  namesById: ReadonlyMap<number, string>,
): string[] {
  const changed = new Set(changedTeamIds);
  const names: string[] = [];
  const seen = new Set<number>();
  for (const id of subscriptionTeamIds) {
    if (!changed.has(id) || seen.has(id)) continue;
    seen.add(id);
    const name = namesById.get(id)?.trim();
    if (name) names.push(name);
  }
  return names;
}

export function pushBodyForTeams(names: string[]): string {
  const labels = names.map((name) => name.trim()).filter(Boolean);
  if (labels.length === 0) return "יש עדכון בלוח האימונים";
  if (labels.length === 1) return `יש עדכון בלוח של ${labels[0]}`;
  return `יש עדכון בלוח של ${labels.join(" · ")}`;
}

export function pushPayload(
  names: string[],
  schedulePath: string,
  override?: { title?: string; body?: string; tag?: string },
) {
  const title = override?.title?.trim();
  const body = override?.body?.trim();
  const tag = override?.tag?.trim();
  return {
    title: title || PUSH_TITLE,
    body: body || pushBodyForTeams(names),
    tag: tag || PUSH_TAG,
    url: schedulePath || "/",
  };
}
