import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { AdminShell } from "@/components/AdminShell";
import { addAbsence, deleteAbsence, deleteCoach, deleteManagement, saveCoach, saveManagement, saveTeamAssistant } from "@/app/admin/coaches/actions";
import { requireAdmin } from "@/lib/auth";
import { ABSENCE_TYPES, WEEKDAY_LETTERS, absenceLabel, absenceOn } from "@/lib/coaches";
import { getCoaches } from "@/lib/coaches-db";
import { db, staff, teams as teamsTable } from "@/lib/db";
import { applyCoachLabels, coachFullNameByTeam } from "@/lib/team-labels";
import { MANAGEMENT_ROLES, isManagementRole } from "@/lib/update-recipients";
import { formatDayMonth, formatISODate } from "@/lib/week";

export const dynamic = "force-dynamic";
/** The management section (update recipients) is hidden on this page for now. */
const SHOW_MANAGEMENT = false;
/** Coach absences (vacation, sick...) are hidden on this page for now; saved absences stay. */
const SHOW_ABSENCES = false;

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
  const storedTeams = teamRows.filter((team) => !team.isComments);
  const fieldCoaches = coaches.filter((coach) => !coach.receivesAllUpdates);
  const management = coaches.filter((coach) => coach.receivesAllUpdates);
  const teams = applyCoachLabels(
    storedTeams,
    coachFullNameByTeam(
      fieldCoaches.flatMap((coach) =>
        coach.teamIds.map((teamId) => ({
          teamId,
          staffId: coach.id,
          coachName: coach.name,
          isPrimary: !coach.assistantTeamIds?.includes(teamId),
        })),
      ),
      fieldCoaches.map((coach) => ({ id: coach.id, name: coach.name })),
    ),
  );
  const today = formatISODate(new Date());
  const editing = params.edit ? fieldCoaches.find((coach) => coach.id === Number(params.edit)) : undefined;
  const showForm = Boolean(params.new) || Boolean(editing);
  // The ID number is read only for the form being edited; it is never part of CoachInfo.
  const [editingId] = editing
    ? await db.select({ nationalId: staff.nationalId }).from(staff).where(eq(staff.id, editing.id)).limit(1)
    : [];
  const uncovered = teams.filter((team) => !fieldCoaches.some((coach) => coach.teamIds.includes(team.id)));
  const missingRoles = MANAGEMENT_ROLES.filter((role) => !management.some((person) => person.roleLabel === role));

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
          מאמנים, הקבוצות שלהם וימי עבודה. קבוצות מילדים א עד טרום ג מוצגות לפי השם הפרטי של המאמן (למשל ילדים ב נועם). אם יש כמה מאמנים, מוצג מי שנוסף ראשון. מאמן או עוזר מאמן של כמה קבוצות לא ישובץ לשתיהן באותו זמן.
        </p>
        <Link href="/admin/coaches?new=1" className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-black text-white">+ מאמן חדש</Link>
      </div>

      {uncovered.length ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          קבוצות בלי מאמן: {uncovered.map((team) => team.name).join(", ")}
        </p>
      ) : null}

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {fieldCoaches.length === 0 ? <p className="px-5 py-6 text-center text-zinc-600">עוד אין מאמנים ברשימה.</p> : null}
        <ul className="divide-y divide-zinc-100">
          {fieldCoaches.map((coach) => {
            const away = absenceOn(coach, today);
            const upcoming = coach.absences.filter((item) => (item.endDate ?? item.startDate) >= today);
            return (
              <li key={coach.id}>
                <Link href={`/admin/coaches?edit=${coach.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-4">
                  <span className="min-w-36 text-base font-black">
                    {coach.name}
                    {SHOW_ABSENCES && away ? <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">היום: {absenceLabel(away.type)}</span> : null}
                  </span>
                  <span className="flex-1 text-sm text-zinc-700">
                    {coach.teamIds.length
                      ? teams
                          .filter((t) => coach.teamIds.includes(t.id))
                          .map((t) => (coach.assistantTeamIds?.includes(t.id) ? `${t.name} (עוזר)` : t.name))
                          .join(", ")
                      : "אין קבוצות"}
                  </span>
                  <span className="text-sm text-zinc-600">
                    ימים: {coach.workDays.length ? coach.workDays.map((d) => WEEKDAY_LETTERS[d]).join(" ") : "לא הוגדרו"}
                  </span>
                  {SHOW_ABSENCES && upcoming.length ? <span className="text-xs font-bold text-amber-800">{upcoming.length} היעדרויות קרובות</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-lg font-black text-[#8e0b20]">עוזר מאמן לקבוצה</h2>
          <p className="text-sm text-zinc-600">
            לא חובה. עוזר המאמן נספר כמו המאמן: אי אפשר לשבץ אותו באותו זמן לקבוצה אחרת שבה הוא מאמן או עוזר מאמן.
            אפשר גם לסמן עוזר מאמן מתוך הטופס של המאמן עצמו.
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {teams.map((team) => {
            const linked = fieldCoaches.filter((coach) => coach.teamIds.includes(team.id));
            const heads = linked.filter((coach) => !coach.assistantTeamIds?.includes(team.id));
            const assistants = linked.filter((coach) => coach.assistantTeamIds?.includes(team.id));
            return (
              <li key={team.id} className="px-5 py-3">
                <form action={saveTeamAssistant} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="teamId" value={team.id} />
                  <div className="min-w-36 flex-1">
                    <p className="text-base font-black">{team.name}</p>
                    <p className="text-sm text-zinc-600">מאמן: {heads.length ? heads.map((coach) => coach.name).join(", ") : "לא שובץ"}</p>
                  </div>
                  <label className={`${label} sm:w-64`}>
                    עוזר מאמן
                    <select name="assistantStaffId" className={field} defaultValue={assistants[0]?.id ?? ""}>
                      <option value="">בלי עוזר</option>
                      {fieldCoaches.map((coach) => (
                        <option key={coach.id} value={coach.id}>{coach.name}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="min-h-11 rounded-lg px-4 text-sm font-black ring-1 ring-zinc-300">שמירה</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Management contacts are hidden for now (club request); the data and actions stay. */}
      {SHOW_MANAGEMENT ? (
        <>
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-lg font-black text-[#8e0b20]">הנהלה — עדכונים מכל הקבוצות</h2>
          <p className="text-sm text-zinc-600">
            מנהל מקצועי, מנהל מחלקה, מנהל חטיבה צעירה וראש מערך שוערים מקבלים כל שינוי לוח ואת לוח האימונים, באותו ערוץ כמו המאמנים: הטלפון והאימייל שנשמרים כאן. הם לא משויכים לקבוצה אחת.
          </p>
        </div>
        {missingRoles.length ? (
          <p className="mx-5 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
            תפקידים בלי איש קשר: {missingRoles.join(", ")}
          </p>
        ) : (
          <p className="mx-5 mt-3 text-sm font-bold text-emerald-800">לכל ארבעת תפקידי ההנהלה יש איש קשר.</p>
        )}
        <ul className="mt-2 divide-y divide-zinc-100">
          {management.length === 0 ? <li className="px-5 py-3 text-sm text-zinc-500">עוד אין אנשי הנהלה ברשימה.</li> : null}
          {management.map((person) => (
            <li key={person.id} className="px-5 py-3">
              <form action={saveManagement} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={person.id} />
                <label className={label}>
                  שם מלא
                  <input name="name" className={field} defaultValue={person.name} required />
                </label>
                <label className={label}>
                  תפקיד
                  <select name="roleLabel" className={field} defaultValue={isManagementRole(person.roleLabel ?? "") ? person.roleLabel ?? "" : MANAGEMENT_ROLES[0]}>
                    {MANAGEMENT_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  טלפון
                  <input name="phone" dir="ltr" inputMode="tel" className={field} defaultValue={person.phone ?? ""} />
                </label>
                <label className={label}>
                  אימייל
                  <input name="email" type="email" dir="ltr" className={field} defaultValue={person.email ?? ""} />
                </label>
                <button type="submit" className="min-h-10 rounded-lg text-sm font-black ring-1 ring-zinc-300 sm:col-span-2">שמירה</button>
              </form>
              <form action={deleteManagement} className="mt-1">
                <input type="hidden" name="id" value={person.id} />
                <button type="submit" className="text-xs font-bold text-red-700 underline">הסרה</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveManagement} className="grid gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3 sm:grid-cols-2">
          <label className={label}>
            שם מלא
            <input name="name" className={field} required />
          </label>
          <label className={label}>
            תפקיד
            <select name="roleLabel" className={field} defaultValue={missingRoles[0] ?? MANAGEMENT_ROLES[0]}>
              {MANAGEMENT_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            טלפון
            <input name="phone" dir="ltr" inputMode="tel" className={field} />
          </label>
          <label className={label}>
            אימייל
            <input name="email" type="email" dir="ltr" className={field} />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-sm font-black text-white sm:col-span-2">+ הוספה להנהלה</button>
        </form>
      </section>
        </>
      ) : null}

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
                תעודת זהות
                <input
                  name="nationalId"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={9}
                  pattern="[0-9]{9}"
                  title="9 ספרות, אפשר אפסים מובילים"
                  placeholder="9 ספרות"
                  className={`${field} sm:w-48`}
                  defaultValue={editingId?.nationalId ?? ""}
                />
              </label>
              <fieldset>
                <legend className="mb-0.5 text-sm font-bold">קבוצות ותפקיד בכל קבוצה</legend>
                <p className="mb-1.5 text-xs text-zinc-500">
                  אפשר להיות מאמן בקבוצה אחת ועוזר מאמן באחרת. מי שמשויך לכמה קבוצות לא ישובץ לשתיהן באותו זמן.
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {teams.map((team) => {
                    const role = editing?.assistantTeamIds?.includes(team.id)
                      ? "assistant"
                      : editing?.teamIds.includes(team.id)
                        ? "head"
                        : "";
                    return (
                      <label
                        key={team.id}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ring-1 ring-zinc-200"
                      >
                        <span className="font-semibold">{team.name}</span>
                        <select name={`teamRole-${team.id}`} defaultValue={role} className="rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-sm">
                          <option value="">—</option>
                          <option value="head">מאמן</option>
                          <option value="assistant">עוזר מאמן</option>
                        </select>
                      </label>
                    );
                  })}
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
                {SHOW_ABSENCES ? (
                <>
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
                </>
                ) : null}
                <form action={deleteCoach} className={SHOW_ABSENCES ? "mt-4 border-t border-zinc-200 pt-3" : ""}>
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
