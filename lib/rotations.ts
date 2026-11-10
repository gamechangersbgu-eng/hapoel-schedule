// Load סבב 1–5 for the training forms. Seeds missing rows, and falls back to the
// built-in list so the buttons still show when the table is empty or unreachable.
import { asc } from "drizzle-orm";
import { ensureRotationTemplates, ensureTrainingDurations } from "@/db/reference-seed";
import {
  db,
  rotationTemplateTimes,
  rotationTemplates,
  trainingSessionDurations,
} from "@/lib/db";
import { DURATION_PRESETS, fallbackRotations, type BoardRotation } from "@/lib/pitch-rules";

export async function loadRotations(): Promise<BoardRotation[]> {
  try {
    await ensureRotationTemplates(db);
    const [rotationRows, timeRows] = await Promise.all([
      db.select().from(rotationTemplates).orderBy(asc(rotationTemplates.rotationNumber)),
      db.select().from(rotationTemplateTimes).orderBy(asc(rotationTemplateTimes.sequence)),
    ]);
    const rotations = rotationRows.map((rotation) => ({
      id: rotation.id,
      number: rotation.rotationNumber,
      label: rotation.labelHe,
      times: timeRows
        .filter((row) => row.rotationTemplateId === rotation.id)
        .map((row) => row.startTime),
    }));
    return rotations.length > 0 ? rotations : fallbackRotations();
  } catch (error) {
    console.error(
      "Could not load rotation templates:",
      error instanceof Error ? error.message : "unknown error",
    );
    return fallbackRotations();
  }
}

export async function loadDurations(): Promise<{ minutes: number; labelHe: string }[]> {
  try {
    await ensureTrainingDurations(db);
    const rows = await db
      .select()
      .from(trainingSessionDurations)
      .orderBy(asc(trainingSessionDurations.minutes));
    return rows.length > 0 ? rows : DURATION_PRESETS.map((row) => ({ ...row }));
  } catch (error) {
    console.error(
      "Could not load training durations:",
      error instanceof Error ? error.message : "unknown error",
    );
    return DURATION_PRESETS.map((row) => ({ ...row }));
  }
}
