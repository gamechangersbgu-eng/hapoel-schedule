import "server-only";
import { db, scheduleChanges } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

export type ChangeAction =
  | "create"
  | "update"
  | "delete"
  | "cancel"
  | "copy_week"
  | "lock"
  | "bank"
  | "coach"
  | "game"
  | "maintenance"
  | "room";

/** Records a change with the signed-in manager's name. Never blocks the change itself. */
export async function logChange(entry: {
  action: ChangeAction;
  summary: string;
  teamId?: number | null;
  slotId?: number | null;
  date?: string | null;
  /** Automatic change (not an admin's click): recorded as "מערכת" even while an admin is signed in. */
  bySystem?: boolean;
}) {
  try {
    const user = entry.bySystem ? null : await getCurrentAdmin();
    await db.insert(scheduleChanges).values({
      at: new Date().toISOString(),
      adminUserId: user?.id ?? null,
      adminName: user?.displayName ?? "מערכת",
      action: entry.action,
      summary: entry.summary,
      teamId: entry.teamId ?? null,
      slotId: entry.slotId ?? null,
      date: entry.date ?? null,
    });
  } catch (error) {
    console.error("Could not record the change in history", error);
  }
}

export function formatDateHe(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}
