import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { InjuryStatusBadge, shortDate } from "@/components/InjuryStatusBadge";
import { addInjuryAction, deleteInjuryAction, updateInjuryAction } from "@/app/admin/injuries/actions";
import { requireRole, type CurrentAdmin } from "@/lib/auth";
import {
  BODY_PARTS,
  INJURY_STATUSES,
  INJURY_STATUS_HINTS,
  INJURY_STATUS_LABELS,
  NOTE_MAX_LENGTH,
  daysOut,
  isInjuryStatus,
  isOpenStatus,
  isReturnOverdue,
  nextStatuses,
  sortInjuries,
  toCoachView,
  todayInIsrael,
} from "@/lib/injuries";
import { getInjuryDetail, listInjuries, listPlayers, type InjuryRow } from "@/lib/injuries-db";
import { USER_ROLES, isManager } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "מעקב פצועים · מצב מנהל" };

type Params = { error?: string; done?: string; injury?: string; team?: string; status?: string; closed?: string };
type Props = { searchParams: Promise<Params> };

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
const card = "rounded-2xl bg-white shadow-sm ring-1 ring-black/5";
const heading = "text-lg font-black text-[#8e0b20]";
const cell = "px-3 py-2.5 text-start align-top";

function Messages({ error, done }: { error?: string; done?: string }) {
  return (
    <>
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
    </>
  );
}

export default async function InjuriesPage({ searchParams }: Props) {
  const user = await requireRole(USER_ROLES);
  const params = await searchParams;
  const today = todayInIsrael();
  if (user.role === "coach") return <CoachInjuries user={user} today={today} />;
  return <AllInjuries user={user} params={params} today={today} />;
}

/** A coach sees the status and expected return of their own players only. */
async function CoachInjuries({ user, today }: { user: CurrentAdmin; today: string }) {
  const rows =
    user.staffId != null
      ? sortInjuries(await listInjuries({ today, coachStaffId: user.staffId }), today).map(toCoachView)
      : [];

  return (
    <AdminShell user={user} title="הפצועים שלי" current="/admin/injuries">
      {user.staffId == null ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
          המשתמש שלך עוד לא משויך למאמן ברשימת המאמנים. פנו למנהל המחלקה.
        </p>
      ) : null}
      <section className={card}>
        <h2 className={`border-b border-zinc-100 px-5 py-3 ${heading}`}>שחקנים שלי שלא כשירים ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-600">כרגע אין שחקנים פצועים אצלך.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className={cell}>שחקן</th>
                  <th className={cell}>קבוצה</th>
                  <th className={cell}>סטטוס</th>
                  <th className={cell}>צפי חזרה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={`${cell} font-bold`}>{row.playerName}</td>
                    <td className={cell}>{row.teamName}</td>
                    <td className={cell}>
                      <InjuryStatusBadge status={row.status} />
                      <span className="ms-2 text-xs text-zinc-500">{INJURY_STATUS_HINTS[row.status]}</span>
                    </td>
                    <td className={cell}>{row.expectedReturn ? shortDate(row.expectedReturn) : "לא נקבע"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-zinc-500">פרטי הפציעה והטיפולים גלויים רק להנהלה ולפיזיותרפיסט.</p>
    </AdminShell>
  );
}

