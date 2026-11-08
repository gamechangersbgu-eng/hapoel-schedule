import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { GameForm } from "@/components/GameForm";
import { HEBREW_DAY_NAMES } from "@/components/display-utils";
import { requireAdmin } from "@/lib/auth";
import { gameWarnings, getGamesWeek } from "@/lib/games";
import { addDaysISO, formatDayMonth, formatWeekRange, resolveWeekStart } from "@/lib/week";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "משחקים · מצב מנהל" };

type Props = { searchParams: Promise<{ week?: string; edit?: string; new?: string; error?: string; saved?: string }> };

export default async function GamesPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const params = await searchParams;
  const weekStart = resolveWeekStart(params.week);
  const week = await getGamesWeek(weekStart);
  const warnings = gameWarnings(week);
  const base = `/admin/games?week=${weekStart}`;
  const editing = params.edit ? week.games.find((game) => game.slotId === Number(params.edit)) : undefined;
  const name = <T extends { id: number; name: string }>(rows: T[], id: number | null) => rows.find((r) => r.id === id);

  return (
    <AdminShell user={user} title="משחקים" current="/admin/games">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-2" aria-label="בחירת שבוע">
          <Link href={`/admin/games?week=${addDaysISO(weekStart, -7)}`} className="rounded-lg px-3 py-2 text-sm font-bold ring-1 ring-[#d7b4b8] hover:bg-white">→ שבוע קודם</Link>
          <span className="px-2 text-base font-black"><bdi>{formatWeekRange(weekStart)}</bdi></span>
          <Link href={`/admin/games?week=${addDaysISO(weekStart, 7)}`} className="rounded-lg px-3 py-2 text-sm font-bold ring-1 ring-[#d7b4b8] hover:bg-white">שבוע הבא ←</Link>
        </nav>
        <Link href={`${base}&new=1`} className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-black text-white">+ משחק חדש</Link>
      </div>

      {params.saved ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">המשחק נשמר.</p>
      ) : null}

      {week.games.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-zinc-600">אין משחקים בשבוע הזה.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        {week.dates.map((date, index) => {
          const games = week.games.filter((game) => game.date === date);
          if (!games.length) return null;
          return (
            <section key={date} className="flex flex-col gap-2">
              <h2 className="text-lg font-black">יום {HEBREW_DAY_NAMES[index]} <span className="text-base font-semibold text-zinc-500">{formatDayMonth(date)}</span></h2>
              <ul className="flex flex-col gap-2">
                {games.map((game) => {
                  const home = game.kind === "home_game";
                  const cancelled = game.status === "cancelled";
                  const issues = cancelled ? [] : warnings[game.slotId] ?? [];
                  const medic = name(week.medics, game.medicId);
                  const driver = name(week.drivers, game.driverId);
                  const city = name(week.cities, game.cityId);
                  const pitch = week.pitches.find((p) => p.id === game.pitchId);
                  return (
                    <li key={game.slotId}>
                      <Link
                        href={`${base}&edit=${game.slotId}`}
                        className={`flex flex-col gap-1.5 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 hover:ring-[#c8102e] sm:flex-row sm:items-center sm:gap-4 ${cancelled ? "opacity-60" : ""}`}
                      >
                        <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-black ${home ? "bg-[#C8102E] text-white" : "bg-[#4FC3F7] text-[#123]"}`}>
                          {home ? "משחק בית" : "משחק חוץ"}
                        </span>
                        <span className="min-w-28 text-base font-black">{game.teamName}</span>
                        <span dir="ltr" className={`text-lg font-black tabular-nums ${cancelled ? "line-through" : ""}`}>{game.kickoff ?? "—"}</span>
                        <span className="flex-1 text-sm text-zinc-700">
                          {game.opponent ? `נגד ${game.opponent}` : "יריבה לא הוזנה"}
                          {home
                            ? ` · ${pitch?.nameHe ?? "מגרש לא נבחר"} · חובש: ${medic?.name ?? "—"}`
                            : ` · ${city?.name ?? "עיר לא נבחרה"} · נהג: ${driver ? `${driver.name} ${driver.phone}` : "—"}${game.departureTime ? ` · יציאה ${game.departureTime}` : ""}`}
                        </span>
                        {cancelled ? <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-black text-white">בוטל</span> : null}
                        {issues.length ? (
                          <span className="text-xs font-bold text-amber-800">⚠ {issues.join(" · ")}</span>
                        ) : !cancelled ? (
                          <span className="text-xs font-bold text-emerald-700">✓ מוכן</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {params.new || editing ? (
        <GameForm key={params.edit ?? "new"} week={week} weekStart={weekStart} game={editing} closeHref={base} error={params.error} />
      ) : null}
    </AdminShell>
  );
}
