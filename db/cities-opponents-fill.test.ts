import assert from "node:assert/strict";
import test from "node:test";
import { departureFor, isMidweek } from "../lib/game-rules";
import { apply } from "../netlify/database/migrations/20261112120000_seed_cities_opponents/data";
import {
  citiesOpponentsSeed,
  planCitiesOpponentsFill,
  type FillState,
  type GameRow,
} from "./cities-opponents-fill";

const NORTH = ["חיפה", "סכנין", "קרית שמונה", "עתלית", "נוף הגליל", "נהלל", "גלבוע"];

function game(partial: Partial<GameRow> & Pick<GameRow, "slotId" | "type" | "opponent">): GameRow {
  return {
    cityId: null,
    departureTime: null,
    travelMinutes: null,
    date: "2026-11-14",
    kickoffTime: "16:00",
    startTime: "16:00",
    teamName: "ילדים א",
    ...partial,
  };
}

test("the seed has 43 cities and 209 opponents, and every opponent city is in the catalog", () => {
  const { cities, opponents } = citiesOpponentsSeed;
  assert.equal(cities.length, 43);
  assert.equal(new Set(cities.map((city) => city.name)).size, 43);
  assert.equal(opponents.length, 209);
  assert.equal(new Set(opponents.map((opponent) => opponent.name)).size, 209);

  const names = new Set(cities.map((city) => city.name));
  for (const opponent of opponents) {
    assert.equal(names.has(opponent.city), true, opponent.name);
    assert.equal(opponent.name.length > 0, true);
  }
  for (const city of cities) {
    assert.equal(Number.isInteger(city.minutes) && city.minutes > 0, true, city.name);
    assert.equal(typeof city.north, "boolean");
    assert.equal(city.source.length > 0, true, city.name);
  }

  assert.deepEqual(
    new Set(cities.filter((city) => city.north).map((city) => city.name)),
    new Set(NORTH),
  );
  for (const name of ["חדרה", "נתניה", "קדימה-צורן"]) {
    assert.equal(cities.find((city) => city.name === name)?.north, false);
  }
  assert.equal(cities.find((city) => city.name === "תל אביב")?.minutes, 69);
  assert.equal(cities.find((city) => city.name === "חיפה")?.minutes, 121);
  assert.equal(cities.find((city) => city.name === "באר שבע")?.minutes, 15);
  assert.equal(cities.find((city) => city.name === "חדרה")?.minutes, 98);
  assert.equal(cities.find((city) => city.name === "נתניה")?.minutes, 92);
  assert.equal(cities.find((city) => city.name === "סכנין")?.minutes, 140);
  assert.equal(opponents.find((opponent) => opponent.name === "הפ' מ.י. דרום \"צו פיוס\"")?.city, "פתח תקווה");
  assert.equal(opponents.find((opponent) => opponent.name === "בית\"ר טוברוק")?.city, "נתניה");
  assert.equal(opponents.find((opponent) => opponent.name === "מכבי יפו קביליו")?.city, "תל אביב");
  assert.equal(opponents.find((opponent) => opponent.name === "מ.כ. נוה יוסף")?.city, "חיפה");
  assert.equal(opponents.find((opponent) => opponent.name === "א.ס. רמת אליהו")?.city, "ראשון לציון");
  assert.equal(typeof apply, "function");
});

