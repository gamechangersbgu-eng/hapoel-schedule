// Which of "הקבוצות שלי" should send a web-push when that team's schedule changes.
// Stored apart from the team list so turning a bell off is remembered on the next visit.
// A selected team with no explicit preference is on. A team that is not selected is never alerting.

export const TEAM_ALERTS_STORAGE_KEY = "hapoel-schedule-team-alerts-v1";

/** team id → explicit on/off. Missing id means "on" once the team is selected. */
export type TeamAlertPrefs = Record<number, boolean>;

export function normalizeTeamAlertPrefs(raw: unknown): TeamAlertPrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const prefs: TeamAlertPrefs = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id <= 0 || typeof value !== "boolean") continue;
    prefs[id] = value;
  }
  return prefs;
}

export function parseStoredTeamAlerts(raw: string | null): TeamAlertPrefs {
  if (!raw) return {};
  try {
    return normalizeTeamAlertPrefs(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function serializeTeamAlerts(prefs: TeamAlertPrefs): string {
  return JSON.stringify(normalizeTeamAlertPrefs(prefs));
}

/** Selected + no explicit preference → on. Unselected teams are never on. */
export function isTeamAlertOn(prefs: TeamAlertPrefs, teamId: number, selected: boolean): boolean {
  if (!selected) return false;
  if (Object.prototype.hasOwnProperty.call(prefs, teamId)) return prefs[teamId] === true;
  return true;
}

export function alertingTeamIds(selectedIds: number[], prefs: TeamAlertPrefs): number[] {
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const id of selectedIds) {
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    if (!isTeamAlertOn(prefs, id, true)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Every newly chosen team starts with the bell on, including one that was off before. */
export function withNewlySelectedTeam(prefs: TeamAlertPrefs, teamId: number): TeamAlertPrefs {
  return { ...prefs, [teamId]: true };
}

export function withBell(prefs: TeamAlertPrefs, teamId: number, on: boolean): TeamAlertPrefs {
  return { ...prefs, [teamId]: on };
}

export function readTeamAlertPrefs(): TeamAlertPrefs {
  try {
    return parseStoredTeamAlerts(window.localStorage.getItem(TEAM_ALERTS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveTeamAlertPrefs(prefs: TeamAlertPrefs) {
  try {
    window.localStorage.setItem(TEAM_ALERTS_STORAGE_KEY, serializeTeamAlerts(prefs));
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}
