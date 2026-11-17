// Coaches: who coaches which team, work days and absences. Shared labels + a loader.
export const ABSENCE_TYPES = [
  { id: "vacation", label: "חופש" },
  { id: "reserve", label: "מילואים" },
  { id: "event", label: "אירוע" },
  { id: "work", label: "עבודה" },
  { id: "other", label: "אחר" },
] as const;

export function absenceLabel(id: string) {
  return ABSENCE_TYPES.find((item) => item.id === id)?.label ?? "היעדרות";
}

export const WEEKDAY_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export type CoachInfo = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  roleLabel: string | null;
  /** Management contacts are told about every team, not only the teams they coach. */
  receivesAllUpdates: boolean;
  teamIds: number[];
  /** Teams (also in teamIds) where this person is an assistant coach, not the head coach. */
  assistantTeamIds?: number[];
  workDays: number[];
  absences: { id: number; type: string; startDate: string; endDate: string | null; note: string | null }[];
};

/** "מאמן: דנה · עוזר מאמן: מיכל", or null when nobody is linked to the team. */
export function teamCoachSummary(coaches: CoachInfo[], teamId: number) {
  const linked = coaches.filter((coach) => coach.teamIds.includes(teamId));
  if (linked.length === 0) return null;
  const heads = linked.filter((coach) => !coach.assistantTeamIds?.includes(teamId)).map((coach) => coach.name);
  const assistants = linked.filter((coach) => coach.assistantTeamIds?.includes(teamId)).map((coach) => coach.name);
  const parts = [];
  if (heads.length) parts.push(`מאמן: ${heads.join(", ")}`);
  if (assistants.length) parts.push(`עוזר מאמן: ${assistants.join(", ")}`);
  return parts.join(" · ");
}

/** Absence covering a date, if any. */
export function absenceOn(coach: CoachInfo, date: string) {
  return coach.absences.find((item) => item.startDate <= date && (item.endDate ?? item.startDate) >= date);
}
