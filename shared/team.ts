export const TEAM_AGE_BAND_CODES = [
  "noar_through_yeladim_b",
  "yeladim_g_through_trum_g",
  "football_school",
] as const;

export type TeamAgeBandCode = (typeof TEAM_AGE_BAND_CODES)[number];
