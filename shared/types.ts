import type {
  ExternalEventType,
  PitchCode,
  PitchSubdivisionCode,
  SchedulingRuleKey,
  SlotKind,
  StaffUnavailabilityType,
  TeamAgeBandCode,
  TrainingDurationMinutes,
} from "./constants";

export type PitchRef = {
  code: PitchCode;
  nameHe: string;
  colorKey: string;
  surfaceType: "synthetic" | "natural";
  allowsHomeGames: boolean;
};

export type PitchSubdivisionRef = {
  code: PitchSubdivisionCode;
  labelHe: string;
};

export type RotationTemplateRef = {
  rotationNumber: number;
  weekday: number | null;
  startTimes: string[];
};

export type TeamAgeBandRef = {
  code: TeamAgeBandCode;
  labelHe: string;
  allowedSubdivisions: PitchSubdivisionCode[];
};

export type FootballSchoolRuleRef = {
  ruleKey: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  allowedSubdivisions: PitchSubdivisionCode[];
  biweekly: boolean;
};

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

export type TeamConstraintRef = {
  teamId: number;
  constraintType: string;
  coachNames: string | null;
  conflictingCoachNames: string | null;
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

export type CityRef = {
  id: number;
  name: string;
  travelMinutesFromBeerSheva: number;
  northOfHaderaLine: boolean;
};

export type SchedulingRuleRef = {
  ruleKey: SchedulingRuleKey;
  valueMinutes: number | null;
  valueText: string | null;
  labelHe: string;
};

export type SlotGameDetailsRef = {
  slotId: number;
  gameKind: Extract<SlotKind, "home_game" | "away_game">;
  opponent: string | null;
  pitchCode: PitchCode | null;
  medicId: number | null;
  driverId: number | null;
  cityId: number | null;
  kickoffTime: string | null;
  departureTime: string | null;
};

export type SlotTrainingDetailsRef = {
  slotId: number;
  pitchCode: PitchCode | null;
  subdivisionCode: PitchSubdivisionCode | null;
  durationMinutes: TrainingDurationMinutes | null;
  rotationNumber: number | null;
};

export type ExternalEventRef = {
  eventType: ExternalEventType;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  pitchCode: PitchCode | null;
};
