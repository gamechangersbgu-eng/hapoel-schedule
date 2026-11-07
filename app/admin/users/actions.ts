"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminUsers, db } from "@/lib/db";
import { requireAdmin, requireOwner, startSession } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";

function usersPage(params: Record<string, string>): never {
  redirect(`/admin/users?${new URLSearchParams(params).toString()}`);
}

async function otherActiveOwners(exceptId: number) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(adminUsers)
    .where(and(eq(adminUsers.role, "owner"), eq(adminUsers.isActive, true), ne(adminUsers.id, exceptId)));
  return value;
}

export async function addUserAction(formData: FormData) {
  await requireOwner();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "owner" ? "owner" : "admin";
  const password = String(formData.get("password") ?? "");

  if (!displayName || !/^\S+@\S+\.\S+$/.test(email)) usersPage({ error: "יש למלא שם ואימייל תקין" });
  if (password.length < MIN_PASSWORD_LENGTH) usersPage({ error: `סיסמה זמנית: לפחות ${MIN_PASSWORD_LENGTH} תווים` });
  const [exists] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (exists) usersPage({ error: "כבר יש משתמש עם האימייל הזה" });

  await db.insert(adminUsers).values({
    email,
    displayName,
    role,
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/admin/users");
  usersPage({ done: `${displayName} נוסף/ה. מסרו לו/ה את הסיסמה הזמנית; בכניסה הראשונה תתבקש סיסמה חדשה.` });
}

export async function resetPasswordAction(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) usersPage({ error: `סיסמה זמנית: לפחות ${MIN_PASSWORD_LENGTH} תווים` });
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!user) usersPage({ error: "המשתמש לא נמצא" });
  await db
    .update(adminUsers)
    .set({
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      sessionVersion: user.sessionVersion + 1,
    })
    .where(eq(adminUsers.id, id));
  revalidatePath("/admin/users");
  usersPage({ done: `הסיסמה של ${user.displayName} אופסה. בכניסה הבאה תתבקש סיסמה חדשה.` });
}

export async function setActiveAction(formData: FormData) {
  const me = await requireOwner();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "1";
  if (id === me.id) usersPage({ error: "אי אפשר להשבית את המשתמש שלך" });
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!user) usersPage({ error: "המשתמש לא נמצא" });
  if (!active && user.role === "owner" && (await otherActiveOwners(id)) === 0) {
    usersPage({ error: "חייב להישאר לפחות מנהל ראשי אחד פעיל" });
  }
  await db
    .update(adminUsers)
    .set({ isActive: active, sessionVersion: user.sessionVersion + 1 })
    .where(eq(adminUsers.id, id));
  revalidatePath("/admin/users");
  usersPage({ done: active ? `${user.displayName} הופעל/ה מחדש` : `${user.displayName} הושבת/ה ולא יוכל/תוכל להיכנס` });
}

export async function setRoleAction(formData: FormData) {
  const me = await requireOwner();
  const id = Number(formData.get("id"));
  const role = formData.get("role") === "owner" ? "owner" : "admin";
  if (id === me.id && role !== "owner" && (await otherActiveOwners(id)) === 0) {
    usersPage({ error: "חייב להישאר לפחות מנהל ראשי אחד פעיל" });
  }
  await db.update(adminUsers).set({ role }).where(eq(adminUsers.id, id));
  revalidatePath("/admin/users");
  usersPage({ done: "ההרשאה עודכנה" });
}

/** Any manager: change own password (also the forced change after a temporary password). */
export async function changeOwnPasswordAction(formData: FormData) {
  const me = await requireAdmin({ allowPasswordChange: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");
  const first = formData.get("first") === "1" ? "&first=1" : "";
  const back = (error: string): never => redirect(`/admin/account?error=${encodeURIComponent(error)}${first}`);

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, me.id)).limit(1);
  if (!user || !(await verifyPassword(current, user.passwordHash))) back("הסיסמה הנוכחית שגויה");
  if (next.length < MIN_PASSWORD_LENGTH) back(`הסיסמה החדשה צריכה להיות לפחות ${MIN_PASSWORD_LENGTH} תווים`);
  if (next !== repeat) back("שתי הסיסמאות החדשות לא זהות");
  if (next === current) back("הסיסמה החדשה צריכה להיות שונה מהנוכחית");

  const [updated] = await db
    .update(adminUsers)
    .set({
      passwordHash: await hashPassword(next),
      mustChangePassword: false,
      sessionVersion: user.sessionVersion + 1,
    })
    .where(eq(adminUsers.id, me.id))
    .returning();
  // Signs out every other device; keeps this one signed in.
  await startSession(updated);
  redirect(first ? "/admin" : "/admin/account?done=1");
}
