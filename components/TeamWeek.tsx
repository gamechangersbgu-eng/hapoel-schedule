"use client";

// Phone view: pick your team once (remembered on this device) and see its week.
// Layout: team + week, a big "today" block, the rest of the week (empty days on one line),
// past days folded away, and week navigation at the bottom within thumb reach (swipe works too).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  HEBREW_DAY_NAMES,
  kindLabel,
  regularTeams,
  slotsForDay,
  timeLabel,
  todayISO,
} from "@/components/display-utils";
import { getSlotType, isCampSlot } from "@/lib/slot-types";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import {
  addDaysISO,
  currentWeekStart,
  formatDayMonth,
  formatWeekRange,
} from "@/lib/week";

const MY_TEAM_KEY = "hapoel-schedule-my-team-v1";

function readSavedTeam(): number | null {
  try {
    const value = Number(window.localStorage.getItem(MY_TEAM_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveTeam(id: number) {
  try {
    window.localStorage.setItem(MY_TEAM_KEY, String(id));
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

function weekHref(weekStart: string) {
  return `/?week=${weekStart}`;
}

function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "בעוד 45 דקות", "בעוד 3 שעות", or null when the time has passed / is unknown. */
function countdown(slot: SlotDTO, now: Date): string | null {
  if (!slot.startTime) return null;
  const diff = minutesOf(slot.startTime) - (now.getHours() * 60 + now.getMinutes());
  if (diff <= 0) return null;
  if (diff < 60) return `בעוד ${diff} דקות`;
  const hours = Math.round(diff / 60);
  return hours === 1 ? "בעוד שעה" : hours === 2 ? "בעוד שעתיים" : `בעוד ${hours} שעות`;
}

function GameBadge({ type }: { type: string }) {
  if (type === "home_game") {
    return (
      <span className="rounded-full bg-[#c8102e] px-2 py-0.5 text-xs font-bold text-white">
        משחק בית
      </span>
    );
  }
  if (type === "away_game") {
    return (
      <span className="rounded-full bg-[#0277bd] px-2 py-0.5 text-xs font-bold text-white">
        משחק חוץ
      </span>
    );
  }
  return null;
}

/** Spoken description for screen readers, e.g. "אימון · וסרמיל 1, 17:30". */
function spoken(slot: SlotDTO) {
  return [kindLabel(slot), timeLabel(slot), slot.note].filter(Boolean).join(", ");
}

function SlotCard({ slot }: { slot: SlotDTO }) {
  const style = getSlotType(slot.type);
  const time = timeLabel(slot);
  const isGame = slot.type === "home_game" || slot.type === "away_game";
  return (
    <li
      aria-label={spoken(slot)}
      className="flex items-stretch overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
    >
      <span aria-hidden className="w-1.5 shrink-0" style={{ background: style.bg }} />
      <div aria-hidden className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
        <span
          dir="ltr"
          className="w-[4.5rem] shrink-0 text-right text-lg font-black tabular-nums text-[#1a1214] dark:text-white"
        >
          {time ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isGame ? (
              <GameBadge type={slot.type} />
            ) : (
              <span className="text-base font-bold leading-snug dark:text-white">{kindLabel(slot)}</span>
            )}
          </div>
          {slot.note ? (
            <p className="mt-0.5 text-[15px] leading-snug text-zinc-600 dark:text-zinc-300">{slot.note}</p>
          ) : null}
          {isCampSlot(slot.type) && slot.endDate && slot.endDate !== slot.date ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatDayMonth(slot.date)} – {formatDayMonth(slot.endDate)}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** First upcoming activity from `fromDate` on (skips days off and things already over today). */
function nextActivity(data: WeekData, teamId: number, today: string, now: Date) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const date of data.dates) {
    if (date < today) continue;
    const upcoming = slotsForDay(data.slots, teamId, date).filter(
      (slot) =>
        slot.type !== "off" &&
        (date > today || isCampSlot(slot.type) || !slot.startTime || minutesOf(slot.startTime) > nowMinutes),
    );
    if (upcoming.length) return { slot: upcoming[0], date };
  }
  return null;
}

function Notes({ notes }: { notes: SlotDTO[] }) {
  return (
    <>
      {notes.map((note) => (
        <p
          key={note.id}
          className="rounded-xl bg-[#f4e6e8] px-3 py-2 text-[15px] font-medium text-[#5c0814] dark:bg-[#3a0710] dark:text-[#f4e6e8]"
        >
          <span className="font-bold">הודעה: </span>
          {note.note || kindLabel(note)}
        </p>
      ))}
    </>
  );
}

type Day = { date: string; index: number; items: SlotDTO[]; notes: SlotDTO[] };

/** Big "today" block: what's on today, or else when the next activity is. */
function TodayBlock({
  day,
  data,
  teamId,
  today,
  now,
}: {
  day: Day;
  data: WeekData;
  teamId: number;
  today: string;
  now: Date;
}) {
  const next = day.items.length ? null : nextActivity(data, teamId, today, now);
  return (
    <section
      id={`day-${day.date}`}
      aria-label="היום"
      className="overflow-hidden rounded-2xl bg-white shadow-md ring-2 ring-[#c8102e] dark:bg-zinc-900"
    >
      <div className="flex items-baseline justify-between bg-[#c8102e] px-4 py-3 text-white">
        <h2 className="text-2xl font-black">היום</h2>
        <p className="text-base font-bold text-white/90">
          יום {HEBREW_DAY_NAMES[day.index]} · {formatDayMonth(day.date)}
        </p>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {day.items.length ? (
          <div className="flex flex-col gap-2">
            {day.items.map((slot) => {
              const soon = countdown(slot, now);
              return (
                <div key={slot.id} className="flex flex-col gap-1">
                  <ul>
                    <SlotCard slot={slot} />
                  </ul>
                  {soon ? (
                    <p className="ps-2 text-sm font-bold text-[#c8102e] dark:text-[#ff8a9a]">{soon}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-1 py-2 text-lg font-bold text-zinc-700 dark:text-zinc-200">אין פעילות היום.</p>
        )}
        {next ? (
          <p className="px-1 text-base text-zinc-600 dark:text-zinc-300">
            הבא:{" "}
            <span className="font-bold text-[#1a1214] dark:text-white">
              {next.date === addDaysISO(today, 1) ? "מחר" : `יום ${HEBREW_DAY_NAMES[data.dates.indexOf(next.date)]}`}
              {next.slot.startTime ? (
                <>
                  {" "}
                  <span dir="ltr" className="tabular-nums">
                    {timeLabel(next.slot)}
                  </span>
                </>
              ) : null}
              {" · "}
              {kindLabel(next.slot)}
            </span>
          </p>
        ) : null}
        <Notes notes={day.notes} />
      </div>
    </section>
  );
}

/** One day in the list. Empty days are a single line with the day and "אין פעילות" side by side. */
function DayRow({ day }: { day: Day }) {
  const title = `יום ${HEBREW_DAY_NAMES[day.index]}`;
  if (day.items.length === 0 && day.notes.length === 0) {
    return (
      <li id={`day-${day.date}`} className="px-1 py-1 text-base text-zinc-500 dark:text-zinc-400">
        <span className="font-bold text-zinc-700 dark:text-zinc-300">{title}</span> {formatDayMonth(day.date)}
        {" — "}אין פעילות
      </li>
    );
  }
  return (
    <li id={`day-${day.date}`} className="flex flex-col gap-2">
      <h3 className="px-1 text-lg font-extrabold dark:text-white">
        {title} <span className="text-base font-semibold text-zinc-500 dark:text-zinc-400">{formatDayMonth(day.date)}</span>
      </h3>
      {day.items.length ? (
        <ul className="flex flex-col gap-2">
          {day.items.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </ul>
      ) : null}
      <Notes notes={day.notes} />
    </li>
  );
}

function TeamPicker({
  teams,
  current,
  onChoose,
  onCancel,
}: {
  teams: TeamDTO[];
  current: number | null;
  onChoose: (id: number) => void;
  onCancel?: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-black text-[#5c0814] dark:text-white">באיזו קבוצה אתם?</h2>
        <p className="text-base text-zinc-600 dark:text-zinc-300">
          נשמור את הבחירה בטלפון, ובפעם הבאה הלו״ז שלכם יופיע מיד.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {teams.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChoose(item.id)}
            aria-pressed={item.id === current}
            className={`min-h-14 rounded-xl px-3 py-2 text-lg font-bold shadow-sm ring-1 transition ${
              item.id === current
                ? "bg-[#c8102e] text-white ring-[#c8102e]"
                : "bg-white text-[#5c0814] ring-[#d7b4b8] active:bg-[#f4e6e8] dark:bg-zinc-900 dark:text-white dark:ring-white/15"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="self-center px-4 py-3 text-base font-bold text-zinc-600 underline dark:text-zinc-300"
        >
          ביטול
        </button>
      ) : null}
    </section>
  );
}

export function TeamWeek({ data }: { data: WeekData }) {
  const router = useRouter();
  const teams = useMemo(() => regularTeams(data.teams), [data.teams]);
  const commentsTeam = data.teams.find((team) => team.isComments);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // localStorage and the clock only exist in the browser, so read them after mounting.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after mount
    setTeamId(readSavedTeam());
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) return <div className="min-h-[60vh]" />;

  const today = todayISO();
  const thisWeek = currentWeekStart();
  const team = teams.find((item) => item.id === teamId) ?? null;

  function choose(id: number) {
    setTeamId(id);
    saveTeam(id);
    setPicking(false);
    window.scrollTo({ top: 0 });
  }

  if (!team || picking) {
    return (
      <TeamPicker
        teams={teams}
        current={teamId}
        onChoose={choose}
        onCancel={team ? () => setPicking(false) : undefined}
      />
    );
  }

  const prevWeek = addDaysISO(data.weekStart, -7);
  const nextWeek = addDaysISO(data.weekStart, 7);
  const isThisWeek = data.weekStart === thisWeek;

  // Swipe between weeks: finger to the right = next week (Hebrew reading direction).
  function onTouchStart(event: TouchEvent) {
    const t = event.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(event: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    router.push(weekHref(dx > 0 ? nextWeek : prevWeek));
  }

  const days: Day[] = data.dates.map((date, index) => ({
    date,
    index,
    items: slotsForDay(data.slots, team.id, date),
    notes: commentsTeam ? slotsForDay(data.slots, commentsTeam.id, date) : [],
  }));
  const todayDay = isThisWeek ? days.find((day) => day.date === today) : undefined;
  const past = isThisWeek ? days.filter((day) => day.date < today) : [];
  const upcoming = isThisWeek ? days.filter((day) => day.date > today) : days;

  return (
    <div className="team-week flex flex-col gap-4 pb-24" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-11 items-center gap-1.5 rounded-lg text-2xl font-black text-[#5c0814] dark:text-white"
          aria-label={`הקבוצה שלי: ${team.name}. לחצו להחלפת קבוצה`}
        >
          {team.name}
          <span aria-hidden className="text-sm text-[#c8102e]">▼</span>
        </button>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          שבוע {data.weekNumber} · <bdi>{formatWeekRange(data.weekStart)}</bdi>
        </p>
      </div>

      {todayDay ? (
        <TodayBlock day={todayDay} data={data} teamId={team.id} today={today} now={now} />
      ) : null}

      {upcoming.length ? (
        <section className="flex flex-col gap-3">
          {isThisWeek ? (
            <h2 className="px-1 text-base font-black tracking-wide text-[#8e0b20] dark:text-[#ff8a9a]">
              בהמשך השבוע
            </h2>
          ) : null}
          <ol className="flex flex-col gap-3">
            {upcoming.map((day) => (
              <DayRow key={day.date} day={day} />
            ))}
          </ol>
        </section>
      ) : isThisWeek ? (
        <p className="px-1 text-base text-zinc-600 dark:text-zinc-300">
          זה היום האחרון בשבוע. לשבוע הבא, בכפתור למטה.
        </p>
      ) : null}

      {past.length ? (
        <section className="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            aria-expanded={showPast}
            className="flex min-h-11 items-center gap-2 px-1 text-base font-bold text-zinc-500 dark:text-zinc-400"
          >
            <span aria-hidden>{showPast ? "▲" : "▼"}</span>
            {showPast ? "הסתרת הימים שעברו" : `הימים שעברו השבוע (${past.length})`}
          </button>
          {showPast ? (
            <ol className="flex flex-col gap-3 opacity-60">
              {past.map((day) => (
                <DayRow key={day.date} day={day} />
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      {/* Week navigation within thumb reach */}
      <nav
        aria-label="ניווט בין שבועות"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-zinc-950/95"
      >
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <Link
            href={weekHref(prevWeek)}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#f4e6e8] text-base font-bold text-[#5c0814] dark:bg-zinc-800 dark:text-white"
          >
            → שבוע קודם
          </Link>
          {!isThisWeek ? (
            <Link
              href={weekHref(thisWeek)}
              className="flex min-h-12 items-center justify-center rounded-xl bg-[#c8102e] px-4 text-base font-bold text-white"
            >
              השבוע
            </Link>
          ) : null}
          <Link
            href={weekHref(nextWeek)}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#f4e6e8] text-base font-bold text-[#5c0814] dark:bg-zinc-800 dark:text-white"
          >
            שבוע הבא ←
          </Link>
        </div>
      </nav>
    </div>
  );
}
