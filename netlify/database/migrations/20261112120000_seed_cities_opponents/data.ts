import { applyCitiesOpponentsSeed, type SqlExecutor } from "../../../../db/apply-cities-opponents-seed";

/** Invoked by db/apply-migrations.ts once, on the same connection as the SQL migrations. */
export async function apply(database: SqlExecutor) {
  const result = await applyCitiesOpponentsSeed(database);
  console.log(
    `Cities seed: ${result.citiesInserted} cities inserted, ${result.opponentsInserted} opponents inserted, ${result.opponentsLinked} opponents linked, ${result.gameCitiesFilled} game cities filled, ${result.departuresFilled} departures filled, revision ${result.revisionBumped ? "bumped" : "unchanged"}`,
  );
}
