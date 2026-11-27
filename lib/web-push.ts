import "server-only";

// Parent/player web push for the public "הקבוצות שלי" bells.
// Coach and management WhatsApp/SMS stay a separate track (services/notifications, lib/update-recipients.ts).
import { eq, inArray } from "drizzle-orm";
import { db, pushSubscriptions, teams } from "@/lib/db";
import {
  COACH_UPDATE_PUSH_TAG,
  namesForChange,
  parseSchedulePath,
  pushPayload,
  subscriptionGone,
  subscriptionsForTeamChange,
  type PushSubscriptionInput,
} from "@/lib/push-subscription";
import type { CoachPushCounts } from "@/lib/game-logistics";
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

export type SchedulePushResult = CoachPushCounts;

const EMPTY_PUSH: SchedulePushResult = { subscribers: 0, sent: 0, failed: 0, skipped: null };

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

/**
 * Logistics note for one team (medic, driver, departure). Same subscribers as a schedule
 * change. Returns how many browsers were notified so the games screen can say so.
 */
export async function notifyTeamCoachUpdate(
  teamId: number,
  message: { title: string; body: string },
): Promise<SchedulePushResult> {
  try {
    return await deliverSchedulePush(positiveIds([teamId]), {
      title: message.title,
      body: message.body,
      tag: COACH_UPDATE_PUSH_TAG,
    });
  } catch {
    console.error("[web-push] coach update failed");
    return { ...EMPTY_PUSH, skipped: "error" };
  }
}

async function deliverSchedulePush(
  teamIds: number[],
  override?: { title?: string; body?: string; tag?: string },
): Promise<SchedulePushResult> {
  if (teamIds.length === 0) return { ...EMPTY_PUSH, skipped: "no_teams" };
  const vapid = vapidSenderConfig();
  if (!vapid) {
    console.warn("[web-push] VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or VAPID_SUBJECT is unset; skipping send");
    return { ...EMPTY_PUSH, skipped: "no_vapid" };
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
  if (targets.length === 0) return { ...EMPTY_PUSH, skipped: "no_subscribers" };

  const customBody = Boolean(override?.body?.trim());
  const namesById = new Map<number, string>();
  if (!customBody) {
    const nameRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, teamIds));
    for (const row of nameRows) namesById.set(row.id, row.name);
  }

  const webpush = await loadWebPush();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  let sent = 0;
  let failed = 0;
  await Promise.all(
    targets.map(async (target) => {
      const schedulePath = parseSchedulePath(target.schedulePath) ?? "/";
      const payload = JSON.stringify(
        pushPayload(
          customBody ? [] : namesForChange(target.teamIds, teamIds, namesById),
          schedulePath,
          override,
        ),
      );
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
        );
        sent += 1;
      } catch (error) {
        failed += 1;
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
  return { subscribers: targets.length, sent, failed, skipped: null };
}
