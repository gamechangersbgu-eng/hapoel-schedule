import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { toCsv } from "./csv";
import type { ScrapeOutput } from "./types";

export function hasFailures(output: ScrapeOutput): boolean {
  return output.failedWeeks.length > 0 || output.teams.some((team) => team.status === "failed");
}

async function replaceFile(file: string, content: string): Promise<void> {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, file);
}

/**
 * Writes games.json and games.csv only after a fully successful run, so a blocked or
 * partial run can never replace good data with missing games. Returns whether it saved.
 */
export async function saveResults(output: ScrapeOutput, directory: string): Promise<boolean> {
  if (hasFailures(output)) return false;
  await mkdir(directory, { recursive: true });
  await replaceFile(path.join(directory, "games.json"), `${JSON.stringify(output, null, 2)}\n`);
  await replaceFile(path.join(directory, "games.csv"), toCsv(output.games));
  return true;
}
