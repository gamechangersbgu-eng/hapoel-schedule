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
  2756: "ילדים א אדום",
  6485: null,
  2755: "ילדים ב אדום",
  6248: "ילדים ב לבן",
  2143: "ילדים ג אדום",
  2014: "ילדים ג לבן",
  1440: "טרום א אדום",
  7327: "טרום א לבן",
  1443: "טרום ב אדום",
  7449: "טרום ב לבן",
  1444: null,
  7450: null,
};
