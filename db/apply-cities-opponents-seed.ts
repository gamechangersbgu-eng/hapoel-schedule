import { sql, type SQL } from "drizzle-orm";
import {
  citiesOpponentsSeed,
  planCitiesOpponentsFill,
  type FillState,
  type GameRow,
} from "./cities-opponents-fill";

/** Same execute surface as the neon drizzle client used by db:migrate:apply. */
export type SqlExecutor = {
  execute: (query: SQL) => Promise<unknown>;
};

export type CitiesSeedResult = {
  citiesInserted: number;
  opponentsInserted: number;
  opponentsLinked: number;
  gameCitiesFilled: number;
  departuresFilled: number;
  revisionBumped: boolean;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as Record<string, unknown>[];
  }
  return [];
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function flag(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

async function readState(database: SqlExecutor): Promise<FillState> {
  const cityRows = rowsOf(await database.execute(sql`
    SELECT id, name, travel_minutes_from_beer_sheva AS minutes, north_of_hadera_line AS north
    FROM cities
  `));
  const opponentRows = rowsOf(await database.execute(sql`
    SELECT id, name, city_id
    FROM opponent_clubs
  `));
  const gameRows = rowsOf(await database.execute(sql`
    SELECT
      game.slot_id,
      slot.type AS slot_type,
      game.opponent,
      game.city_id,
      game.departure_time,
      game.travel_minutes,
      slot.date AS slot_date,
      game.kickoff_time,
      slot.start_time,
      team.name AS team_name
    FROM slot_game_details AS game
    INNER JOIN slots AS slot ON slot.id = game.slot_id
    INNER JOIN teams AS team ON team.id = slot.team_id
  `));

  const games: GameRow[] = [];
  for (const row of gameRows) {
    const slotId = num(row.slot_id);
    if (slotId == null) continue;
    games.push({
      slotId,
      type: text(row.slot_type) ?? "",
      opponent: text(row.opponent),
      cityId: num(row.city_id),
      departureTime: text(row.departure_time),
      travelMinutes: num(row.travel_minutes),
      date: text(row.slot_date) ?? "",
      kickoffTime: text(row.kickoff_time),
      startTime: text(row.start_time),
      teamName: text(row.team_name) ?? "",
    });
  }

  return {
    cities: cityRows.flatMap((row) => {
      const id = num(row.id);
      const name = text(row.name);
      const minutes = num(row.minutes);
      if (id == null || !name || minutes == null) return [];
      return [{ id, name, minutes, north: flag(row.north) }];
    }),
    opponents: opponentRows.flatMap((row) => {
      const id = num(row.id);
      const name = text(row.name);
      if (id == null || !name) return [];
      return [{ id, name, cityId: num(row.city_id) }];
    }),
    games,
  };
}

/**
 * Insert missing cities, link opponents that still have no city, fill away-game
 * cities, and compute departures with awayDeparture / departureFor.
 * A second call does not overwrite minutes, city ids, or departures already stored.
 */
export async function applyCitiesOpponentsSeed(database: SqlExecutor): Promise<CitiesSeedResult> {
  const plan = planCitiesOpponentsFill(await readState(database), citiesOpponentsSeed);
  const createdAt = new Date().toISOString();

  for (const city of plan.insertCities) {
    await database.execute(sql`
      INSERT INTO cities (name, travel_minutes_from_beer_sheva, north_of_hadera_line)
      SELECT ${city.name}, ${city.minutes}, ${city.north}
      WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = ${city.name})
    `);
  }

  for (const opponent of plan.insertOpponents) {
    await database.execute(sql`
      INSERT INTO opponent_clubs (name, city_id, created_at)
      SELECT ${opponent.name}, city.id, ${createdAt}
      FROM cities AS city
      WHERE city.name = ${opponent.cityName}
        AND NOT EXISTS (SELECT 1 FROM opponent_clubs WHERE name = ${opponent.name})
    `);
  }

  for (const opponent of plan.setOpponentCity) {
    await database.execute(sql`
      UPDATE opponent_clubs AS club
      SET city_id = city.id
      FROM cities AS city
      WHERE club.name = ${opponent.name}
        AND club.city_id IS NULL
        AND city.name = ${opponent.cityName}
    `);
  }

  for (const game of plan.setGameCity) {
    await database.execute(sql`
      UPDATE slot_game_details AS game
      SET city_id = city.id
      FROM slots AS slot, cities AS city
      WHERE game.slot_id = ${game.slotId}
        AND slot.id = game.slot_id
        AND slot.type = 'away_game'
        AND game.city_id IS NULL
        AND city.name = ${game.cityName}
    `);
  }

  for (const game of plan.setGameDeparture) {
    await database.execute(sql`
      UPDATE slot_game_details AS game
      SET departure_time = ${game.departureTime},
          travel_minutes = ${game.travelMinutes}
      FROM slots AS slot
      WHERE game.slot_id = ${game.slotId}
        AND slot.id = game.slot_id
        AND slot.type = 'away_game'
        AND game.city_id IS NOT NULL
        AND game.departure_time IS NULL
    `);
  }

  const revisionBumped = plan.setGameCity.length > 0 || plan.setGameDeparture.length > 0;
  if (revisionBumped) {
    const updatedAt = new Date().toISOString();
    await database.execute(sql`
      UPDATE schedule_revision
      SET version = version + 1, updated_at = ${updatedAt}
      WHERE id = 1
    `);
    await database.execute(sql`
      INSERT INTO schedule_revision (id, version, updated_at)
      SELECT 1, 1, ${updatedAt}
      WHERE NOT EXISTS (SELECT 1 FROM schedule_revision WHERE id = 1)
    `);
  }

  return {
    citiesInserted: plan.insertCities.length,
    opponentsInserted: plan.insertOpponents.length,
    opponentsLinked: plan.setOpponentCity.length,
    gameCitiesFilled: plan.setGameCity.length,
    departuresFilled: plan.setGameDeparture.length,
    revisionBumped,
  };
}
