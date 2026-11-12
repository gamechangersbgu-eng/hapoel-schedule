/**
 * Manager login names. Stored in admin_users.email (already unique text) so the
 * column does not need a rename. Trimmed and lowercased before save and login.
 */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}
