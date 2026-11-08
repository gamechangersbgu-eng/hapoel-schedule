/**
 * The club's youth teams for 2026/27, copied from its page on the association's site:
 * https://www.football.org.il/clubs/club/?club_id=2171
 * Team ids change between seasons, so update this list and SEASON_ID every season.
 * The senior team (2171) is left out on purpose.
 */
export const SEASON_ID = 28;
export const CLUB_ID = 2171;
/** Sundays bounding the club's weekly game list for the season. */
export const SEASON_FIRST_WEEK = "2026-08-02";
export const SEASON_LAST_WEEK = "2027-06-27";
/** Competitions of the senior team, which is not part of this schedule. */
export const EXCLUDED_COMPETITIONS = ["ליגת WINNER"];

export type IfaTeam = {
  id: number;
  ageGroup: string;
  league: string;
  /** Exactly as written in the match rows. Used to tell home games from away games. */
  name: string;
};

export const TEAMS: IfaTeam[] = [
  { id: 2373, ageGroup: "נוער", league: "ליגת העל לנוער", name: `הפ' ב"ש השלושה` },
  { id: 2294, ageGroup: "נערים א", league: "נערים א' על", name: `הפועל ב"ש` },
  { id: 2085, ageGroup: "נערים ב", league: "נערים ב' על", name: `הפועל ב"ש` },
  { id: 2181, ageGroup: "נערים ג", league: "נערים ג' על", name: `הפועל באר שבע` },
  { id: 2756, ageGroup: "ילדים א", league: "ליגת ילדים א' מרכז", name: `הפועל ב"ש` },
  { id: 6485, ageGroup: "ילדים א", league: "ליגת ילדים א' דן", name: `הפ' באר שבע אדום "צו פיוס"` },
  { id: 2755, ageGroup: "ילדים ב", league: "ליגת ילדים ב' דן", name: `הפועל ב"ש אדום "צו פיוס"` },
  { id: 6248, ageGroup: "ילדים ב", league: "ליגת ילדים ב' מרכז", name: `הפועל ב"ש לבן` },
  { id: 2014, ageGroup: "ילדים ג", league: "ליגת ילדים ג' מרכז", name: `הפועל ב"ש "לבן"` },
  { id: 2143, ageGroup: "ילדים ג", league: "ליגת ילדים ג' דן", name: `הפועל ב"ש 2 "צו פיוס"` },
  { id: 1440, ageGroup: "טרום ילדים א", league: "ליגת ילדים טרום א' מרכז", name: `הפועל באר שבע` },
  { id: 7327, ageGroup: "טרום ילדים א", league: "ליגת ילדים טרום א' דן", name: `הפועל ב"ש 2 "צו פיוס"` },
  { id: 1443, ageGroup: "טרום ילדים ב", league: "ליגת ילדים טרום ב' מרכז", name: `הפועל באר שבע` },
  { id: 7449, ageGroup: "טרום ילדים ב", league: "ליגת ילדים טרום ב' שפלה", name: `הפועל ב"ש 2 "צו פיוס"` },
  { id: 1444, ageGroup: "טרום ילדים ג", league: "ליגת ילדים טרום ג' מרכז", name: `הפועל באר שבע "צו פיוס"` },
  { id: 7450, ageGroup: "טרום ילדים ג", league: "ליגת ילדים טרום ג' מרכז", name: `הפועל ב"ש אדום "צו פיוס"` },
];
