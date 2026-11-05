import { eq } from "drizzle-orm";
import { db, scheduleRevision } from "@/lib/db";

const REVISION_ROW_ID = 1;

function nowIso() {
  return new Date().toISOString();
}

/** Current revision for clients polling `/api/schedule/revision`. */
export async function getScheduleRevision() {
  const [row] = await db
    .select()
    .from(scheduleRevision)
    .where(eq(scheduleRevision.id, REVISION_ROW_ID))
    .limit(1);

  if (!row) {
    return { version: 0, updatedAt: null as string | null };
  }

  return { version: row.version, updatedAt: row.updatedAt };
}

/** Call after any schedule write (admin, scraper, sqlite sync). */
export async function bumpScheduleRevision() {
  const updatedAt = nowIso();
  const [existing] = await db
    .select()
    .from(scheduleRevision)
    .where(eq(scheduleRevision.id, REVISION_ROW_ID))
    .limit(1);

  if (existing) {
    await db
      .update(scheduleRevision)
      .set({ version: existing.version + 1, updatedAt })
      .where(eq(scheduleRevision.id, REVISION_ROW_ID));
  } else {
    await db
      .insert(scheduleRevision)
      .values({ id: REVISION_ROW_ID, version: 1, updatedAt });
  }
}
