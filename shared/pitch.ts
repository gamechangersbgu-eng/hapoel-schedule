export const PITCH_CODES = [
  "vasermil_1",
  "vasermil_2",
  "vasermil_3",
  "vasermil_4",
] as const;

export type PitchCode = (typeof PITCH_CODES)[number];

export const PITCH_SUBDIVISION_CODES = [
  "whole",
  "half_north",
  "half_south",
  "third_north",
  "third_center",
  "third_south",
  "quarter_north_1",
  "quarter_north_2",
  "quarter_south_1",
  "quarter_south_2",
] as const;

export type PitchSubdivisionCode = (typeof PITCH_SUBDIVISION_CODES)[number];

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
