import { eq, inArray, like } from "drizzle-orm";
import { loadDatabaseUrl } from "./env";

/**
 * One-off cleanup approved by Omer: deletes the synthetic games of `npm run db:seed`, which
 * the seed marks with an external_id starting with "demo-". Practices and real games stay.
 * Lists what it would delete unless run with --confirm.
 */
async function main() {
  loadDatabaseUrl();
  const { db, slotGameDetails, slots } = await import("@/lib/db");
  const { bumpScheduleRevision } = await import("@/lib/schedule-revision");

  const demo = await db
    .select({
      slotId: slotGameDetails.slotId,
      externalId: slotGameDetails.externalId,
      opponent: slotGameDetails.opponent,
      date: slots.date,
    })
    .from(slotGameDetails)
    .innerJoin(slots, eq(slots.id, slotGameDetails.slotId))
    .where(like(slotGameDetails.externalId, "demo-%"));

  for (const game of demo) console.log(`${game.date}  ${game.opponent ?? ""}  (${game.externalId})`);
  console.log(`\n${demo.length} demo games found`);

  if (!process.argv.includes("--confirm")) {
    console.log("Nothing deleted. Run again with --confirm to delete them.");
    return;
  }
  if (demo.length === 0) return;
  // Deleting the slot removes its game details too (on delete cascade).
  await db.delete(slots).where(inArray(slots.id, demo.map((game) => game.slotId)));
  await bumpScheduleRevision();
  console.log(`${demo.length} demo games deleted`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
