import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { AdminShell } from "@/components/AdminShell";
import { addAbsence, deleteAbsence, deleteCoach, saveCoach } from "@/app/admin/coaches/actions";
import { requireAdmin } from "@/lib/auth";
import { ABSENCE_TYPES, WEEKDAY_LETTERS, absenceLabel, absenceOn } from "@/lib/coaches";
import { getCoaches } from "@/lib/coaches-db";
import { db, teams as teamsTable } from "@/lib/db";
import { formatDayMonth, formatISODate } from "@/lib/week";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "מאמנים · מצב מנהל" };

type Props = { searchParams: Promise<{ edit?: string; new?: string; error?: string; done?: string }> };
const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
const label = "flex flex-col gap-1 text-sm font-bold";

function range(start: string, end: string | null) {
  return end && end !== start ? `${formatDayMonth(start)}–${formatDayMonth(end)}` : formatDayMonth(start);
}

export default async function CoachesPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const params = await searchParams;
  const [coaches, teamRows] = await Promise.all([
    getCoaches(),
    db.select().from(teamsTable).orderBy(asc(teamsTable.sortOrder)),
  ]);
  const teams = teamRows.filter((team) => !team.isComments);
  const today = formatISODate(new Date());
  const editing = params.edit ? coaches.find((coach) => coach.id === Number(params.edit)) : undefined;
  const showForm = Boolean(params.new) || Boolean(editing);
  const uncovered = teams.filter((team) => !coaches.some((coach) => coach.teamIds.includes(team.id)));

  return (
    <AdminShell user={user} title="מאמנים" current="/admin/coaches">
      {params.done ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">{params.done}</p>
      ) : null}
      {params.error && !showForm ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">{params.error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          מאמנים, הקבוצות שלהם, ימי עבודה והיעדרויות. לוח המגרשים מתריע כשמאמן בהיעדרות, לא עובד באותו יום, או משובץ לשתי קבוצות באותו זמן.
        </p>
        <Link href="/admin/coaches?new=1" className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-black text-white">+ מאמן חדש</Link>
      </div>

      {uncovered.length ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          קבוצות בלי מאמן: {uncovered.map((team) => team.name).join(", ")}
        </p>
      ) : null}

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {coaches.length === 0 ? <p className="px-5 py-6 text-center text-zinc-600">עוד אין מאמנים ברשימה.</p> : null}
        <ul className="divide-y divide-zinc-100">
          {coaches.map((coach) => {
            const away = absenceOn(coach, today);
            const upcoming = coach.absences.filter((item) => (item.endDate ?? item.startDate) >= today);
            return (
              <li key={coach.id}>
                <Link href={`/admin/coaches?edit=${coach.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-4">
                  <span className="min-w-36 text-base font-black">
                    {coach.name}
                    {away ? <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">היום: {absenceLabel(away.type)}</span> : null}
                  </span>
                  <span className="flex-1 text-sm text-zinc-700">
                    {coach.teamIds.length ? teams.filter((t) => coach.teamIds.includes(t.id)).map((t) => t.name).join(", ") : "אין קבוצות"}
                  </span>
                  <span className="text-sm text-zinc-600">
                    ימים: {coach.workDays.length ? coach.workDays.map((d) => WEEKDAY_LETTERS[d]).join(" ") : "לא הוגדרו"}
                  </span>
                  {upcoming.length ? <span className="text-xs font-bold text-amber-800">{upcoming.length} היעדרויות קרובות</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {showForm ? (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 sm:items-center sm:p-3">
          <div role="dialog" aria-modal="true" aria-labelledby="coach-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between">
              <h2 id="coach-title" className="text-xl font-black text-[#8e0b20]">{editing ? editing.name : "מאמן חדש"}</h2>
              <Link href="/admin/coaches" className="rounded-md px-3 py-1.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100">סגור</Link>
            </div>
            {params.error ? (
              <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">{params.error}</p>
            ) : null}

            <form action={saveCoach} className="flex flex-col gap-3">
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  שם מלא
                  <input name="name" className={field} defaultValue={editing?.name} required />
                </label>
                <label className={label}>
                  טלפון
                  <input name="phone" dir="ltr" inputMode="tel" className={field} defaultValue={editing?.phone ?? ""} />
                </label>
              </div>
              <label className={label}>
                תפקיד
                <input name="roleLabel" className={field} defaultValue={editing?.roleLabel ?? "מאמן"} />
              </label>
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold">קבוצות</legend>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {teams.map((team) => (
                    <label key={team.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ring-1 ring-zinc-200 has-[:checked]:bg-[#fbe9ec] has-[:checked]:ring-[#c8102e]">
                      <input type="checkbox" name="teamIds" value={team.id} defaultChecked={editing?.teamIds.includes(team.id)} className="h-4 w-4" />
                      {team.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold">ימי עבודה</legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LETTERS.map((letter, day) => (
                    <label key={day} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-base font-black ring-1 ring-zinc-300 has-[:checked]:bg-[#c8102e] has-[:checked]:text-white has-[:checked]:ring-[#c8102e]">
                      <input type="checkbox" name="workDays" value={day} defaultChecked={editing ? editing.workDays.includes(day) : day <= 4} className="sr-only" />
                      {letter}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white">שמירה</button>
            </form>

            {editing ? (
              <section className="mt-5 border-t border-zinc-200 pt-4">
                <h3 className="text-base font-black text-[#8e0b20]">היעדרויות</h3>
                {editing.absences.length ? (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {editing.absences.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                        <span>
                          <span className="font-bold">{absenceLabel(item.type)}</span> · {range(item.startDate, item.endDate)}
                          {item.note ? ` · ${item.note}` : ""}
                        </span>
                        <form action={deleteAbsence}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="staffId" value={editing.id} />
                          <button type="submit" className="text-xs font-bold text-red-700 underline">הסרה</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">אין היעדרויות.</p>
                )}
                <form action={addAbsence} className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="staffId" value={editing.id} />
                  <label className={label}>
                    סוג
                    <select name="type" className={field} defaultValue="vacation">
                      {ABSENCE_TYPES.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    הערה
                    <input name="note" className={field} placeholder="לא חובה" />
                  </label>
                  <label className={label}>
                    מתאריך
                    <input type="date" name="startDate" className={field} defaultValue={today} required />
                  </label>
                  <label className={label}>
                    עד תאריך (לא חובה)
                    <input type="date" name="endDate" className={field} />
                  </label>
                  <button type="submit" className="min-h-10 rounded-lg text-sm font-black ring-1 ring-[#c8102e] text-[#8e0b20] sm:col-span-2">+ הוספת היעדרות</button>
                </form>
                <form action={deleteCoach} className="mt-4 border-t border-zinc-200 pt-3">
                  <input type="hidden" name="id" value={editing.id} />
                  <button type="submit" className="text-sm font-bold text-red-700 underline">הסרת המאמן מהמערכת</button>
                </form>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
