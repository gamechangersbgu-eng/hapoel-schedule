import { writeFile } from "node:fs/promises";
import path from "node:path";
import { DB_TEAM_BY_IFA_TEAM } from "./db-teams";
import { saveResults } from "./save";
import { scrapeAll } from "./scrape";
import { planWrites, writeRows } from "./write";

const OUTPUT_DIRECTORY = path.join(process.cwd(), "services", "scraper", "out");
const WRITE_TO_DATABASE = process.argv.includes("--write");

async function main() {
  const output = await scrapeAll();

  for (const team of output.teams) {
    const detail = team.status === "ok" ? `${team.games} games` : `FAILED: ${team.error}`;
    console.log(`${String(team.teamId).padEnd(5)} ${team.ageGroup.padEnd(14)} ${detail}`);
  }
  const noSide = output.games.filter((game) => game.isHome === null);
  if (noSide.length > 0) {
    console.warn(`${noSide.length} games could not be marked home or away: check names in teams.ts`);
  }
  const cups = output.games.filter((game) => game.round !== null).length;
  console.log(`\n${cups} cup games`);
  for (const { week, error } of output.failedWeeks) console.log(`week ${week} FAILED: ${error}`);
  for (const game of output.unmatched) {
    console.log(`not assigned to a team: ${game.date} | ${game.competition} | ${game.title}`);
  }

  if (!(await saveResults(output, OUTPUT_DIRECTORY))) {
    console.error("\nThe run had failures: files and database were left unchanged.");
    process.exitCode = 1;
    return;
  }
  console.log(`\n${output.games.length} games saved to ${OUTPUT_DIRECTORY}`);

  if (WRITE_TO_DATABASE) {
    const { loadDatabase } = await import("./db-writer");
    const { teamIds, cityNames, writer } = await loadDatabase();
    const plan = planWrites(output.games, teamIds, cityNames);
    const written = await writeRows(plan.rows, writer);
    console.log(`${written} games written to the database, ${plan.skipped.length} skipped`);
    return;
  }

  // A dry run needs no database: it only shows what a real write would do.
  const rowNames = Object.values(DB_TEAM_BY_IFA_TEAM).filter((name) => name !== null);
  const plan = planWrites(output.games, new Map(rowNames.map((name) => [name, 0])), []);
  const planFile = path.join(OUTPUT_DIRECTORY, "db-plan.json");
  await writeFile(planFile, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  console.log(`DRY RUN, nothing written: ${plan.rows.length} games planned, ${plan.skipped.length} skipped`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
