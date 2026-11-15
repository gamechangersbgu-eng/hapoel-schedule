/** Free-text opponent and medic on a משחק אימון. League games keep their own columns. */
export const PRACTICE_TEXT_MAX = 120;

export function readPracticeText(
  value: string | null | undefined,
): { value: string | null } | { error: string } {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { value: null };
  if (trimmed.length > PRACTICE_TEXT_MAX) return { error: `עד ${PRACTICE_TEXT_MAX} תווים` };
  return { value: trimmed };
}