/** Managers and the physio: every injury, with details, history and the update form. */
async function AllInjuries({ user, params, today }: { user: CurrentAdmin; params: Params; today: string }) {
  const includeClosed = params.closed === "1";
  const teamFilter = Number(params.team) || undefined;
  const statusFilter = isInjuryStatus(params.status) ? params.status : undefined;
  const selectedId = Number(params.injury) || undefined;

  const [allRows, players] = await Promise.all([
    listInjuries({ today, includeClosed: includeClosed || statusFilter === "fit" || selectedId != null }),
    listPlayers(),
  ]);
  const rows = sortInjuries(
    allRows.filter(
      (row) =>
        (includeClosed || statusFilter === "fit" || isOpenStatus(row.status)) &&
        (!teamFilter || row.teamId === teamFilter) &&
        (!statusFilter || row.status === statusFilter),
    ),
    today,
  );
  const open = allRows.filter((row) => isOpenStatus(row.status));
  const overdue = open.filter((row) => isReturnOverdue(row, today));
  const selected = selectedId ? allRows.find((row) => row.id === selectedId) : undefined;
  const detail = selected ? await getInjuryDetail(selected.id) : null;

  const teams = [...new Map(players.map((p) => [p.teamId, p.teamName])).entries()];

  return (
    <AdminShell user={user} title="מעקב פצועים" current="/admin/injuries">
      <Messages error={params.error} done={params.done} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {INJURY_STATUSES.filter(isOpenStatus).map((status) => (
          <Link
            key={status}
            href={`/admin/injuries?status=${status}`}
            className={`${card} px-4 py-3 hover:ring-[#c8102e]/40`}
          >
            <p className="text-3xl font-black">{open.filter((row) => row.status === status).length}</p>
            <p className="text-sm font-bold text-zinc-700">{INJURY_STATUS_LABELS[status]}</p>
          </Link>
        ))}
        <div className={`${card} px-4 py-3 ${overdue.length ? "ring-2 ring-amber-300" : ""}`}>
          <p className="text-3xl font-black">{overdue.length}</p>
          <p className="text-sm font-bold text-zinc-700">צפי חזרה עבר</p>
        </div>
      </section>

      {selected && detail ? <InjuryDetail user={user} injury={selected} detail={detail} today={today} /> : null}

      <section className={card}>
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className={heading}>פצועים ({rows.length})</h2>
          <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
            <select name="team" defaultValue={teamFilter ?? ""} className="rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="">כל הקבוצות</option>
              {teams.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={statusFilter ?? ""} className="rounded-md border border-zinc-300 px-2 py-1.5">
              <option value="">כל הסטטוסים</option>
              {INJURY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {INJURY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 font-bold">
              <input type="checkbox" name="closed" value="1" defaultChecked={includeClosed} />
              גם פציעות שנסגרו
            </label>
            <button type="submit" className="rounded-md px-3 py-1.5 font-bold ring-1 ring-zinc-300 hover:bg-zinc-50">
              סינון
            </button>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-600">אין פצועים שמתאימים לסינון.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className={cell}>שחקן</th>
                  <th className={cell}>קבוצה</th>
                  <th className={cell}>מקום</th>
                  <th className={cell}>נפצע</th>
                  <th className={cell}>ימים בחוץ</th>
                  <th className={cell}>סטטוס</th>
                  <th className={cell}>צפי חזרה</th>
                  <th className={cell}>טיפול הבא</th>
                  <th className={cell}>מאמן</th>
                  <th className={cell} />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => {
                  const late = isReturnOverdue(row, today);
                  return (
                    <tr key={row.id} className={row.id === selectedId ? "bg-[#fff1ef]" : undefined}>
                      <td className={`${cell} font-bold`}>{row.playerName}</td>
                      <td className={cell}>{row.teamName}</td>
                      <td className={cell}>{row.bodyPart}</td>
                      <td className={cell}>{shortDate(row.injuredAt)}</td>
                      <td className={cell}>{daysOut(row, today)}</td>
                      <td className={cell}>
                        <InjuryStatusBadge status={row.status} />
                      </td>
                      <td className={`${cell} ${late ? "font-bold text-amber-800" : ""}`}>
                        {row.expectedReturn ? shortDate(row.expectedReturn) : "—"}
                        {late ? <span className="ms-1 text-xs">(עבר)</span> : null}
                      </td>
                      <td className={cell}>
                        {row.nextSession ? `${shortDate(row.nextSession.date)} ${row.nextSession.startTime}` : isOpenStatus(row.status) ? "לא נקבע" : "—"}
                      </td>
                      <td className={cell}>{row.coachName ?? "לא משויך"}</td>
                      <td className={cell}>
                        <Link
                          href={`/admin/injuries?injury=${row.id}`}
                          className="rounded-md px-2.5 py-1 text-sm font-bold ring-1 ring-zinc-300 hover:bg-zinc-50"
                        >
                          פרטים
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`max-w-3xl p-5 ${card}`}>
        <h2 className={heading}>רישום פציעה חדשה</h2>
        {players.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">
            אין עדיין שחקנים במערכת. מוסיפים אותם ב<Link href="/admin/players" className="font-bold underline">שחקנים ומאמנים</Link>.
          </p>
        ) : (
          <form action={addInjuryAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
              שחקן
              <select name="playerId" className={field} required defaultValue="">
                <option value="" disabled>
                  בחירת שחקן
                </option>
                {teams.map(([teamId, teamName]) => (
                  <optgroup key={teamId} label={teamName}>
                    {players
                      .filter((player) => player.teamId === teamId)
                      .map((player) => (
                        <option key={player.id} value={player.id} disabled={player.hasOpenInjury}>
                          {player.name}
                          {player.hasOpenInjury ? " (כבר פצוע)" : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              תאריך פציעה
              <input name="injuredAt" type="date" max={today} defaultValue={today} className={field} required />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              מקום הפציעה
              <select name="bodyPart" className={field} required defaultValue="">
                <option value="" disabled>
                  בחירה
                </option>
                {BODY_PARTS.map((part) => (
                  <option key={part} value={part}>
                    {part}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              צפי חזרה (לא חובה)
              <input name="expectedReturn" type="date" min={today} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              הערה קצרה (לא חובה)
              <input name="note" maxLength={NOTE_MAX_LENGTH} className={field} placeholder="בלי פרטים רפואיים" />
            </label>
            <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white sm:col-span-2">
              רישום
            </button>
          </form>
        )}
      </section>
    </AdminShell>
  );
}

function InjuryDetail({
  user,
  injury,
  detail,
  today,
}: {
  user: CurrentAdmin;
  injury: InjuryRow;
  detail: Awaited<ReturnType<typeof getInjuryDetail>>;
  today: string;
}) {
  const closed = !isOpenStatus(injury.status);
  const options = [injury.status, ...nextStatuses(injury.status)];
  return (
    <section className={`${card} p-5`} id="injury">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={heading}>
          {injury.playerName} · {injury.teamName}
        </h2>
        <Link href="/admin/injuries" className="text-sm font-bold text-zinc-600 underline">
          סגירת הפרטים
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-700">
        {injury.bodyPart} · נפצע ב-{shortDate(injury.injuredAt)} · {daysOut(injury, today)} ימים בחוץ · מאמן:{" "}
        {injury.coachName ?? "לא משויך"}
      </p>
      {injury.note ? <p className="mt-1 text-sm text-zinc-600">הערה: {injury.note}</p> : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-black">עדכון</h3>
          {closed ? (
            <p className="mt-2 text-sm text-zinc-600">הפציעה נסגרה. פציעה חדשה של השחקן נרשמת בטופס למטה.</p>
          ) : (
            <form action={updateInjuryAction} className="mt-2 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={injury.id} />
              <label className="flex flex-col gap-1 text-sm font-bold">
                סטטוס
                <select name="status" defaultValue={injury.status} className={field}>
                  {options.map((status) => (
                    <option key={status} value={status}>
                      {INJURY_STATUS_LABELS[status]}
                      {status === injury.status ? " (נוכחי)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                צפי חזרה
                <input
                  name="expectedReturn"
                  type="date"
                  min={injury.injuredAt}
                  defaultValue={injury.expectedReturn ?? ""}
                  className={field}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold sm:col-span-2">
                הערה לעדכון (לא חובה)
                <input name="note" maxLength={NOTE_MAX_LENGTH} className={field} />
              </label>
              <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] font-black text-white sm:col-span-2">
                שמירה
              </button>
            </form>
          )}
          {!closed ? (
            <Link
              href={`/admin/physio?injury=${injury.id}#new`}
              className="mt-3 inline-block rounded-md px-3 py-1.5 text-sm font-bold ring-1 ring-zinc-300 hover:bg-zinc-50"
            >
              קביעת טיפול פיזיו
            </Link>
          ) : null}
          {isManager(user.role) ? (
            <form action={deleteInjuryAction} className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="id" value={injury.id} />
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="confirm" value="1" />
                נרשם בטעות
              </label>
              <button type="submit" className="rounded-md px-2.5 py-1 font-bold text-red-700 ring-1 ring-zinc-300 hover:bg-red-50">
                מחיקת הפציעה
              </button>
            </form>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-black">היסטוריה</h3>
            <ol className="mt-2 flex flex-col gap-2 text-sm">
              {detail.changes.map((change) => (
                <li key={change.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                  <p>
                    <span className="font-bold">{new Date(change.at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}</span>
                    {" · "}
                    {change.fromStatus && change.fromStatus !== change.toStatus
                      ? `${INJURY_STATUS_LABELS[change.fromStatus]} ← ${INJURY_STATUS_LABELS[change.toStatus]}`
                      : INJURY_STATUS_LABELS[change.toStatus]}
                    {" · "}
                    {change.changedByName}
                  </p>
                  {change.note ? <p className="text-zinc-600">{change.note}</p> : null}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-black">טיפולים ({detail.sessions.length})</h3>
            {detail.sessions.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-600">עוד לא נקבעו טיפולים.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {detail.sessions.map((session) => (
                  <li key={session.id}>
                    {shortDate(session.date)} {session.startTime} · {session.durationMinutes} דק׳ · {session.physioName} ·{" "}
                    {session.status === "done" ? "בוצע" : session.status === "cancelled" ? "בוטל" : "מתוכנן"}
                    {session.note ? <span className="text-zinc-600"> · {session.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
