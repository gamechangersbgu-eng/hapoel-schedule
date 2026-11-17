import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { InjuryStatusBadge, shortDate } from "@/components/InjuryStatusBadge";
import { scheduleSessionAction, setSessionStatusAction } from "@/app/admin/physio/actions";
import { requireRole } from "@/lib/auth";
import {
  NOTE_MAX_LENGTH,
  SESSION_DURATIONS,
  SESSION_STATUS_LABELS,
  sessionStartTimes,
  sortInjuries,
  todayInIsrael,
} from "@/lib/injuries";
import { listInjuries, listPhysioUsers, listSessionsBetween } from "@/lib/injuries-db";
import {
  HEBREW_DAY_LETTERS,
  addDaysISO,
  formatISODate,
  formatWeekRange,
  isValidWeekStart,
  parseISODate,
  sundayOf,
  weekDates,
} from "@/lib/week";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "טיפולי פיזיו · מצב מנהל" };

type Props = { searchParams: Promise<{ week?: string; injury?: string; error?: string; done?: string }> };

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
const card = "rounded-2xl bg-white shadow-sm ring-1 ring-black/5";
const heading = "text-lg font-black text-[#8e0b20]";
const small = "rounded-md px-2 py-1 text-xs font-bold ring-1 ring-zinc-300 hover:bg-zinc-50";

const STATUS_STYLE = {
  scheduled: "border-s-4 border-[#c8102e] bg-white",
  done: "border-s-4 border-emerald-500 bg-emerald-50",
  cancelled: "border-s-4 border-zinc-300 bg-zinc-50 text-zinc-500 line-through",
} as const;

export default async function PhysioPage({ searchParams }: Props) {
  const user = await requireRole(["owner", "admin", "physio"]);
  const params = await searchParams;
  const today = todayInIsrael();
  const weekStart = isValidWeekStart(params.week) ? params.week! : formatISODate(sundayOf(parseISODate(today)));
  const days = weekDates(weekStart);

  const [injuries, sessions, physios] = await Promise.all([
    listInjuries({ today }),
    listSessionsBetween(days[0], days[6]),
    listPhysioUsers(),
  ]);
  const open = sortInjuries(injuries, today);
  const waiting = open.filter((injury) => !injury.nextSession);
  const preselected = Number(params.injury) || undefined;
  const isPhysio = user.role === "physio";
  const canBook = isPhysio || physios.length > 0;

  return (
    <AdminShell user={user} title="טיפולי פיזיו" current="/admin/physio">
      {params.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">
          {params.error}
        </p>
      ) : null}
      {params.done ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
          {params.done}
        </p>
      ) : null}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3">
          <h2 className={heading}>שבוע {formatWeekRange(weekStart)}</h2>
          <div className="flex gap-2 text-sm font-bold">
            <Link href={`/admin/physio?week=${addDaysISO(weekStart, -7)}`} className={small}>
              השבוע הקודם
            </Link>
            <Link href="/admin/physio" className={small}>
              השבוע
            </Link>
            <Link href={`/admin/physio?week=${addDaysISO(weekStart, 7)}`} className={small}>
              השבוע הבא
            </Link>
          </div>
        </div>
        <div className="grid gap-px bg-zinc-100 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day, index) => {
            const daySessions = sessions.filter((session) => session.date === day);
            return (
              <div key={day} className={`min-h-28 bg-white p-2 ${day === today ? "bg-[#fff8f6]" : ""}`}>
                <p className={`mb-2 text-sm font-black ${day === today ? "text-[#c8102e]" : "text-zinc-700"}`}>
                  יום {HEBREW_DAY_LETTERS[index]}׳ · {shortDate(day)}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {daySessions.map((session) => (
                    <li key={session.id} className={`rounded-md px-2 py-1.5 text-xs shadow-sm ring-1 ring-black/5 ${STATUS_STYLE[session.status]}`}>
                      <p className="font-black">
                        {session.startTime} · {session.playerName}
                      </p>
                      <p>
                        {session.teamName} · {session.bodyPart} · {session.durationMinutes} דק׳
                      </p>
                      <p className="text-zinc-600">
                        {session.physioName}
                        {session.status !== "scheduled" ? ` · ${SESSION_STATUS_LABELS[session.status]}` : ""}
                      </p>
                      {session.note ? <p className="text-zinc-600">{session.note}</p> : null}
                      {session.status === "scheduled" ? (
                        <div className="mt-1 flex gap-1 no-underline">
                          <form action={setSessionStatusAction}>
                            <input type="hidden" name="id" value={session.id} />
                            <input type="hidden" name="week" value={weekStart} />
                            <input type="hidden" name="status" value="done" />
                            <button type="submit" className={small}>
                              בוצע
                            </button>
                          </form>
                          <form action={setSessionStatusAction}>
                            <input type="hidden" name="id" value={session.id} />
                            <input type="hidden" name="week" value={weekStart} />
                            <input type="hidden" name="status" value="cancelled" />
                            <button type="submit" className={`${small} text-red-700`}>
                              ביטול
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className={heading}>פצועים בלי טיפול מתוכנן ({waiting.length})</h2>
          {waiting.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">לכל הפצועים יש טיפול מתוכנן.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100 text-sm">
              {waiting.map((injury) => (
                <li key={injury.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-bold">{injury.playerName}</span> · {injury.teamName} · {injury.bodyPart}{" "}
                    <InjuryStatusBadge status={injury.status} />
                  </span>
                  <Link href={`/admin/physio?week=${weekStart}&injury=${injury.id}#new`} className={small}>
                    קביעת טיפול
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} p-5`} id="new">
          <h2 className={heading}>קביעת טיפול</h2>
          {open.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">
              אין פצועים פתוחים. פציעה נרשמת ב<Link href="/admin/injuries" className="font-bold underline">מעקב פצועים</Link>.
            </p>
          ) : !canBook ? (
            <p className="mt-2 text-sm text-zinc-600">
              עוד אין משתמש פיזיותרפיסט. מנהל ראשי מוסיף אותו ב<Link href="/admin/users" className="font-bold underline">משתמשים</Link>.
            </p>
          ) : (
            <form action={scheduleSessionAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
                פצוע
                <select name="injuryId" className={field} required defaultValue={preselected ?? ""}>
                  <option value="" disabled>
                    בחירת פצוע
                  </option>
                  {open.map((injury) => (
                    <option key={injury.id} value={injury.id}>
                      {injury.playerName} · {injury.teamName} · {injury.bodyPart}
                    </option>
                  ))}
                </select>
              </label>
              {isPhysio ? null : (
                <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
                  פיזיותרפיסט
                  <select name="physioUserId" className={field} required defaultValue={physios.length === 1 ? physios[0].id : ""}>
                    <option value="" disabled>
                      בחירה
                    </option>
                    {physios.map((physio) => (
                      <option key={physio.id} value={physio.id}>
                        {physio.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-bold">
                תאריך
                <input name="date" type="date" min={today} defaultValue={weekStart > today ? weekStart : today} className={field} required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                שעה
                <select name="startTime" className={field} required defaultValue="16:00">
                  {sessionStartTimes().map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                משך
                <select name="durationMinutes" className={field} defaultValue={30}>
                  {SESSION_DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} דקות
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                הערה (לא חובה)
                <input name="note" maxLength={NOTE_MAX_LENGTH} className={field} />
              </label>
              <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white sm:col-span-2">
                קביעה
              </button>
            </form>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
