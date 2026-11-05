/**
 * One-way sync: data/local.db → Postgres (Netlify Database).
 * Requires NETLIFY_DATABASE_URL or the env Netlify injects for drizzle-orm/netlify-db.
 *
 * Usage: npx tsx scripts/sync-local-sqlite.ts
 */
import { upsertIfaGame } from "../lib/ifa-game-upsert";
import { bumpScheduleRevision } from "../lib/schedule-revision";
import {
  type LocalGameDetailRow,
  type LocalSlotRow,
  openLocalSqliteBuffer,
} from "./sqlite-buffer";

async function main() {
  const sqlite = openLocalSqliteBuffer();
  const slotRows = sqlite
    .prepare(
      "SELECT id, team_id, date, end_date, start_time, type, note FROM slots ORDER BY id",
    )
    .all() as LocalSlotRow[];

  let synced = 0;

  for (const row of slotRows) {
    if (row.type !== "home_game" && row.type !== "away_game") {
      continue;
    }

    const detail = sqlite
      .prepare(
        "SELECT slot_id, game_kind, opponent, kickoff_time, source, external_id FROM slot_game_details WHERE slot_id = ?",
      )
      .get(row.id) as LocalGameDetailRow | undefined;

    const externalId =
      detail?.external_id?.trim() ||
      `local-${row.team_id}-${row.date}-${row.type}`;

    await upsertIfaGame(
      {
        teamId: row.team_id,
        date: row.date,
        startTime: row.start_time,
        gameKind: row.type,
        externalId,
        opponent: detail?.opponent ?? null,
        kickoffTime: detail?.kickoff_time ?? row.start_time,
        cityName: null,
        note: row.note,
      },
      { bumpRevision: false },
    );
    synced += 1;
  }

  if (synced === 0) {
    console.log("No home/away rows in SQLite; nothing synced.");
  } else {
    await bumpScheduleRevision();
    console.log(`Synced ${synced} game slot(s) from SQLite to Postgres.`);
  }

  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
