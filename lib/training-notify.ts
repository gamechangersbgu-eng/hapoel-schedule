import { isTrainingScheduleType } from "@/lib/slot-types";

/** Form field the owner checks to push a training change to the team. */
export const NOTIFY_TEAM_FIELD = "notifyTeam";

/** Hebrew label on the training editor and on copy-week. */
export const NOTIFY_TEAM_LABEL = "שלח התראה לקבוצה";

/**
 * True only for an explicit opt-in.
 * An unchecked checkbox is omitted from FormData, so a missing value stays silent.
 */
export function teamNotificationRequested(value: unknown): boolean {
  return value === true || value === "1" || value === "on" || value === "true";
}

/**
 * A training create, update, or delete notifies only when the owner asked.
 * Games and other non-training writes keep notifying on every save.
 */
export function shouldNotifyTeams(input: { training: boolean; requested: boolean }): boolean {
  return input.training ? input.requested : true;
}

/** The weekly editor shows the opt-in when this save or a listed row is a training the owner may change. */
export function showTrainingNotifyToggle(input: {
  canScheduleTrainings: boolean;
  commentsRow: boolean;
  slotType: string;
  listedTypes?: readonly string[];
}): boolean {
  if (!input.canScheduleTrainings || input.commentsRow) return false;
  if (isTrainingScheduleType(input.slotType)) return true;
  return (input.listedTypes ?? []).some((type) => isTrainingScheduleType(type));
}
