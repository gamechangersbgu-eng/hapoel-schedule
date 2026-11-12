import "server-only";

// Parent/player web push for the public "הקבוצות שלי" bells.
// Coach and management WhatsApp/SMS stay a separate track (services/notifications, lib/update-recipients.ts).
import { eq, inArray } from "drizzle-orm";
import { db, pushSubscriptions, teams } from "@/lib/db";
import {
  namesForChange,
  parseSchedulePath,
  pushPayload,
  subscriptionGone,
  subscriptionsForTeamChange,
  type PushSubscriptionInput,
} from "@/lib/push-subscription";
import { vapidSenderConfig } from "@/lib/vapid";

type WebPushModule = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ) => Promise<unknown>;
};

function userAgentOf(value: string | null): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 300);
}

function positiveIds(teamIds: number[]) {
  return [...new Set(teamIds.filter((id) => Number.isInteger(id) && id > 0))];
}

function teamIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return positiveIds(
    value.map((id) => (typeof id === "number" ? id : typeof id === "string" && /^\d+$/.test(id) ? Number(id) : 0)),
  );
}

async function loadWebPush(): Promise<WebPushModule> {
  const loaded = await import("web-push");
  return {
    setVapidDetails: loaded.setVapidDetails,
    sendNotification: loaded.sendNotification,
  };
}

export async function upsertPushSubscription(input: PushSubscriptionInput, userAgent: string | null) {
  const updatedAt = new Date().toISOString();
  const row = {
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    teamIds: input.teamIds,
    schedulePath: input.schedulePath,
    userAgent: userAgentOf(userAgent),
    updatedAt,
  };
  await db
    .insert(pushSubscriptions)
    .values(row)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: row.p256dh,
        auth: row.auth,
        teamIds: row.teamIds,
        schedulePath: row.schedulePath,
        userAgent: row.userAgent,
        updatedAt: row.updatedAt,
      },
    });
}

export async function deletePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * One Hebrew notification per matching subscription. Failures are logged and swallowed
 * so an admin save still keeps the schedule change. Missing VAPID keys skip the send.
 */
export async function notifyTeamsScheduleChanged(teamIds: number[]) {
  try {
    await deliverSchedulePush(positiveIds(teamIds));
  } catch {
    console.error("[web-push] send failed");
  }
}

async function deliverSchedulePush(teamIds: number[]) {
  if (teamIds.length === 0) return;
  const vapid = vapidSenderConfig();
  if (!vapid) {
    console.warn("[web-push] VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT is unset; skipping send");
    return;
  }

  const rows = await db.select().from(pushSubscriptions);
  const targets = subscriptionsForTeamChange(
    rows.map((row) => ({
      endpoint: row.endpoint,
      teamIds: teamIdList(row.teamIds),
      p256dh: row.p256dh,
      auth: row.auth,
      schedulePath: row.schedulePath,
    })),
    teamIds,
  );
  if (targets.length === 0) return;

  const nameRows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, teamIds));
  const namesById = new Map(nameRows.map((row) => [row.id, row.name]));

  const webpush = await loadWebPush();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  await Promise.all(
    targets.map(async (target) => {
      const schedulePath = parseSchedulePath(target.schedulePath) ?? "/";
      const payload = JSON.stringify(
        pushPayload(namesForChange(target.teamIds, teamIds, namesById), schedulePath),
      );
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;
        if (subscriptionGone(statusCode)) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, target.endpoint));
          return;
        }
        console.error("[web-push] delivery failed", Number.isFinite(statusCode) ? statusCode : "unknown");
      }
    }),
  );
}
