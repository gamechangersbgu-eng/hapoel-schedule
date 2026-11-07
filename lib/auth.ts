import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminUsers, db } from "@/lib/db";
import { SESSION_COOKIE, decryptSession, encryptSession, sessionCookieOptions } from "@/lib/session";

export type CurrentAdmin = {
  id: number;
  email: string;
  displayName: string;
  role: "owner" | "admin";
  mustChangePassword: boolean;
};

/** The signed-in manager, checked against the database (active, not signed out since). */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.uid)).limit(1);
  if (!user || !user.isActive || user.sessionVersion !== session.ver) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role === "owner" ? "owner" : "admin",
    mustChangePassword: user.mustChangePassword,
  };
});

/** Use at the top of every management page and every action that changes data. */
export async function requireAdmin(options?: { allowPasswordChange?: boolean }) {
  const user = await getCurrentAdmin();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options?.allowPasswordChange) redirect("/admin/account?first=1");
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
