import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { AdminShell } from "@/components/AdminShell";
import { addUserAction, resetPasswordAction, setActiveAction, setRoleAction } from "@/app/admin/users/actions";
import { requireOwner } from "@/lib/auth";
import { adminUsers, db, staff } from "@/lib/db";
import { ROLE_LABELS, isManager, normalizeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "משתמשים · מצב מנהל" };

type Props = { searchParams: Promise<{ error?: string; done?: string }> };
const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
const small = "rounded-md px-2.5 py-1.5 text-sm font-bold ring-1 ring-zinc-300 hover:bg-zinc-50";

const ROLE_BADGE = {
  owner: "bg-[#c8102e] text-white",
  admin: "bg-zinc-100 text-zinc-700",
  physio: "bg-sky-100 text-sky-900",
  coach: "bg-amber-100 text-amber-900",
} as const;

function when(iso: string | null) {
  if (!iso) return "עוד לא נכנס/ה";
  const d = new Date(iso);
  return `כניסה אחרונה ${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
}

export default async function UsersPage({ searchParams }: Props) {
  const me = await requireOwner();
  const { error, done } = await searchParams;
  const [users, people] = await Promise.all([
    db.select().from(adminUsers).orderBy(asc(adminUsers.displayName)),
    db.select({ id: staff.id, name: staff.displayName, roleLabel: staff.roleLabel }).from(staff).orderBy(asc(staff.displayName)),
  ]);
  const staffName = new Map(people.map((person) => [person.id, person.name]));

  return (
    <AdminShell user={me} title="משתמשים" current="/admin/users">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
          {done}
        </p>
      ) : null}

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <h2 className="border-b border-zinc-100 px-5 py-3 text-lg font-black text-[#8e0b20]">משתמשים במערכת ({users.length})</h2>
        <ul className="divide-y divide-zinc-100">
          {users.map((user) => {
            const role = normalizeRole(user.role);
            return (
              <li key={user.id} className={`flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between ${user.isActive ? "" : "opacity-60"}`}>
                <div>
                  <p className="text-base font-black">
                    {user.displayName}
                    {user.id === me.id ? <span className="ms-2 text-xs font-bold text-zinc-500">(את/ה)</span> : null}
                    <span className={`ms-2 rounded-full px-2 py-0.5 text-xs font-bold ${ROLE_BADGE[role]}`}>{ROLE_LABELS[role]}</span>
                    {!user.isActive ? <span className="ms-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-bold">מושבת</span> : null}
                    {user.mustChangePassword && user.isActive ? (
                      <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">ממתין לסיסמה אישית</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-zinc-600">
                    שם משתמש <span dir="ltr">{user.email}</span> · {when(user.lastLoginAt)}
                    {user.staffId != null ? ` · ${staffName.get(user.staffId) ?? "איש צוות שנמחק"}` : ""}
                  </p>
                </div>
                {user.id === me.id ? null : (
                  <div className="flex flex-wrap items-center gap-2">
                    {isManager(role) ? (
                      <form action={setRoleAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="role" value={role === "owner" ? "admin" : "owner"} />
                        <button type="submit" className={small}>
                          {role === "owner" ? "הורדה למנהל" : "הפיכה למנהל ראשי"}
                        </button>
                      </form>
                    ) : null}
                    <form action={setActiveAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="active" value={user.isActive ? "0" : "1"} />
                      <button type="submit" className={`${small} ${user.isActive ? "text-red-700" : ""}`}>
                        {user.isActive ? "השבתה" : "הפעלה מחדש"}
                      </button>
                    </form>
                    <form action={resetPasswordAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={user.id} />
                      <input
                        name="password"
                        type="text"
                        dir="ltr"
                        minLength={8}
                        required
                        placeholder="סיסמה זמנית חדשה"
                        autoComplete="off"
                        className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                      />
                      <button type="submit" className={small}>
                        איפוס סיסמה
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="max-w-xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-black text-[#8e0b20]">הוספת משתמש</h2>
        <p className="mt-1 text-sm text-zinc-600">
          בוחרים סיסמה זמנית ומוסרים אותה. בכניסה הראשונה יתבקש לבחור סיסמה אישית.
        </p>
        <form action={addUserAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-bold">
            שם מלא
            <input name="displayName" className={field} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
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
          <label className="flex flex-col gap-1 text-sm font-bold">
            סיסמה זמנית (לפחות 8 תווים)
            <input name="password" type="text" dir="ltr" minLength={8} className={field} required autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            הרשאה
            <select name="role" className={field} defaultValue="admin">
              <option value="admin">מנהל: שיבוץ ועריכה</option>
              <option value="owner">מנהל ראשי: גם ניהול משתמשים</option>
              <option value="physio">פיזיותרפיסט: מעקב פצועים וטיפולים</option>
              <option value="coach">מאמן: סטטוס הפציעה של השחקנים שלו</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
            איש צוות (חובה למאמן, לא חובה לפיזיותרפיסט)
            <select name="staffId" className={field} defaultValue="">
              <option value="">ללא</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                  {person.roleLabel ? ` · ${person.roleLabel}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white sm:col-span-2">
            הוספה
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
