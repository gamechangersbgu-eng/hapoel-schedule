"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { adminUsers, db } from "@/lib/db";
import { endSession, startSession } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "");
  return next.startsWith("/admin") ? next : "/admin";
}

function back(error: string, next: string, extra = ""): never {
  redirect(`/login?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}${extra}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const [user] = email
    ? await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1)
    : [];
  const ok = user && user.isActive && (await verifyPassword(password, user.passwordHash));
  if (!ok || !user) {
    await new Promise((resolve) => setTimeout(resolve, 600)); // slow down password guessing
    back("אימייל או סיסמה שגויים", next);
  }

  await db.update(adminUsers).set({ lastLoginAt: new Date().toISOString() }).where(eq(adminUsers.id, user.id));
  await startSession(user);
  redirect(user.mustChangePassword ? "/admin/account?first=1" : next);
}

/** Only while there are no users at all: creates the first owner, protected by ADMIN_SETUP_CODE. */
export async function setupOwnerAction(formData: FormData) {
  const [{ value: existing }] = await db.select({ value: count() }).from(adminUsers);
  if (existing > 0) redirect("/login");

  const expected = process.env.ADMIN_SETUP_CODE;
  const code = String(formData.get("code") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!expected || code !== expected) back("קוד ההתקנה שגוי", "/admin");
  if (!displayName || !/^\S+@\S+\.\S+$/.test(email)) back("יש למלא שם ואימייל תקין", "/admin");
  if (password.length < MIN_PASSWORD_LENGTH) back(`הסיסמה צריכה להיות לפחות ${MIN_PASSWORD_LENGTH} תווים`, "/admin");

  const [user] = await db
    .insert(adminUsers)
    .values({
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: "owner",
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    })
    .returning();
  await startSession(user);
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}