test("departureFor fills a midweek northern game and a weekend game, and a second apply changes nothing", () => {
  assert.equal(isMidweek("2026-11-12"), true);
  assert.equal(isMidweek("2026-11-14"), false);

  const storedHaifa = { travelMinutes: 50, north: false };
  const midweekNorth = departureFor({
    teamName: "נוער",
    date: "2026-11-12",
    kickoff: "18:00",
    travelMinutes: 115,
    north: true,
  });
  const weekend = departureFor({
    teamName: "ילדים א",
    date: "2026-11-14",
    kickoff: "16:00",
    travelMinutes: 69,
    north: false,
  });
  const storedMidweek = departureFor({
    teamName: "נוער",
    date: "2026-11-12",
    kickoff: "18:00",
    travelMinutes: storedHaifa.travelMinutes,
    north: storedHaifa.north,
  });
  assert.equal(midweekNorth.departure, "13:35");
  assert.equal(weekend.departure, "13:51");
  assert.equal(storedMidweek.departure, "15:10");

  const state: FillState = {
    cities: [
      { id: 7, name: "חיפה", minutes: storedHaifa.travelMinutes, north: storedHaifa.north },
      { id: 8, name: "תל אביב", minutes: 69, north: false },
    ],
    opponents: [
      { id: 3, name: "מכבי חיפה \"הרדי\"", cityId: 99 },
      { id: 4, name: "הפועל חיפה 1 ניר", cityId: null },
    ],
    games: [
      game({
        slotId: 10,
        type: "away_game",
        opponent: "הפועל חיפה 1 ניר",
        date: "2026-11-12",
        kickoffTime: "18:00",
        teamName: "נוער",
      }),
      game({
        slotId: 11,
        type: "home_game",
        opponent: "מכבי ת\"א",
        date: "2026-11-14",
      }),
      game({
        slotId: 12,
        type: "away_game",
        opponent: "מכבי ת\"א",
        date: "2026-11-14",
        kickoffTime: null,
        startTime: "16:00",
        teamName: "ילדים א",
      }),
      game({
        slotId: 13,
        type: "away_game",
        opponent: "מכבי נתניה",
        cityId: 7,
        departureTime: "08:15",
        travelMinutes: 10,
        date: "2026-11-14",
        teamName: "נוער",
      }),
      game({
        slotId: 14,
        type: "away_game",
        opponent: "מכבי עתלית \"צו פיוס\"",
        date: "2026-11-12",
        kickoffTime: "18:00",
        teamName: "נוער",
      }),
      game({
        slotId: 15,
        type: "away_game",
        opponent: "מכבי ת״א",
        date: "2026-11-14",
        teamName: "ילדים א",
      }),
    ],
  };

  const first = planCitiesOpponentsFill(state);
  assert.equal(first.insertCities.some((city) => city.name === "חיפה" || city.name === "תל אביב"), false);
  assert.equal(first.insertCities.find((city) => city.name === "עתלית")?.minutes, 115);
  assert.equal(first.insertCities.find((city) => city.name === "עתלית")?.north, true);
  assert.equal(first.next.cities.find((city) => city.name === "חיפה")?.minutes, 50);
  assert.equal(first.next.cities.find((city) => city.name === "חיפה")?.north, false);
  assert.equal(first.next.opponents.find((opponent) => opponent.id === 3)?.cityId, 99);
  assert.equal(first.setOpponentCity.some((opponent) => opponent.name === "מכבי חיפה \"הרדי\""), false);
  assert.deepEqual(
    first.setOpponentCity.find((opponent) => opponent.name === "הפועל חיפה 1 ניר"),
    { name: "הפועל חיפה 1 ניר", cityName: "חיפה" },
  );

  const bySlot = new Map(first.next.games.map((row) => [row.slotId, row]));
  assert.equal(bySlot.get(10)?.cityId, 7);
  assert.equal(bySlot.get(10)?.departureTime, storedMidweek.departure);
  assert.equal(bySlot.get(10)?.travelMinutes, 50);
  assert.equal(bySlot.get(11)?.cityId, null);
  assert.equal(bySlot.get(11)?.departureTime, null);
  assert.equal(bySlot.get(12)?.departureTime, weekend.departure);
  assert.equal(bySlot.get(12)?.travelMinutes, 69);
  assert.equal(bySlot.get(12)?.cityId, 8);
  assert.equal(bySlot.get(13)?.cityId, 7);
  assert.equal(bySlot.get(13)?.departureTime, "08:15");
  assert.equal(bySlot.get(13)?.travelMinutes, 10);
  assert.equal(bySlot.get(14)?.departureTime, midweekNorth.departure);
  assert.equal(bySlot.get(14)?.travelMinutes, 115);
  assert.equal(bySlot.get(15)?.cityId, null);
  assert.equal(bySlot.get(15)?.departureTime, null);
  assert.equal(first.setGameCity.some((row) => row.slotId === 11 || row.slotId === 13 || row.slotId === 15), false);
  assert.equal(first.setGameDeparture.some((row) => row.slotId === 11 || row.slotId === 13 || row.slotId === 15), false);

  const second = planCitiesOpponentsFill(first.next);
  assert.deepEqual(second.next, first.next);
  assert.deepEqual(second.insertCities, []);
  assert.deepEqual(second.insertOpponents, []);
  assert.deepEqual(second.setOpponentCity, []);
  assert.deepEqual(second.setGameCity, []);
  assert.deepEqual(second.setGameDeparture, []);
});
