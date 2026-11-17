import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { changeOwnPasswordAction } from "@/app/admin/users/actions";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "החשבון שלי · מצב מנהל" };

type Props = { searchParams: Promise<{ error?: string; done?: string; first?: string }> };
const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base";

export default async function AccountPage({ searchParams }: Props) {
  const user = await requireUser({ allowPasswordChange: true });
  const { error, done, first } = await searchParams;
  const forced = user.mustChangePassword || first === "1";

  return (
    <AdminShell user={user} title="החשבון שלי" current="/admin/account">
      <section className="max-w-md rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-zinc-600">
          {user.displayName} · שם משתמש <span dir="ltr">{user.email}</span> · {ROLE_LABELS[user.role]}
        </p>
        <h2 className="mt-3 text-lg font-black text-[#8e0b20]">{forced ? "יש לבחור סיסמה אישית" : "החלפת סיסמה"}</h2>
        {forced ? (
          <p className="mt-1 text-sm text-zinc-600">קיבלת סיסמה זמנית. לפני שממשיכים, בחרו סיסמה שרק אתם יודעים.</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
            הסיסמה הוחלפה. נותקת מכל שאר המכשירים.
          </p>
        ) : null}
        <form action={changeOwnPasswordAction} className="mt-3 flex flex-col gap-3">
          {forced ? <input type="hidden" name="first" value="1" /> : null}
          <label className="flex flex-col gap-1 text-sm font-bold">
            {forced ? "הסיסמה הזמנית" : "סיסמה נוכחית"}
            <input name="current" type="password" dir="ltr" className={field} required autoComplete="current-password" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            סיסמה חדשה (לפחות 8 תווים)
            <input name="next" type="password" dir="ltr" className={field} required minLength={8} autoComplete="new-password" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            הסיסמה החדשה שוב
            <input name="repeat" type="password" dir="ltr" className={field} required minLength={8} autoComplete="new-password" />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white">
            שמירת סיסמה
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
