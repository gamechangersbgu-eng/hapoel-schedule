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
import { SUBDIVISION_SHORT, trainingEndClock } from "../lib/pitch-rules";
import { applyCoachLabels, coachFullNameByTeam } from "../lib/team-labels";

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

  const [settingsRows, teamRows, slotRows, people, coachLinks] = await Promise.all([
    db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1),
    db
      .select()
      .from(schema.teams)
      .orderBy(asc(schema.teams.sortOrder), asc(schema.teams.id)),
    db
      .select()
      .from(schema.slots)
      .orderBy(asc(schema.slots.date), asc(schema.slots.startTime), asc(schema.slots.id)),
    db
      .select({
        id: schema.staff.id,
        name: schema.staff.displayName,
        receivesAllUpdates: schema.staff.receivesAllUpdates,
      })
      .from(schema.staff),
    db
      .select({
        teamId: schema.teamCoaches.teamId,
        staffId: schema.teamCoaches.staffId,
        coachName: schema.teamCoaches.coachName,
        isPrimary: schema.teamCoaches.isPrimary,
      })
      .from(schema.teamCoaches),
  ]);

  const settings = settingsRows[0];
  if (!settings) {
    throw new Error("Postgres has no settings row. Refusing to invent club data.");
  }

  const substituteNames = new Map(people.map((person) => [person.id, person.name]));
  const fieldPeople = people.filter((person) => !person.receivesAllUpdates);
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
  const trainingBySlot = new Map(trainingRows.map((row) => [row.slotId, row]));
  const gameBySlot = new Map(gameRows.map((row) => [row.slotId, row]));

  const snapshot = {
    version: 1 as const,
    clubName: settings.clubName,
    seasonStartDate: settings.seasonStartDate,
    teams: applyCoachLabels(
      teamRows.map((team) => ({
        id: team.id,
        name: team.name,
        sortOrder: team.sortOrder,
        isComments: team.isComments,
      })),
      coachFullNameByTeam(
        coachLinks.filter((link) => link.staffId == null || fieldPeople.some((person) => person.id === link.staffId)),
        fieldPeople,
      ),
    ),
    slots: slotRows.map((slot) => {
      const game = gameBySlot.get(slot.id);
      const durationMinutes = trainingBySlot.get(slot.id)?.durationMinutes ?? null;
      const endTime = trainingEndClock(slot.startTime, durationMinutes);
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
        durationMinutes,
        endTime,
        opponent: game?.opponent ?? null,
        departureTime: game?.departureTime ?? null,
      };
    }),
  };

  const serialized = JSON.stringify(snapshot, null, 2);
  if (serialized.includes('"nationalId"') || serialized.includes('"national_id"')) {
    throw new Error("Public snapshot must not include national id numbers.");
  }
  writeFileSync(out, `${serialized}\n`);
  console.log(
    `Postgres snapshot: ${snapshot.teams.length} teams, ${snapshot.slots.length} slots (${gameRows.length} game rows, ${trainingRows.length} training rows) -> ${out}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
