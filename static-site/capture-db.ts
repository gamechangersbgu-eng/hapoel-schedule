/**
 * Read-only snapshot of the Postgres schedule for the GitHub Pages build.
 *
 * Selects settings, teams, and slots (plus the game/training fields the public
 * screens show). Does not insert, update, or delete. There is no demo-seed fallback:
 * if NETLIFY_DATABASE_URL / DATABASE_URL is missing, the build stops.
 */
import { writeFileSync } from "node:fs";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema/index";
import { SUBDIVISION_SHORT } from "../lib/pitch-rules";

const url =
  process.env.NETLIFY_DATABASE_URL?.trim() ||
  process.env.NETLIFY_DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!url) {
  console.error(
    "GitHub Pages snapshot requires NETLIFY_DATABASE_URL (or NETLIFY_DB_URL / DATABASE_URL) and only runs SELECT. Refusing to fall back to demo seed data.",
  );
  process.exit(1);
}

const out = process.argv[2];
if (!out) {
  console.error("Usage: tsx static-site/capture-db.ts <snapshot.json>");
  process.exit(1);
}

async function main() {
  const db = drizzle(url as string, { schema });

  const [settingsRows, teamRows, slotRows, people] = await Promise.all([
    db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1),
    db
      .select()
      .from(schema.teams)
      .orderBy(asc(schema.teams.sortOrder), asc(schema.teams.id)),
    db
      .select()
      .from(schema.slots)
      .orderBy(asc(schema.slots.date), asc(schema.slots.startTime), asc(schema.slots.id)),
    db.select({ id: schema.staff.id, name: schema.staff.displayName }).from(schema.staff),
  ]);

  const settings = settingsRows[0];
  if (!settings) {
    throw new Error("Postgres has no settings row. Refusing to invent club data.");
  }

  const substituteNames = new Map(people.map((person) => [person.id, person.name]));
  const ids = slotRows.map((slot) => slot.id);

  const trainingRows = ids.length
    ? await db
        .select()
        .from(schema.slotTrainingDetails)
        .where(inArray(schema.slotTrainingDetails.slotId, ids))
    : [];
  const gameRows = ids.length
    ? await db
        .select()
        .from(schema.slotGameDetails)
        .where(inArray(schema.slotGameDetails.slotId, ids))
    : [];

  const placeBySlot = new Map(
    trainingRows
      .filter((row) => row.subdivisionCode && row.subdivisionCode !== "whole")
      .map((row) => [row.slotId, SUBDIVISION_SHORT[row.subdivisionCode!] ?? null]),
  );
  const gameBySlot = new Map(gameRows.map((row) => [row.slotId, row]));

  const snapshot = {
    version: 1 as const,
    clubName: settings.clubName,
    seasonStartDate: settings.seasonStartDate,
    teams: teamRows.map((team) => ({
      id: team.id,
      name: team.name,
      sortOrder: team.sortOrder,
      isComments: team.isComments,
    })),
    slots: slotRows.map((slot) => {
      const game = gameBySlot.get(slot.id);
      return {
        id: slot.id,
        teamId: slot.teamId,
        date: slot.date,
        endDate: slot.endDate,
        startTime: slot.startTime,
        type: slot.type,
        note: slot.note,
        status: slot.status,
        statusNote: slot.statusNote,
        substituteName: slot.substituteStaffId
          ? (substituteNames.get(slot.substituteStaffId) ?? null)
          : null,
        place: placeBySlot.get(slot.id) ?? null,
        opponent: game?.opponent ?? null,
        departureTime: game?.departureTime ?? null,
      };
    }),
  };

  writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `Postgres snapshot: ${snapshot.teams.length} teams, ${snapshot.slots.length} slots (${gameRows.length} game rows, ${trainingRows.length} training rows) -> ${out}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
