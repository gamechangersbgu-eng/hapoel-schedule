/**
 * Who is told about a schedule change.
 * Coaches are told about their own teams. Management is told about every team.
 * The contact channels are the phone and email already stored on the staff row —
 * the same fields coaches use. There is no separate messenger in this app.
 */

export const MANAGEMENT_ROLES = [
  "מנהל מקצועי",
  "מנהל מחלקה",
  "מנהל חטיבה צעירה",
  "ראש מערך שוערים",
] as const;

export type ManagementRole = (typeof MANAGEMENT_ROLES)[number];

export function isManagementRole(role: string): role is ManagementRole {
  return (MANAGEMENT_ROLES as readonly string[]).includes(role);
}

export type UpdateRecipient = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  roleLabel: string | null;
  teamIds: number[];
  receivesAllUpdates: boolean;
};

/**
 * Recipients for a change that touches these teams.
 * Management (`receivesAllUpdates`) is always included. A coach is included when
 * one of their teams is in the list. Pass every team id for a club-wide change.
 */
export function recipientsForTeams(people: UpdateRecipient[], teamIds: number[]): UpdateRecipient[] {
  const wanted = new Set(teamIds);
  const seen = new Set<number>();
  const result: UpdateRecipient[] = [];
  for (const person of people) {
    if (seen.has(person.id)) continue;
    const onTeam = person.teamIds.some((id) => wanted.has(id));
    if (!person.receivesAllUpdates && !onTeam) continue;
    seen.add(person.id);
    result.push(person);
  }
  return result;
}

/** Phone or email, whichever is filled. Empty when there is no way to reach them. */
export function recipientContact(person: Pick<UpdateRecipient, "phone" | "email">) {
  return [person.phone, person.email].filter((value): value is string => Boolean(value?.trim()));
}
