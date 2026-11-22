// Who can sign in and what each role may open. No server imports, so tests can use it.
//
// owner / admin: club managers (as before) — the whole management area.
// physio: the injury list (full details) and the physio treatment schedule. No schedule editing.
// coach: only the injury status of the players assigned to them (players.coach_staff_id). No details.

export const USER_ROLES = ["owner", "admin", "physio", "coach"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "מנהל ראשי",
  admin: "מנהל",
  physio: "פיזיותרפיסט",
  coach: "מאמן",
};

export function isUserRole(value: unknown): value is UserRole {
  return (USER_ROLES as readonly unknown[]).includes(value);
}

/** Stored role → role. Rows created before the new roles hold "owner" or "admin". */
export function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "admin";
}

export function isManager(role: UserRole) {
  return role === "owner" || role === "admin";
}

/**
 * Who may approve gym and video-room requests, and book those rooms directly.
 * The owner role (מנהל ראשי) is the approver. Change this list to grant the
 * capability to another role. Do not hardcode a person's name.
 */
export const APPROVER_ROLES = ["owner"] as const satisfies readonly UserRole[];

export function hasApproverCapability(role: UserRole) {
  return (APPROVER_ROLES as readonly UserRole[]).includes(role);
}

/** Label for the fitness-coach flag on an admin user (not a separate login role). */
export const FITNESS_COACH_LABEL = "מאמן כושר";

/** Body part, notes, history and treatments: managers and the physio. Coaches see the status only. */
export function canSeeInjuryDetails(role: UserRole) {
  return isManager(role) || role === "physio";
}

/** Add injuries, change their status, schedule treatments. */
export function canEditInjuries(role: UserRole) {
  return isManager(role) || role === "physio";
}

/** First screen after sign-in, and where a page sends a role it does not serve. */
export function homePathForRole(role: UserRole) {
  if (role === "physio") return "/admin/physio";
  if (role === "coach") return "/admin/injuries";
  return "/admin";
}
