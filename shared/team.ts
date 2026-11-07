export const TEAM_AGE_BAND_CODES = [
  "noar_through_yeladim_b",
  "yeladim_g_through_trum_g",
  "football_school",
] as const;

export type TeamAgeBandCode = (typeof TEAM_AGE_BAND_CODES)[number];

export type PlayerRef = {
  id: number;
  teamId: number;
  displayName: string;
  birthDate: string | null;
  parentPhone: string | null;
  isActive: boolean;
};

export const STAFF_UNAVAILABILITY_TYPES = [
  "vacation",
  "military_reserve",
  "event",
  "work",
  "other",
] as const;

export type StaffUnavailabilityType = (typeof STAFF_UNAVAILABILITY_TYPES)[number];

export type StaffMemberRef = {
  id: number;
  displayName: string;
  roleLabel: string | null;
  workWeekdays: number[];
};

export type StaffUnavailabilityRef = {
  staffId: number;
  startDate: string;
  endDate: string | null;
  type: StaffUnavailabilityType;
  note: string | null;
};

export type MedicRef = {
  id: number;
  name: string;
  phone: string | null;
};

export type DriverRef = {
  id: number;
  name: string;
  phone: string;
};
