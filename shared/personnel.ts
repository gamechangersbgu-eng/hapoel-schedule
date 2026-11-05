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
