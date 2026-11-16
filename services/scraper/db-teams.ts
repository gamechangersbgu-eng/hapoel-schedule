/**
 * Calendar row (`teams.name`) for each team on the association's site, by its team id.
 * The id stands for one name+league pair: several of our squads share an association
 * name and are told apart only by the league in `teams.ts`.
 *
 * `teams.name` is the short name from the first teams migration. From ילדים א through
 * טרום ג the public schedule shows "<group> <coach given name>" (ילדים א coached by
 * רמי is "ילדים א רמי"). `CALENDAR_ROW_ALIASES` accepts that label when it was stored
 * as the row name. נוער, נערים, ילדות, בית ספר, מ.קייץ and הערות keep their stored names.
 */
export const DB_TEAM_BY_IFA_TEAM: Record<number, string | null> = {
  // נוער — הפ' ב"ש השלושה, ליגת העל לנוער
  2373: "נוער",
  // נערים א — הפועל ב"ש, נערים א' על
  2294: "נערים א",
  // נערים ב — הפועל ב"ש, נערים ב' על
  2085: "נערים ב",
  // נערים ג — הפועל באר שבע, נערים ג' על
  2181: "נערים ג",
  // ילדים א רמי — הפועל ב"ש, ליגת ילדים א' מרכז
  2756: "ילדים א",
  // ילדים א שחר — הפ' באר שבע אדום "צו פיוס", ליגת ילדים א' דן
  6485: "ילדים א שחר",
  // ילדים ב חגי — הפועל ב"ש אדום "צו פיוס", ליגת ילדים ב' דן
  2755: "ילדים ב ל",
  // ילדים ב נועם — הפועל ב"ש לבן, ליגת ילדים ב' מרכז
  6248: "ילדים ב",
  // ילדים ג סטיב — הפועל ב"ש 2 "צו פיוס", ליגת ילדים ג' דן
  2143: "ילדים ג ל",
  // ילדים ג ניצן — הפועל ב"ש "לבן", ליגת ילדים ג' מרכז
  2014: "ילדים ג",
  // טרום א שחר — הפועל באר שבע, ליגת ילדים טרום א' מרכז
  // (the association's page for this team is מרכז, not דן)
  1440: "טרום א",
  // טרום א יותם — הפועל ב"ש 2 "צו פיוס", ליגת ילדים טרום א' דן
  7327: "טרום א ל",
  // טרום ב איתי — הפועל באר שבע, ליגת ילדים טרום ב' מרכז
  1443: "טרום ב",
  // טרום ב נריה — הפועל ב"ש 2 "צו פיוס", ליגת ילדים טרום ב' שפלה
  7449: "טרום ב ל",
  // טרום ג צחי — הפועל באר שבע "צו פיוס", ליגת ילדים טרום ג' מרכז
  1444: "טרום ג",
  // טרום ג עבדאללה — הפועל ב"ש אדום "צו פיוס", ליגת ילדים טרום ג' מרכז
  7450: "טרום ג עבדאללה",
  // ילדות א — הפועל בנות הבית האדום ב''ש, ליגת ילדות א' דרום
  8310: "ילדות א",
  // ילדות ב — הפועל בנות הבית האדום באר שבע, ליגת ילדות ב' דרום
  4479: "ילדות ב",
};

/**
 * Public label stored in place of the short `teams.name`.
 * Used only when the short name is not a row in the database.
 */
export const CALENDAR_ROW_ALIASES: Record<string, readonly string[]> = {
  "ילדים א": ["ילדים א רמי"],
  "ילדים ב": ["ילדים ב נועם"],
  "ילדים ב ל": ["ילדים ב חגי"],
  "ילדים ג": ["ילדים ג ניצן"],
  "ילדים ג ל": ["ילדים ג סטיב"],
  "טרום א": ["טרום א שחר"],
  "טרום א ל": ["טרום א יותם"],
  "טרום ב": ["טרום ב איתי"],
  "טרום ב ל": ["טרום ב נריה"],
  "טרום ג": ["טרום ג צחי"],
};

/** `teams.id` for a calendar row, accepting the coach label when that is what was stored. */
export function calendarTeamId(row: string, teamIds: Map<string, number>): number | undefined {
  const direct = teamIds.get(row);
  if (direct !== undefined) return direct;
  for (const alias of CALENDAR_ROW_ALIASES[row] ?? []) {
    const id = teamIds.get(alias);
    if (id !== undefined) return id;
  }
  return undefined;
}
