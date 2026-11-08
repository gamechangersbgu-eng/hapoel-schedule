"use client";

// Add / edit a home or away game: pitch + medic for home games, city + driver for away games,
// with the departure time worked out live from the club's rules.
import Link from "next/link";
import { useState } from "react";
import { deleteGame, saveGame } from "@/app/admin/games/actions";
import { departureFor } from "@/lib/game-rules";
import type { GameRow, GamesWeek } from "@/lib/games";

export function GameForm({
  week,
  weekStart,
  game,
  closeHref,
  error,
}: {
  week: Pick<GamesWeek, "teams" | "pitches" | "medics" | "drivers" | "cities">;
  weekStart: string;
  game?: GameRow;
  closeHref: string;
  error?: string;
}) {
  const [kind, setKind] = useState<"home_game" | "away_game">(game?.kind ?? "home_game");
  const [teamId, setTeamId] = useState<number>(game?.teamId ?? 0);
  const [date, setDate] = useState(game?.date ?? weekStart);
  const [kickoff, setKickoff] = useState(game?.kickoff ?? "");
  const [cityId, setCityId] = useState<number>(game?.cityId ?? 0);
  const [cancelled, setCancelled] = useState(game?.status === "cancelled");

  const team = week.teams.find((item) => item.id === teamId);
  const city = week.cities.find((item) => item.id === cityId);
  const departure =
    kind === "away_game" && team && city && /^\d{2}:\d{2}$/.test(kickoff)
      ? departureFor({ teamName: team.name, date, kickoff, travelMinutes: city.travelMinutesFromBeerSheva, north: city.northOfHaderaLine })
      : null;

  // Show people who left the bank only if they are already on this game.
  const medics = week.medics.filter((item) => item.isActive || item.id === game?.medicId);
  const drivers = week.drivers.filter((item) => item.isActive || item.id === game?.driverId);

  const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
  const label = "flex flex-col gap-1 text-sm font-bold";

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 sm:items-center sm:p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="game-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between">
          <h2 id="game-title" className="text-xl font-black text-[#8e0b20]">{game ? "עריכת משחק" : "משחק חדש"}</h2>
          <Link href={closeHref} className="rounded-md px-3 py-1.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100">סגור</Link>
        </div>
        {game?.source === "ifa_scraper" ? (
          <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200">
            המשחק נמשך מאתר ההתאחדות. אפשר להוסיף חובש, נהג ועיר. שינוי בשעה או ביריבה עלול להידרס בעדכון הבא מהאתר.
          </p>
        ) : null}

        <form action={saveGame} className="flex flex-col gap-3">
          {game ? <input type="hidden" name="id" value={game.slotId} /> : null}
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="kind" value={kind} />

          <div className="grid grid-cols-2 gap-2">
            {(["home_game", "away_game"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={`min-h-11 rounded-lg text-base font-black ring-1 ${
                  kind === value
                    ? value === "home_game"
                      ? "bg-[#C8102E] text-white ring-[#C8102E]"
                      : "bg-[#4FC3F7] text-[#123] ring-[#4FC3F7]"
                    : "bg-white text-zinc-700 ring-zinc-300"
                }`}
              >
                {value === "home_game" ? "משחק בית" : "משחק חוץ"}
              </button>
            ))}
          </div>

          <label className={label}>
            קבוצה
            <select name="teamId" className={field} value={teamId || ""} onChange={(e) => setTeamId(Number(e.target.value))} required>
              <option value="">בחרו קבוצה</option>
              {week.teams.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              תאריך
              <input type="date" name="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className={label}>
              שעת שריקה
              <input type="time" name="kickoff" step={300} className={`${field} tabular-nums`} value={kickoff} onChange={(e) => setKickoff(e.target.value)} required />
            </label>
          </div>
          <label className={label}>
            יריבה
            <input name="opponent" className={field} defaultValue={game?.opponent ?? ""} placeholder="שם הקבוצה היריבה" />
          </label>

          {kind === "home_game" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                מגרש
                <select name="pitchId" className={field} defaultValue={game?.pitchId ?? ""}>
                  <option value="">בחרו מגרש</option>
                  {week.pitches.filter((p) => p.allowsHomeGames).map((p) => (
                    <option key={p.id} value={p.id}>{p.nameHe}</option>
                  ))}
                </select>
              </label>
              <label className={label}>
                חובש
                <select name="medicId" className={field} defaultValue={game?.medicId ?? ""}>
                  <option value="">עוד לא שובץ</option>
                  {medics.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ""}</option>
                  ))}
                </select>
              </label>
              {medics.length === 0 ? (
                <p className="text-sm text-zinc-500 sm:col-span-2">
                  אין עדיין חובשים. מוסיפים אותם ב<Link href="/admin/banks" className="font-bold underline">חובשים, נהגים וערים</Link>.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                עיר
                <select name="cityId" className={field} value={cityId || ""} onChange={(e) => setCityId(Number(e.target.value))}>
                  <option value="">בחרו עיר</option>
                  {week.cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.travelMinutesFromBeerSheva} דק׳)</option>
                  ))}
                </select>
              </label>
              <label className={label}>
                נהג
                <select name="driverId" className={field} defaultValue={game?.driverId ?? ""}>
                  <option value="">עוד לא שובץ</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>
                  ))}
                </select>
              </label>
              {departure ? (
                <div className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm ring-1 ring-sky-200 sm:col-span-2">
                  <p className="text-base font-black text-sky-950">
                    יציאה מבאר שבע: <span dir="ltr" className="tabular-nums">{departure.departure}</span>
                    <span className="ms-2 text-sm font-bold text-sky-800">(הגעה למגרש עד <span dir="ltr">{departure.arriveBy}</span>)</span>
                  </p>
                  <ul className="mt-1 text-sky-900">
                    {departure.parts.map((part) => (
                      <li key={part.label}>• {part.label}: {part.minutes} דק׳</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 sm:col-span-2">שעת היציאה תחושב אחרי שבוחרים קבוצה, עיר ושעת שריקה.</p>
              )}
            </div>
          )}

          <fieldset className="rounded-lg bg-zinc-50 p-3">
            <legend className="sr-only">סטטוס</legend>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="status" value="cancelled" checked={cancelled} onChange={(e) => setCancelled(e.target.checked)} className="h-4 w-4" />
              המשחק בוטל
            </label>
            {cancelled ? (
              <input name="statusNote" className={`${field} mt-2`} defaultValue={game?.statusNote ?? ""} placeholder="סיבה, תוצג להורים (לא חובה)" />
            ) : null}
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <button type="submit" className="min-h-11 flex-1 rounded-lg bg-[#c8102e] text-base font-black text-white">שמירה</button>
            <Link href={closeHref} className="min-h-11 rounded-lg px-4 py-2.5 text-base font-bold text-zinc-600 ring-1 ring-zinc-300">ביטול</Link>
          </div>
        </form>
        {game ? (
          <form action={deleteGame} className="mt-3 border-t border-zinc-200 pt-3">
            <input type="hidden" name="id" value={game.slotId} />
            <input type="hidden" name="week" value={weekStart} />
            <button type="submit" className="text-sm font-bold text-red-700 underline">מחיקת המשחק</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
