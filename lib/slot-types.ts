export const SLOT_TYPES = [
  { id: "vasermil_1", label: "וסרמיל 1", bg: "#7CB342", fg: "#fff" },
  { id: "vasermil_2", label: "וסרמיל 2", bg: "#FB8C00", fg: "#fff" },
  { id: "vasermil_3", label: "וסרמיל 3", bg: "#8E24AA", fg: "#fff" },
  { id: "vasermil_4", label: "וסרמיל 4", bg: "#212121", fg: "#fff" },
  { id: "home_game", label: "משחק בית", bg: "#C8102E", fg: "#fff" },
  { id: "away_game", label: "משחק חוץ", bg: "#4FC3F7", fg: "#123" },
  { id: "practice_game", label: "משחק אימון", bg: "#00695C", fg: "#fff" },
  // Coaches mark a day off in pink. Dark text keeps the label readable on the chip, the TV, and print.
  { id: "off", label: "חופש", bg: "#F48FB1", fg: "#1a1a1a" },
  { id: "camp", label: "מחנה אימון", bg: "#FDD835", fg: "#1a1a1a" },
  { id: "other", label: "אחר", bg: "#CFD8DC", fg: "#1a1a1a" },
] as const;

export type SlotTypeId = (typeof SLOT_TYPES)[number]["id"];

const PITCH_TYPES = new Set([
  "vasermil_1",
  "vasermil_2",
  "vasermil_3",
  "vasermil_4",
]);

export function getSlotType(id: string) {
  return SLOT_TYPES.find((item) => item.id === id) ?? SLOT_TYPES[SLOT_TYPES.length - 1];
}

export function isPitchSlot(type: string) {
  return PITCH_TYPES.has(type);
}

export function isPracticeGame(type: string) {
  return type === "practice_game";
}

export function isCampSlot(type: string) {
  return type === "camp";
}

/**
 * A training on the weekly plan: a Vasermil session, an off-site session ("אחר"), or a camp.
 * The comments row also uses "other" for a note; pass `commentsRow` so that note is not a training.
 * League games, practice games, and a day off ("חופש") are not trainings.
 */
export function isTrainingScheduleType(type: string, options?: { commentsRow?: boolean }) {
  if (options?.commentsRow) return false;
  return isPitchSlot(type) || type === "other" || type === "camp";
}

/** Types a manager may pick. Without training permission, pitch / off-site / camp are omitted. */
export function slotTypesForScheduler(canSchedule: boolean, commentsRow: boolean) {
  if (canSchedule) return SLOT_TYPES;
  return SLOT_TYPES.filter((item) => !isTrainingScheduleType(item.id, { commentsRow }));
}

/** New-cell default. Editing keeps the stored type. */
export function defaultSlotType(canSchedule: boolean, commentsRow: boolean, editingType?: string) {
  if (editingType) return editingType;
  if (commentsRow) return "other";
  return canSchedule ? "vasermil_1" : "off";
}
