import type { PitchCode, PitchSubdivisionCode } from "./pitch";
import type { TeamAgeBandCode } from "./team";

export const TRAINING_DURATION_MINUTES = [60, 105, 120] as const;

export type TrainingDurationMinutes = (typeof TRAINING_DURATION_MINUTES)[number];

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

export type SlotTrainingDetailsRef = {
  slotId: number;
  pitchCode: PitchCode | null;
  subdivisionCode: PitchSubdivisionCode | null;
  durationMinutes: TrainingDurationMinutes | null;
  rotationNumber: number | null;
};
