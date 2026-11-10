// Which teams a viewer chose to see, remembered in this browser.
// "public" is shared by the phone list and the computer grid; "admin" and "tv" are separate.
export type SelectionScope = "public" | "admin" | "tv";

const KEYS: Record<SelectionScope, string> = {
  public: "hapoel-schedule-my-teams-v2",
  admin: "hapoel-schedule-admin-teams-v1",
  tv: "hapoel-schedule-tv-teams-v1",
};
/** Earlier versions saved a single team for the phone view under this key. */
const OLD_PUBLIC_KEY = "hapoel-schedule-my-team-v1";

/** null = nothing chosen yet (computer, admin and TV then show every team). */
export function readTeamSelection(scope: SelectionScope): number[] | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEYS[scope]) ?? "null");
    if (Array.isArray(saved)) {
      const ids = saved.map(Number).filter((id) => Number.isFinite(id) && id > 0);
      return ids.length ? ids : null;
    }
    if (scope === "public") {
      const old = Number(window.localStorage.getItem(OLD_PUBLIC_KEY));
      if (Number.isFinite(old) && old > 0) return [old];
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Pass null (or an empty list) for "all teams". */
export function saveTeamSelection(scope: SelectionScope, ids: number[] | null) {
  try {
    if (!ids || ids.length === 0) window.localStorage.removeItem(KEYS[scope]);
    else window.localStorage.setItem(KEYS[scope], JSON.stringify(ids));
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}
