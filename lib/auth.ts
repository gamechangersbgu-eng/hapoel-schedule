import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminUsers, db } from "@/lib/db";
import { canViewRoom } from "@/lib/rooms/room-access";
import type { RoomKind } from "@/lib/rooms/room-rules";
import { homePathForRole, isManager, normalizeRole, type UserRole } from "@/lib/roles";
import { AUTH_DISABLED, SESSION_COOKIE, decryptSession, encryptSession, sessionCookieOptions } from "@/lib/session";

export type CurrentAdmin = {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  /** Staff row of a coach or physio login (null for managers). */
  staffId: number | null;
  mustChangePassword: boolean;
  /** מאמן כושר. May request a gym booking. Independent of role. */
  isFitnessCoach: boolean;
};

/** The signed-in user, checked against the database (active, not signed out since). */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  if (AUTH_DISABLED) {
    return {
      id: 0,
      email: "test@local",
      displayName: "בדיקה",
      role: "owner",
      staffId: null,
      mustChangePassword: false,
      isFitnessCoach: false,
    };
  }
  const session = await decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.uid)).limit(1);
  if (!user || !user.isActive || user.sessionVersion !== session.ver) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: normalizeRole(user.role),
    staffId: user.staffId ?? null,
    mustChangePassword: user.mustChangePassword,
    isFitnessCoach: user.isFitnessCoach,
  };
});

/** Any signed-in user, whatever the role (own account page, sign-out). */
export async function requireUser(options?: { allowPasswordChange?: boolean }) {
  const user = await getCurrentAdmin();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options?.allowPasswordChange) redirect("/admin/account?first=1");
  return user;
}

/**
 * Use at the top of every management page and every action that changes the schedule.
 * Only managers (owner / admin). A physio or coach is sent to their own screen.
 */
export async function requireAdmin(options?: { allowPasswordChange?: boolean }) {
  const user = await requireUser(options);
  if (!isManager(user.role)) redirect(homePathForRole(user.role));
  return user;
}

/** Pages and actions open to some roles only (injuries, physio). Others go to their own screen. */
export async function requireRole(roles: readonly UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homePathForRole(user.role));
  return user;
}

/** Gym and video pages: managers, plus a fitness coach on the gym page. */
export async function requireRoomViewer(kind: RoomKind) {
  const user = await requireUser();
  if (!canViewRoom({ role: user.role, isFitnessCoach: user.isFitnessCoach }, kind)) {
    redirect(homePathForRole(user.role));
  }
  return user;
}

export async function requireOwner() {
  const user = await requireAdmin();
  if (user.role !== "owner") redirect("/admin");
  return user;
}

export async function startSession(user: { id: number; sessionVersion: number; role: string }) {
  const token = await encryptSession({ uid: user.id, ver: user.sessionVersion, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
