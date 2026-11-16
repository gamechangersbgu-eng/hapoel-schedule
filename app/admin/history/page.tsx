import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db, scheduleChanges, teams as teamsTable } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "היסטוריית שינויים · מצב מנהל" };

type Props = { searchParams: Promise<{ team?: string }> };

const ACTION: Record<string, { label: string; tone: string }> = {
  create: { label: "נוסף", tone: "bg-emerald-100 text-emerald-900" },
  update: { label: "עודכן", tone: "bg-sky-100 text-sky-900" },
  game: { label: "משחק", tone: "bg-sky-100 text-sky-900" },
  delete: { label: "נמחק", tone: "bg-red-100 text-red-900" },
  cancel: { label: "בוטל", tone: "bg-zinc-800 text-white" },
  copy_week: { label: "העתקת שבוע", tone: "bg-violet-100 text-violet-900" },
  lock: { label: "שריון", tone: "bg-amber-100 text-amber-900" },
  bank: { label: "רשימות", tone: "bg-zinc-100 text-zinc-800" },
  coach: { label: "מאמנים", tone: "bg-zinc-100 text-zinc-800" },
  maintenance: { label: "כיסוח וסימון", tone: "bg-lime-100 text-lime-900" },
};

function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
}

export default async function HistoryPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const { team } = await searchParams;
  const teamId = Number(team) || null;
  const [rows, teamRows] = await Promise.all([
    db
      .select()
      .from(scheduleChanges)
      .where(teamId ? eq(scheduleChanges.teamId, teamId) : undefined)
      .orderBy(desc(scheduleChanges.at))
      .limit(300),
    db.select().from(teamsTable).orderBy(asc(teamsTable.sortOrder)),
  ]);
  const teamName = Object.fromEntries(teamRows.map((row) => [row.id, row.name]));

  return (
    <AdminShell user={user} title="היסטוריית שינויים" current="/admin/history">
      <form className="flex flex-wrap items-center gap-2" action="/admin/history">
        <label className="flex items-center gap-2 text-sm font-bold">
          קבוצה
          <select name="team" defaultValue={teamId ?? ""} className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm">
            <option value="">כל השינויים</option>
            {teamRows.filter((row) => !row.isComments).map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md px-3 py-1.5 text-sm font-bold ring-1 ring-zinc-300 hover:bg-white">הצגה</button>
        {teamId ? <Link href="/admin/history" className="text-sm font-bold text-zinc-600 underline">ניקוי</Link> : null}
      </form>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {rows.length === 0 ? <p className="px-5 py-6 text-center text-zinc-600">עוד אין שינויים רשומים.</p> : null}
        <ol className="divide-y divide-zinc-100">
          {rows.map((row) => {
            const action = ACTION[row.action] ?? { label: row.action, tone: "bg-zinc-100 text-zinc-800" };
            return (
              <li key={row.id} className="flex flex-col gap-1 px-5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-zinc-500">{when(row.at)}</span>
                <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${action.tone}`}>{action.label}</span>
                <span className="flex-1 text-sm">
                  {row.summary}
                  {row.teamId && teamName[row.teamId] && !row.summary.includes(teamName[row.teamId]) ? ` · ${teamName[row.teamId]}` : ""}
                </span>
                <span className="shrink-0 text-xs font-bold text-zinc-600">{row.adminName}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </AdminShell>
  );
}
