/**
 * Manual league assignment. A locked row wins over `DB_TEAM_BY_IFA_TEAM`, so a later
 * import cannot move these squads back onto the other team in the age group.
 * No database access: the scraper and the tests both use this.
 */
export type IfaTeamLock = {
  ifaTeamId: number;
  teamId: number;
};

/** Second field of our stable key: `season:ifaTeamId:...` (league and cup). */
export function ifaTeamIdFromExternalId(externalId: string): number | null {
  const part = externalId.split(":")[1];
  if (!part || !/^\d+$/.test(part)) return null;
  const id = Number(part);
  return Number.isSafeInteger(id) ? id : null;
}

export function lockedTeamId(ifaTeamId: number, locks: readonly IfaTeamLock[]): number | undefined {
  return locks.find((lock) => lock.ifaTeamId === ifaTeamId)?.teamId;
}
