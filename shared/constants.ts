/** Shared codes aligned with `db/schema.ts` lookup tables. */

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

export const TEAM_AGE_BAND_CODES = [
  "noar_through_yeladim_b",
  "yeladim_g_through_trum_g",
  "football_school",
] as const;

export type TeamAgeBandCode = (typeof TEAM_AGE_BAND_CODES)[number];

export const TRAINING_DURATION_MINUTES = [60, 105, 120] as const;

export type TrainingDurationMinutes = (typeof TRAINING_DURATION_MINUTES)[number];

export const SLOT_KINDS = [
  "training",
  "home_game",
  "away_game",
  "off",
  "camp",
  "other",
] as const;

export type SlotKind = (typeof SLOT_KINDS)[number];

export const STAFF_UNAVAILABILITY_TYPES = [
  "vacation",
  "military_reserve",
  "event",
  "work",
  "other",
] as const;

export type StaffUnavailabilityType = (typeof STAFF_UNAVAILABILITY_TYPES)[number];

export const SCHEDULING_RULE_KEYS = [
  "home_games_min_gap_minutes",
  "arrival_before_whistle_youth_minutes",
  "arrival_before_whistle_juniors_minutes",
  "north_of_hadera_extra_minutes",
  "weekday_traffic_buffer_minutes",
  "reminder_match_forms_before_whistle_minutes",
  "reminder_youth_ambulance_before_minutes",
  "reminder_youth_security_before_minutes",
] as const;

export type SchedulingRuleKey = (typeof SCHEDULING_RULE_KEYS)[number];

export const EXTERNAL_EVENT_TYPES = [
  "external_activity",
  "driver_assignment",
  "medic_assignment",
] as const;

export type ExternalEventType = (typeof EXTERNAL_EVENT_TYPES)[number];
