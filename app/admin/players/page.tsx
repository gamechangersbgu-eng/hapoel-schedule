import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { AdminShell } from "@/components/AdminShell";
import {
  addPlayerAction,
  assignDefaultCoachesAction,
  removePlayerAction,
  saveTeamCoachesAction,
  setPlayerActiveAction,
} from "@/app/admin/players/actions";
import { requireAdmin } from "@/lib/auth";
import { db, players, teams } from "@/lib/db";
import { listCoachOptions } from "@/lib/injuries-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שחקנים ומאמנים · מצב מנהל" };

type Props = { searchParams: Promise<{ error?: string; done?: string; team?: string }> };

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
const card = "rounded-2xl bg-white shadow-sm ring-1 ring-black/5";
const heading = "text-lg font-black text-[#8e0b20]";
const small = "rounded-md px-2.5 py-1.5 text-sm font-bold ring-1 ring-zinc-300 hover:bg-zinc-50";

export default async function PlayersPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const params = await searchParams;
  const [teamRows, playerRows, coaches] = await Promise.all([
    db.select().from(teams).where(eq(teams.isComments, false)).orderBy(asc(teams.sortOrder)),
    db.select().from(players).orderBy(asc(players.sortOrder), asc(players.displayName)),
    listCoachOptions(),
  ]);
  const active = playerRows.filter((player) => player.isActive);
  const removed = playerRows.filter((player) => !player.isActive);
  const unassigned = active.filter((player) => player.coachStaffId == null).length;
  const teamsWithPlayers = teamRows.filter((team) => active.some((player) => player.teamId === team.id));
  const openTeam = Number(params.team) || undefined;

  return (
    <AdminShell user={user} title="שחקנים ומאמנים" current="/admin/players">
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

      <section className={`${card} flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <h2 className={heading}>
            {active.length} שחקנים · {unassigned} בלי מאמן אישי
          </h2>
          <p className="text-sm text-zinc-600">
            המאמן האישי רואה את סטטוס הפציעה של השחקן (בלי פרטים) כשהוא נכנס עם משתמש מאמן.
          </p>
        </div>
        {unassigned > 0 ? (
          <form action={assignDefaultCoachesAction}>
            <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] px-4 font-black text-white">
              שיוך כולם למאמן הראשי של הקבוצה
            </button>
          </form>
        ) : null}
      </section>

      {teamsWithPlayers.length === 0 ? (
        <p className={`${card} px-5 py-4 text-sm text-zinc-600`}>אין עדיין שחקנים. מוסיפים בטופס למטה.</p>
      ) : null}

      {teamsWithPlayers.map((team) => {
        const roster = active.filter((player) => player.teamId === team.id);
        const teamCoachList = coaches.filter((coach) => coach.teamIds.includes(team.id));
        const otherCoaches = coaches.filter((coach) => !coach.teamIds.includes(team.id));
        const missing = roster.filter((player) => player.coachStaffId == null).length;
        return (
          <details key={team.id} className={card} open={openTeam === team.id || teamsWithPlayers.length === 1}>
            <summary className="cursor-pointer px-5 py-3 text-base font-black">
              {team.name} · {roster.length} שחקנים
              {missing ? <span className="ms-2 text-sm font-bold text-amber-800">({missing} בלי מאמן)</span> : null}
            </summary>
            <form action={saveTeamCoachesAction} className="border-t border-zinc-100 px-5 py-3">
              <input type="hidden" name="teamId" value={team.id} />
              <ul className="divide-y divide-zinc-100">
                {roster.map((player) => (
                  <li key={player.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-bold">{player.displayName}</span>
                    <div className="flex items-center gap-2">
                      <select
                        name={`coach_${player.id}`}
                        defaultValue={player.coachStaffId ?? ""}
                        aria-label={`המאמן של ${player.displayName}`}
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">בלי מאמן</option>
                        {teamCoachList.length ? (
                          <optgroup label="מאמני הקבוצה">
                            {teamCoachList.map((coach) => (
                              <option key={coach.staffId} value={coach.staffId}>
                                {coach.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {otherCoaches.length ? (
                          <optgroup label="מאמנים אחרים">
                            {otherCoaches.map((coach) => (
                              <option key={coach.staffId} value={coach.staffId}>
                                {coach.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                      <button
                        type="submit"
                        formAction={removePlayerAction.bind(null, player.id)}
                        className={`${small} text-red-700`}
                      >
                        הסרה
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="submit" className="mt-3 min-h-10 rounded-lg bg-[#c8102e] px-4 font-black text-white">
                שמירת השיוך
              </button>
            </form>
          </details>
        );
      })}

      <section className={`max-w-2xl p-5 ${card}`}>
        <h2 className={heading}>הוספת שחקן</h2>
        <p className="mt-1 text-sm text-zinc-600">השחקן משויך אוטומטית למאמן הראשי של הקבוצה. אפשר לשנות אחר כך.</p>
        <form action={addPlayerAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-bold">
            שם מלא
            <input name="displayName" className={field} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            קבוצה
            <select name="teamId" className={field} required defaultValue={openTeam ?? ""}>
              <option value="" disabled>
                בחירה
              </option>
              {teamRows.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            תאריך לידה (לא חובה)
            <input name="birthDate" type="date" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            טלפון הורה (לא חובה)
            <input name="parentPhone" type="tel" dir="ltr" className={field} />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-[#c8102e] text-base font-black text-white sm:col-span-2">
            הוספה
          </button>
        </form>
      </section>

      {removed.length ? (
        <details className={card}>
          <summary className="cursor-pointer px-5 py-3 text-base font-black">שחקנים שהוסרו ({removed.length})</summary>
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100 px-5">
            {removed.map((player) => (
              <li key={player.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {player.displayName} · {teamRows.find((team) => team.id === player.teamId)?.name}
                </span>
                <form action={setPlayerActiveAction}>
                  <input type="hidden" name="id" value={player.id} />
                  <input type="hidden" name="active" value="1" />
                  <button type="submit" className={small}>
                    החזרה
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </AdminShell>
  );
}
