import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { cities, db, opponentClubs, slotGameDetails, slots, teams } from "@/lib/db";
import { departureFor } from "@/lib/game-rules";
import { matchCityInName } from "@/lib/opponent-city-match";

export async function listOpponentClubs() {
  return db.select().from(opponentClubs).orderBy(asc(opponentClubs.name));
}

/**
 * The stored mapping wins, including a row whose city was left empty on purpose.
 * A name we have never seen is matched against the cities and remembered.
 */
export async function cityForOpponent(name: string | null | undefined): Promise<number | null> {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  const [existing] = await db.select().from(opponentClubs).where(eq(opponentClubs.name, trimmed)).limit(1);
  if (existing) return existing.cityId;

  const cityRows = await db.select({ id: cities.id, name: cities.name }).from(cities);
  const matched = matchCityInName(trimmed, cityRows);
  const [created] = await db
    .insert(opponentClubs)
    .values({
      name: trimmed,
      cityId: matched?.id ?? null,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: opponentClubs.name })
    .returning();
  if (created) return created.cityId;
  const [again] = await db.select().from(opponentClubs).where(eq(opponentClubs.name, trimmed)).limit(1);
  return again?.cityId ?? null;
}

/** Remember a city an admin picked, without replacing a city that is already stored. */
export async function rememberOpponentCity(name: string | null | undefined, cityId: number | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || !cityId) return;
  const [existing] = await db.select().from(opponentClubs).where(eq(opponentClubs.name, trimmed)).limit(1);
  if (!existing) {
    await db
      .insert(opponentClubs)
      .values({ name: trimmed, cityId, createdAt: new Date().toISOString() })
      .onConflictDoNothing({ target: opponentClubs.name });
    return;
  }
  if (existing.cityId == null) {
    await db.update(opponentClubs).set({ cityId }).where(eq(opponentClubs.id, existing.id));
  }
}

/**
 * Save the mapping. Away games that still have no city, or still have the previous
 * mapped city, follow the new city. A game set to some other city is left alone.
 */
export async function saveOpponentMapping(input: { id?: number; name: string; cityId: number | null }) {
  const name = input.name.trim();
  if (!name) return { error: "יש למלא שם יריבה" as const };

  let previousCityId: number | null = null;
  let previousName = name;
  if (input.id) {
    const [row] = await db.select().from(opponentClubs).where(eq(opponentClubs.id, input.id)).limit(1);
    if (!row) return { error: "היריבה לא נמצאה" as const };
    previousCityId = row.cityId;
    previousName = row.name;
    await db.update(opponentClubs).set({ name, cityId: input.cityId }).where(eq(opponentClubs.id, input.id));
  } else {
    const [existing] = await db.select().from(opponentClubs).where(eq(opponentClubs.name, name)).limit(1);
    previousCityId = existing?.cityId ?? null;
    await db
      .insert(opponentClubs)
      .values({ name, cityId: input.cityId, createdAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: opponentClubs.name, set: { cityId: input.cityId } });
  }

  if (input.cityId && (input.cityId !== previousCityId || previousName !== name)) {
    await applyCityToAwayGames({
      names: [...new Set([previousName, name])],
      cityId: input.cityId,
      previousCityId,
    });
  }
  return { ok: true as const };
}

async function applyCityToAwayGames(input: { names: string[]; cityId: number; previousCityId: number | null }) {
  const [city] = await db.select().from(cities).where(eq(cities.id, input.cityId)).limit(1);
  if (!city) return;
  const cityFilter = input.previousCityId
    ? or(isNull(slotGameDetails.cityId), eq(slotGameDetails.cityId, input.previousCityId))
    : isNull(slotGameDetails.cityId);
  const games = await db
    .select({
      slotId: slotGameDetails.slotId,
      date: slots.date,
      kickoff: slotGameDetails.kickoffTime,
      startTime: slots.startTime,
      teamName: teams.name,
    })
    .from(slotGameDetails)
    .innerJoin(slots, eq(slots.id, slotGameDetails.slotId))
    .innerJoin(teams, eq(teams.id, slots.teamId))
    .where(and(eq(slots.type, "away_game"), inArrayOpponent(input.names), cityFilter));

  for (const game of games) {
    const kickoff = game.kickoff || game.startTime;
    const departure = kickoff
      ? departureFor({
          teamName: game.teamName,
          date: game.date,
          kickoff,
          travelMinutes: city.travelMinutesFromBeerSheva,
          north: city.northOfHaderaLine,
        }).departure
      : null;
    await db
      .update(slotGameDetails)
      .set({
        cityId: city.id,
        travelMinutes: city.travelMinutesFromBeerSheva,
        ...(departure ? { departureTime: departure } : {}),
      })
      .where(eq(slotGameDetails.slotId, game.slotId));
  }
}

function inArrayOpponent(names: string[]) {
  if (names.length === 1) return eq(slotGameDetails.opponent, names[0]);
  return or(...names.map((name) => eq(slotGameDetails.opponent, name)));
}
