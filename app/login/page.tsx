import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { adminUsers, db } from "@/lib/db";
import { ClubLogo } from "@/components/ClubLogo";
import { getCurrentAdmin } from "@/lib/auth";
import { loginAction, setupOwnerAction } from "@/app/login/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "כניסת מנהל" };

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base";
const label = "flex flex-col gap-1 text-sm font-bold";

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  if (await getCurrentAdmin()) redirect(next?.startsWith("/admin") ? next : "/admin");
  const [{ value: users }] = await db.select({ value: count() }).from(adminUsers);
  const setup = users === 0;

  return (
    <div className="flex min-h-full items-center justify-center bg-[linear-gradient(160deg,#c8102e_0%,#5c0814_100%)] p-4">
      <main className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <ClubLogo size="login" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-500">הפועל באר שבע · מחלקת הנוער</p>
            <h1 className="text-2xl font-black text-[#8e0b20]">{setup ? "הגדרת מנהל ראשי" : "כניסת מנהל"}</h1>
          </div>
        </div>
        {setup ? (
          <p className="mt-2 text-sm text-zinc-600">
            עוד אין משתמשים במערכת. המשתמש הראשון יהיה המנהל הראשי, והוא יוכל להוסיף מנהלים נוספים.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        ) : null}

        {setup ? (
          <form action={setupOwnerAction} className="mt-4 flex flex-col gap-3">
            <label className={label}>
              קוד התקנה
              <input name="code" className={field} required autoComplete="off" />
            </label>
            <label className={label}>
              שם מלא
              <input name="displayName" className={field} required autoComplete="name" />
            </label>
            <label className={label}>
              שם משתמש
              <input
                name="username"
                type="text"
                dir="ltr"
                className={field}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className={label}>
              סיסמה (לפחות 8 תווים)
              <input name="password" type="password" dir="ltr" className={field} required minLength={8} autoComplete="new-password" />
            </label>
            <button type="submit" className="mt-1 min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white">
              יצירת מנהל ראשי
            </button>
          </form>
        ) : (
          <form action={loginAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="next" value={next ?? "/admin"} />
            <label className={label}>
              שם משתמש
              <input
                name="username"
                type="text"
                dir="ltr"
                className={field}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </label>
            <label className={label}>
              סיסמה
              <input name="password" type="password" dir="ltr" className={field} required autoComplete="current-password" />
            </label>
            <button type="submit" className="mt-1 min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white">
              כניסה
            </button>
            <p className="text-xs text-zinc-500">שכחתם סיסמה? פנו למנהל הראשי של המערכת.</p>
          </form>
        )}

        <Link href="/" className="mt-5 block text-center text-sm font-bold text-zinc-600 underline">
          חזרה ללוח האימונים
        </Link>
      </main>
    </div>
  );
}
