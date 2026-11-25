/**
 * Age groups from ילדים א through טרום ג are shown as "<group> <coach given name>".
 * The stored team name (and its id) stay as they are, so schedule rows and the
 * association scraper keep pointing at the same calendar row.
 */

const COACH_LABELED_GROUPS = ["טרום ג", "טרום ב", "טרום א", "ילדים ג", "ילדים ב", "ילדים א"] as const;

/** Shown everywhere instead of the stored בית ספר names. The row id and age-band code stay. */
export const ACADEMY_DISPLAY_NAME = "אקדמיה לכדורגל";

const ACADEMY_STORED_NAMES = new Set([
  "אקדמיה לכדורגל",
  "בית ספר לכדורגל",
  "בית הספר לכדורגל",
  "בית ספר",
]);

/** Oldest age group first. Unknown names sort after the known groups and before notes. */
const AGE_GROUP_RANKS: { prefix: string; rank: number }[] = [
  { prefix: "בוגרים", rank: 0 },
  { prefix: "נוער", rank: 10 },
  { prefix: "נערים א", rank: 20 },
  { prefix: "נערים ב", rank: 21 },
  { prefix: "נערים ג", rank: 22 },
  { prefix: "נערים", rank: 23 },
  { prefix: "ילדים א", rank: 30 },
  { prefix: "ילדים ב", rank: 31 },
  { prefix: "ילדים ג", rank: 32 },
  { prefix: "ילדים", rank: 33 },
  { prefix: "טרום א", rank: 40 },
  { prefix: "טרום ב", rank: 41 },
  { prefix: "טרום ג", rank: 42 },
  { prefix: "טרום", rank: 43 },
  { prefix: "ילדות א", rank: 50 },
  { prefix: "ילדות ב", rank: 51 },
  { prefix: "ילדות", rank: 52 },
  { prefix: "טרומיות", rank: 53 },
  { prefix: ACADEMY_DISPLAY_NAME, rank: 60 },
  { prefix: "בית הספר לכדורגל", rank: 60 },
  { prefix: "בית ספר לכדורגל", rank: 60 },
  { prefix: "בית ספר", rank: 60 },
  { prefix: "מ.קייץ", rank: 70 },
];

export function isAcademyName(name: string) {
  return ACADEMY_STORED_NAMES.has(name.trim().replace(/\s+/g, " "));
}

/** Lower rank is older. Comments always come last. */
export function ageGroupRank(name: string, isComments = false) {
  if (isComments) return 100;
  const normalized = name.trim().replace(/\s+/g, " ");
  let best = 80;
  let bestLength = 0;
  for (const group of AGE_GROUP_RANKS) {
    const matches = normalized === group.prefix || normalized.startsWith(`${group.prefix} `);
    if (matches && group.prefix.length > bestLength) {
      best = group.rank;
      bestLength = group.prefix.length;
    }
  }
  return best;
}

export function compareTeamsByAge<T extends { name: string; sortOrder?: number; id?: number; isComments?: boolean }>(
  a: T,
  b: T,
) {
  const rank = ageGroupRank(a.name, a.isComments) - ageGroupRank(b.name, b.isComments);
  if (rank !== 0) return rank;
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  return (a.id ?? 0) - (b.id ?? 0);
}

export function sortTeamsByAge<T extends { name: string; sortOrder?: number; id?: number; isComments?: boolean }>(
  teams: T[],
) {
  return [...teams].sort(compareTeamsByAge);
}

export type CoachLink = {
  teamId: number;
  staffId: number | null;
  coachName: string;
  isPrimary: boolean;
};

/** The age-group prefix when this team is labeled by its coach. Otherwise null. */
export function coachLabeledAgeGroup(teamName: string): string | null {
  const name = teamName.trim();
  for (const group of COACH_LABELED_GROUPS) {
    if (name === group || name.startsWith(`${group} `)) return group;
  }
  return null;
}

/** First word of the coach's name, the part used in the group label. */
export function coachGivenName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Display name for a calendar row. Groups outside ילדים א–טרום ג are unchanged.
 * With no coach, the stored name is kept (including a name that already has one, like "ילדים א שחר").
 */
export function teamDisplayName(teamName: string, coachFullName: string | null | undefined) {
  if (isAcademyName(teamName)) return ACADEMY_DISPLAY_NAME;
  const group = coachLabeledAgeGroup(teamName);
  if (!group) return teamName;
  const given = coachFullName ? coachGivenName(coachFullName) : "";
  if (!given) return teamName;
  return `${group} ${given}`;
}

/**
 * One coach name per team: a primary coach wins, then the lowest staff id, then the name.
 * The live staff name wins over the copy stored on the team link.
 */
export function coachFullNameByTeam(
  links: CoachLink[],
  staffNames: { id: number; name: string }[],
): Map<number, string> {
  const byId = new Map(staffNames.map((person) => [person.id, person.name.trim()]));
  const grouped = new Map<number, CoachLink[]>();
  for (const link of links) {
    const list = grouped.get(link.teamId) ?? [];
    list.push(link);
    grouped.set(link.teamId, list);
  }

  const result = new Map<number, string>();
  for (const [teamId, list] of grouped) {
    const ranked = [...list].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      const aId = a.staffId ?? Number.MAX_SAFE_INTEGER;
      const bId = b.staffId ?? Number.MAX_SAFE_INTEGER;
      if (aId !== bId) return aId - bId;
      return a.coachName.localeCompare(b.coachName, "he");
    });
    const coach = ranked[0];
    const full = (coach.staffId != null ? byId.get(coach.staffId) : "") || coach.coachName.trim();
    if (full) result.set(teamId, full);
  }
  return result;
}

/**
 * Pitch rules recognize בית הספר לכדורגל by `ageBandCode`.
 * The stored names below are the other identifier: coach labels do not rewrite this row
 * (נוער / נערים / ילדות / בית הספר keep their stored names; younger groups show age + coach).
 * "בית ספר" is the short name from the first teams migration, still mapped to this band.
 */
const FOOTBALL_SCHOOL_AGE_BAND = "football_school";
const FOOTBALL_SCHOOL_NAMES = new Set([
  ACADEMY_DISPLAY_NAME,
  "בית ספר לכדורגל",
  "בית הספר לכדורגל",
  "בית ספר",
]);

export type FootballSchoolIdentity = {
  name?: string | null;
  ageBandCode?: string | null;
};

export function isFootballSchoolTeam(team: FootballSchoolIdentity | null | undefined): boolean {
  if (!team) return false;
  if (team.ageBandCode === FOOTBALL_SCHOOL_AGE_BAND) return true;
  const name = (team.name ?? "").trim().replace(/\s+/g, " ");
  return FOOTBALL_SCHOOL_NAMES.has(name);
}

/** Every two weeks is offered only when every selected team is the football school. */
export function biweeklyRepeatAllowed(
  teams: ReadonlyArray<FootballSchoolIdentity | null | undefined>,
): boolean {
  const selected = teams.filter((team) => team && (team.name?.trim() || team.ageBandCode));
  return selected.length > 0 && selected.every((team) => isFootballSchoolTeam(team));
}

export function applyCoachLabels<T extends { id: number; name: string }>(
  teams: T[],
  coachByTeam: Map<number, string>,
): T[] {
  return teams.map((team) => {
    const name = teamDisplayName(team.name, coachByTeam.get(team.id) ?? null);
    return name === team.name ? team : { ...team, name };
  });
}
