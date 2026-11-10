import { cities, db, teams } from "@/lib/db";
import { upsertIfaGame } from "@/lib/ifa-game-upsert";
import { bumpScheduleRevision } from "@/lib/schedule-revision";
import type { GameWriter } from "./write";

/** Loaded only for a real write, because importing the database needs its connection settings. */
export async function loadDatabase() {
  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const cityRows = await db.select({ name: cities.name }).from(cities);
  const writer: GameWriter = {
    upsert: (row) => upsertIfaGame(row, { bumpRevision: false }),
    bumpRevision: bumpScheduleRevision,
  };
  return {
    teamIds: new Map(teamRows.map((team) => [team.name, team.id])),
    cityNames: cityRows.map((city) => city.name),
    writer,
  };
}
