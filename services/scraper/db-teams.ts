/**
 * Calendar row (`teams.name`) for each team on the association's site, by its team id.
 * The club has more teams on the site than rows in the calendar, so null means the team
 * has no agreed row yet: its games are reported as skipped and never written.
 * This mapping is a proposal until Omer confirms it.
 */
export const DB_TEAM_BY_IFA_TEAM: Record<number, string | null> = {
  2373: "נוער",
  2294: "נערים א",
  2085: "נערים ב",
  2181: "נערים ג",
  2756: "ילדים א",
  6485: null,
  2755: "ילדים ב",
  6248: "ילדים ב ל",
  2143: "ילדים ג",
  2014: "ילדים ג ל",
  1440: "טרום א",
  7327: "טרום א ל",
  1443: "טרום ב",
  7449: "טרום ב ל",
  1444: null,
  7450: null,
};
