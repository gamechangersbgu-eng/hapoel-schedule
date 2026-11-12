import seedFile from "./data/cities-opponents-seed.json";
import { departureFor } from "../lib/game-rules";

/** Source of truth committed in db/data/cities-opponents-seed.json. */
export type SeedCity = {
  name: string;
  minutes: number;
  north: boolean;
  source: string;
};

export type SeedOpponent = {
  name: string;
  city: string;
};

export type CitiesOpponentsSeed = {
  cities: SeedCity[];
  opponents: SeedOpponent[];
};

export const citiesOpponentsSeed = seedFile as CitiesOpponentsSeed;

export type CityRow = {
  id: number;
  name: string;
  minutes: number;
  north: boolean;
};

export type OpponentRow = {
  id: number;
  name: string;
  cityId: number | null;
};

export type GameRow = {
  slotId: number;
  /** slots.type. Only away_game rows are filled. */
  type: string;
  opponent: string | null;
  cityId: number | null;
  departureTime: string | null;
  travelMinutes: number | null;
  date: string;
  kickoffTime: string | null;
  startTime: string | null;
  teamName: string;
};

export type FillState = {
  cities: CityRow[];
  opponents: OpponentRow[];
  games: GameRow[];
};

export type FillPlan = {
  insertCities: { name: string; minutes: number; north: boolean }[];
  insertOpponents: { name: string; cityName: string }[];
  setOpponentCity: { name: string; cityName: string }[];
  setGameCity: { slotId: number; cityName: string }[];
  setGameDeparture: { slotId: number; departureTime: string; travelMinutes: number }[];
  next: FillState;
};

/**
 * Departure clock plus the city's stored base minutes.
 * Matches saveGame / the IFA upsert: travel_minutes is the base driving time,
 * and departureFor adds the arrival buffer, the northern break, and midweek traffic.
 */
export function awayDeparture(opts: {
  teamName: string;
  date: string;
  kickoff: string;
  travelMinutes: number;
  north: boolean;
}) {
  return {
    departureTime: departureFor(opts).departure,
    travelMinutes: opts.travelMinutes,
  };
}

function copyState(state: FillState): FillState {
  return {
    cities: state.cities.map((row) => ({ ...row })),
    opponents: state.opponents.map((row) => ({ ...row })),
    games: state.games.map((row) => ({ ...row })),
  };
}

/**
 * Plan the cities seed.
 * Existing city minutes and north flags stay as stored.
 * A non-null opponent city_id is never replaced.
 * Home games are left alone. An away game keeps a city or a departure it already has.
 * Opponent and game names match character for character (quotes included).
 */
export function planCitiesOpponentsFill(state: FillState, seed: CitiesOpponentsSeed = citiesOpponentsSeed): FillPlan {
  const next = copyState(state);
  const cityByName = new Map(next.cities.map((row) => [row.name, row]));
  let nextCityId = next.cities.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  const insertCities: FillPlan["insertCities"] = [];

  for (const city of seed.cities) {
    if (cityByName.has(city.name)) continue;
    const row: CityRow = {
      id: nextCityId,
      name: city.name,
      minutes: city.minutes,
      north: city.north,
    };
    nextCityId += 1;
    next.cities.push(row);
    cityByName.set(row.name, row);
    insertCities.push({ name: row.name, minutes: row.minutes, north: row.north });
  }

  const opponentByName = new Map(next.opponents.map((row) => [row.name, row]));
  let nextOpponentId = next.opponents.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  const insertOpponents: FillPlan["insertOpponents"] = [];
  const setOpponentCity: FillPlan["setOpponentCity"] = [];

  for (const opponent of seed.opponents) {
    const city = cityByName.get(opponent.city);
    if (!city) {
      throw new Error(`Seed opponent has no city in the catalog: ${opponent.name} → ${opponent.city}`);
    }
    const existing = opponentByName.get(opponent.name);
    if (!existing) {
      const row: OpponentRow = { id: nextOpponentId, name: opponent.name, cityId: city.id };
      nextOpponentId += 1;
      next.opponents.push(row);
      opponentByName.set(row.name, row);
      insertOpponents.push({ name: row.name, cityName: city.name });
      continue;
    }
    if (existing.cityId == null) {
      existing.cityId = city.id;
      setOpponentCity.push({ name: existing.name, cityName: city.name });
    }
  }

  const cityById = new Map(next.cities.map((row) => [row.id, row]));
  const setGameCity: FillPlan["setGameCity"] = [];
  const setGameDeparture: FillPlan["setGameDeparture"] = [];

  for (const game of next.games) {
    if (game.type !== "away_game") continue;
    if (game.cityId == null && game.opponent) {
      const opponent = opponentByName.get(game.opponent);
      const city = opponent?.cityId != null ? cityById.get(opponent.cityId) : undefined;
      if (city) {
        game.cityId = city.id;
        setGameCity.push({ slotId: game.slotId, cityName: city.name });
      }
    }
    if (game.cityId == null || game.departureTime != null) continue;
    const city = cityById.get(game.cityId);
    const kickoff = game.kickoffTime || game.startTime;
    if (!city || !kickoff || !game.date) continue;
    const departure = awayDeparture({
      teamName: game.teamName,
      date: game.date,
      kickoff,
      travelMinutes: city.minutes,
      north: city.north,
    });
    game.departureTime = departure.departureTime;
    game.travelMinutes = departure.travelMinutes;
    setGameDeparture.push({
      slotId: game.slotId,
      departureTime: departure.departureTime,
      travelMinutes: departure.travelMinutes,
    });
  }

  return { insertCities, insertOpponents, setOpponentCity, setGameCity, setGameDeparture, next };
}
