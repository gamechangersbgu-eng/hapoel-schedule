import { and, eq } from "drizzle-orm";
import { cities, db, slotGameDetails, slots } from "@/lib/db";
import { bumpScheduleRevision } from "@/lib/schedule-revision";
import {
  GAME_DETAIL_SOURCES,
  type IfaGameUpsert,
} from "@/shared/game";

/**
 * Idempotent IFA scraper write: `slots` + `slot_game_details` by (source, external_id).
 * Resolves `cityName` to `cities.id` when a row exists (optional).
 */
export async function upsertIfaGame(
  input: IfaGameUpsert,
  options?: { bumpRevision?: boolean },
) {
  const bumpRevision = options?.bumpRevision !== false;
  const source = GAME_DETAIL_SOURCES.IFA_SCRAPER;
  const type = input.gameKind;

  const [byExternal] = await db
    .select({ slotId: slotGameDetails.slotId })
    .from(slotGameDetails)
    .where(
      and(
        eq(slotGameDetails.source, source),
        eq(slotGameDetails.externalId, input.externalId),
      ),
    )
    .limit(1);

  const slotPayload = {
    teamId: input.teamId,
    date: input.date,
    endDate: null as string | null,
    startTime: input.startTime,
    type,
    note: input.note?.trim() || null,
  };

  let slotId: number;

  if (byExternal) {
    slotId = byExternal.slotId;
    await db.update(slots).set(slotPayload).where(eq(slots.id, slotId));
  } else {
    const [inserted] = await db.insert(slots).values(slotPayload).returning({ id: slots.id });
    if (!inserted) {
      throw new Error("Failed to insert slot for IFA game");
    }
    slotId = inserted.id;
  }

  let cityId: number | null = null;
  if (input.cityName?.trim()) {
    const [city] = await db
      .select({ id: cities.id })
      .from(cities)
      .where(eq(cities.name, input.cityName.trim()))
      .limit(1);
    cityId = city?.id ?? null;
  }

  const detailPayload = {
    gameKind: input.gameKind,
    opponent: input.opponent,
    kickoffTime: input.kickoffTime,
    cityId,
    source,
    externalId: input.externalId,
  };

  await db
    .insert(slotGameDetails)
    .values({ slotId, ...detailPayload })
    .onConflictDoUpdate({
      target: slotGameDetails.slotId,
      set: detailPayload,
    });

  if (bumpRevision) {
    await bumpScheduleRevision();
  }
  return { slotId };
}
