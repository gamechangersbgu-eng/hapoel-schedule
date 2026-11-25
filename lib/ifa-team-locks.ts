import { eq } from "drizzle-orm";
import { db, ifaTeamLocks } from "@/lib/db";
import {
  ifaTeamIdFromExternalId,
  lockedTeamId,
  type IfaTeamLock,
} from "@/services/scraper/league-locks";

let cached: Promise<IfaTeamLock[]> | null = null;

/** Drop the process cache. Tests and a fresh import after a migration can call this. */
export function clearIfaTeamLockCache() {
  cached = null;
}

/**
 * Locked IFA team → calendar team. A missing table (migration not applied yet) is no
 * locks, so the code map is used. Any other database error still fails the import.
 */
export async function loadIfaTeamLocks(): Promise<IfaTeamLock[]> {
  if (!cached) {
    const pending = readLocks();
    cached = pending;
    pending.catch(() => {
      if (cached === pending) cached = null;
    });
  }
  return cached;
}

async function readLocks(): Promise<IfaTeamLock[]> {
  try {
    return await db
      .select({ ifaTeamId: ifaTeamLocks.ifaTeamId, teamId: ifaTeamLocks.teamId })
      .from(ifaTeamLocks)
      .where(eq(ifaTeamLocks.locked, true));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ifa_team_locks/i.test(message) && /does not exist|undefined_table|42P01/i.test(message)) {
      return [];
    }
    throw error;
  }
}

/** The team a scraped game must be written to. A lock replaces the planned team. */
export async function applyLeagueLock(externalId: string, teamId: number): Promise<number> {
  const ifaTeamId = ifaTeamIdFromExternalId(externalId);
  if (ifaTeamId == null) return teamId;
  const override = lockedTeamId(ifaTeamId, await loadIfaTeamLocks());
  return override ?? teamId;
}
