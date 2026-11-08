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
  roleLabel: string | null;
  teamIds: number[];
  workDays: number[];
  absences: { id: number; type: string; startDate: string; endDate: string | null; note: string | null }[];
};

/** Absence covering a date, if any. */
export function absenceOn(coach: CoachInfo, date: string) {
  return coach.absences.find((item) => item.startDate <= date && (item.endDate ?? item.startDate) >= date);
}
