"use client";

// Phone view: pick your team(s) once (remembered on this device) and see their week together.
// More than one team: coaches of several teams, players who also play in the team above,
// parents with children in different age groups.
// Layout: team + week, a big "today" block, the rest of the week (empty days on one line),
// past days folded away, and week navigation at the bottom within thumb reach (swipe works too).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  HEBREW_DAY_NAMES,
  MOBILE_PITCH_FILTERS,
  compareDaySlots,
  kindLabel,
  practiceGameDetail,
  regularTeams,
  slotMatchesPitch,
  slotsForDay,
  timeLabel,
  todayISO,
} from "@/components/display-utils";
import { GameScheduleDetail } from "@/components/GameScheduleDetail";
import { MobileDayNav } from "@/components/MobileDayNav";
import { dayElementId, scrollToDay, todayJump } from "@/lib/mobile-day-nav";
import { applyPushChoice, notificationsAreBlocked, resyncPushIfGranted, takeIosPushHint } from "@/lib/push-client";
import { homeGamePitchText } from "@/lib/game-logistics";
import { getSlotType, isCampSlot } from "@/lib/slot-types";
import {
  alertingTeamIds,
  isTeamAlertOn,
  readTeamAlertPrefs,
  saveTeamAlertPrefs,
  withBell,
  withNewlySelectedTeam,
  type TeamAlertPrefs,
} from "@/lib/team-alerts";
import { readTeamSelection, saveTeamSelection } from "@/lib/team-selection";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import {
  addDaysISO,
  currentWeekStart,
  formatDayMonth,
  formatISODate,
  formatWeekRange,
  parseISODate,
  sundayOf,
} from "@/lib/week";

/** All items of the chosen teams on a day. Days off are last. */
function slotsForTeams(slots: SlotDTO[], teamIds: number[], date: string, pitchId = "all") {
  return teamIds
    .flatMap((id) => slotsForDay(slots, id, date))
    .filter((slot) => slotMatchesPitch(slot, pitchId))
    .sort(compareDaySlots);
}

/** Team names to show on cards; null when only one team is shown (no need to repeat it). */
type TeamLabels = Record<number, string> | null;

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

/** Spoken description for screen readers, e.g. "אימון · וסרמיל 1, 17:30". */
function spoken(slot: SlotDTO) {
  return [kindLabel(slot), timeLabel(slot), homeGamePitchText(slot), practiceGameDetail(slot), slot.note].filter(Boolean).join(", ");
}

function SlotCard({ slot, teamLabel }: { slot: SlotDTO; teamLabel?: string }) {
  const style = getSlotType(slot.type);
  const time = timeLabel(slot);
  const isGame = slot.type === "home_game" || slot.type === "away_game";
  const cancelled = slot.status === "cancelled";
  return (
    <li
      aria-label={`${teamLabel ? `${teamLabel}: ` : ""}${cancelled ? "בוטל: " : ""}${spoken(slot)}${slot.statusNote ? `, ${slot.statusNote}` : ""}${
        slot.substituteName ? `, מאמן מחליף ${slot.substituteName}` : ""
      }`}
      className={`flex items-stretch overflow-hidden rounded-xl shadow-sm ring-1 ${
        cancelled ? "bg-zinc-100 ring-zinc-300 dark:bg-zinc-800 dark:ring-white/10" : "bg-white ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
      }`}
    >
      <span aria-hidden className="w-1.5 shrink-0 self-stretch" style={{ background: cancelled ? "#a1a1aa" : style.bg }} />
      <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            dir="ltr"
            className={`w-[7.75rem] shrink-0 text-left text-base font-black tabular-nums text-[#1a1214] dark:text-white ${
              cancelled ? "text-zinc-500 line-through" : ""
            }`}
          >
            {time ?? "—"}
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-black text-[#5c0814] dark:text-white">
            {teamLabel ?? ""}
          </span>
        </div>
        <div className="min-w-0 ps-[8.25rem]">
          <p className="truncate text-base font-bold leading-snug dark:text-white">
            {cancelled ? "בוטל" : isGame ? (slot.type === "home_game" ? "משחק בית" : "משחק חוץ") : kindLabel(slot)}
          </p>
          {practiceGameDetail(slot) ? (
            <p className="mt-0.5 text-[15px] font-semibold leading-snug text-zinc-700 dark:text-zinc-200">
              {practiceGameDetail(slot)}
            </p>
          ) : null}
          <GameScheduleDetail slot={slot} />
          {cancelled && slot.statusNote ? (
            <p className="mt-0.5 text-[15px] font-bold leading-snug text-zinc-800 dark:text-zinc-100">{slot.statusNote}</p>
          ) : null}
          {slot.substituteName && !cancelled ? (
            <p className="mt-0.5 text-[15px] font-bold leading-snug text-[#8e0b20] dark:text-[#ff8a9a]">
              מאמן מחליף: {slot.substituteName}
              {slot.statusNote ? ` · ${slot.statusNote}` : ""}
            </p>
          ) : null}
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
function nextActivity(data: WeekData, teamIds: number[], today: string, now: Date) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const date of data.dates) {
    if (date < today) continue;
    const upcoming = slotsForTeams(data.slots, teamIds, date).filter(
      (slot) =>
        slot.type !== "off" &&
        slot.status !== "cancelled" &&
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
  teamIds,
  labels,
  today,
  now,
}: {
  day: Day;
  data: WeekData;
  teamIds: number[];
  labels: TeamLabels;
  today: string;
  now: Date;
}) {
  const next = day.items.length ? null : nextActivity(data, teamIds, today, now);
  return (
    <section
      id={dayElementId(day.date)}
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
                    <SlotCard slot={slot} teamLabel={labels?.[slot.teamId]} />
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
              {labels ? `${labels[next.slot.teamId]} · ` : ""}
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
function DayRow({ day, labels }: { day: Day; labels: TeamLabels }) {
  const title = `יום ${HEBREW_DAY_NAMES[day.index]}`;
  if (day.items.length === 0 && day.notes.length === 0) {
    return (
      <li id={dayElementId(day.date)} className="px-1 py-1 text-base text-zinc-500 dark:text-zinc-400">
        <span className="font-bold text-zinc-700 dark:text-zinc-300">{title}</span> {formatDayMonth(day.date)}
        {" — "}אין פעילות
      </li>
    );
  }
  return (
    <li id={dayElementId(day.date)} className="flex flex-col gap-2">
      <h3 className="px-1 text-lg font-extrabold dark:text-white">
        {title} <span className="text-base font-semibold text-zinc-500 dark:text-zinc-400">{formatDayMonth(day.date)}</span>
      </h3>
      {day.items.length ? (
        <ul className="flex flex-col gap-2">
          {day.items.map((slot) => (
            <SlotCard key={slot.id} slot={slot} teamLabel={labels?.[slot.teamId]} />
          ))}
        </ul>
      ) : null}
      <Notes notes={day.notes} />
    </li>
  );
}

function BellIcon({ filled, className = "h-6 w-6" }: { filled: boolean; className?: string }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="currentColor"
          d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

function PushNotices({ blocked, iosHint }: { blocked: boolean; iosHint: boolean }) {
  if (!blocked && !iosHint) return null;
  return (
    <div className="flex flex-col gap-2">
      {blocked ? (
        <p role="status" className="rounded-xl bg-[#f4e6e8] px-3 py-2 text-sm font-bold leading-relaxed text-[#5c0814] dark:bg-[#3a0710] dark:text-[#f4e6e8]">
          הדפדפן חסם את ההתראות, ולכן עדכונים על הקבוצות לא יגיעו. אפשר לאפשר התראות בהגדרות הדפדפן לאתר הזה.
        </p>
      ) : null}
      {iosHint ? (
        <p role="status" className="rounded-xl bg-[#f4e6e8] px-3 py-2 text-sm font-medium leading-relaxed text-[#5c0814] dark:bg-[#3a0710] dark:text-[#f4e6e8]">
          באייפון ההתראות מגיעות רק אחרי שהאתר נוסף למסך הבית. לחצו על כפתור השיתוף <span aria-hidden>⎋</span>, ואז על{" "}
          <span className="font-bold">«הוסף למסך הבית»</span>.
        </p>
      ) : null}
    </div>
  );
}

export function TeamPicker({
  teams,
  current,
  alerts,
  pushBlocked,
  iosHint,
  onSave,
  onCancel,
}: {
  teams: TeamDTO[];
  current: number[];
  alerts: TeamAlertPrefs;
  pushBlocked: boolean;
  iosHint: boolean;
  onSave: (ids: number[], alerts: TeamAlertPrefs) => void;
  onCancel?: () => void;
}) {
  const [chosen, setChosen] = useState<number[]>(current);
  const [prefs, setPrefs] = useState<TeamAlertPrefs>(alerts);
  function toggle(id: number) {
    const selecting = !chosen.includes(id);
    setChosen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
    if (selecting) setPrefs((currentPrefs) => withNewlySelectedTeam(currentPrefs, id));
  }
  function toggleAll() {
    if (chosen.length === teams.length) {
      setChosen([]);
      return;
    }
    setPrefs((currentPrefs) => {
      let next = currentPrefs;
      for (const team of teams) {
        if (!chosen.includes(team.id)) next = withNewlySelectedTeam(next, team.id);
      }
      return next;
    });
    setChosen(teams.map((team) => team.id));
  }
  function toggleBell(id: number) {
    if (!chosen.includes(id)) return;
    setPrefs((currentPrefs) => withBell(currentPrefs, id, !isTeamAlertOn(currentPrefs, id, true)));
  }
  return (
    // Not inside .team-week, so the page stays on the light paper background even when
    // the phone prefers dark. Tailwind's dark: variant still matches, so ink here is pinned dark.
    <section className="team-picker flex flex-col gap-3 bg-[#fff8f6] pb-24 text-[#111827] dark:bg-[#fff8f6] dark:text-[#111827]">
      <div>
        <h2 className="text-xl font-black text-[#111827] dark:text-[#111827]">אילו קבוצות לראות?</h2>
        <p className="text-base text-[#1f2937] dark:text-[#1f2937]">
          אפשר לבחור כמה: למשל שני ילדים בגילאים שונים, או גם הקבוצה שמעל. הבחירה נשמרת בטלפון. פעמון דולק ליד קבוצה
          אומר שנשלחת התראה כשהלוח שלה משתנה.
        </p>
      </div>
      <PushNotices blocked={pushBlocked} iosHint={iosHint} />
      <button
        type="button"
        onClick={toggleAll}
        aria-pressed={chosen.length === teams.length}
        className={`min-h-12 rounded-xl px-3 text-base font-black ring-1 ${
          chosen.length === teams.length
            ? "bg-[#5c0814] text-white ring-[#5c0814]"
            : "bg-white text-[#5c0814] ring-[#d7b4b8] dark:bg-zinc-900 dark:text-white dark:ring-white/15"
        }`}
      >
        {chosen.length === teams.length ? "✓ כל הקבוצות" : "כל הקבוצות"}
      </button>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="קבוצות">
        {teams.map((item) => {
          const on = chosen.includes(item.id);
          const bellOn = isTeamAlertOn(prefs, item.id, on);
          const bellLabel = `${bellOn ? "התראות דולקות לקבוצה זו" : "התראות כבויות לקבוצה זו"}: ${item.name}`;
          return (
            <div key={item.id} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={on}
                className={`flex min-h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-base font-bold leading-tight shadow-sm ring-1 transition ${
                  on
                    ? "bg-[#c8102e] text-white ring-[#c8102e]"
                    : "bg-white text-[#5c0814] ring-[#d7b4b8] active:bg-[#f4e6e8] dark:bg-zinc-900 dark:text-white dark:ring-white/15"
                }`}
              >
                {on ? <span aria-hidden>✓</span> : null}
                {item.name}
              </button>
              <button
                type="button"
                onClick={() => toggleBell(item.id)}
                aria-pressed={bellOn}
                aria-label={bellLabel}
                className={`flex min-h-11 w-11 shrink-0 items-center justify-center self-stretch rounded-xl ring-1 ${
                  bellOn
                    ? "bg-[#f4e6e8] text-[#c8102e] ring-[#c8102e] dark:bg-[#3a0710] dark:text-[#ff8a9a] dark:ring-[#ff8a9a]"
                    : "bg-white text-zinc-400 ring-[#d7b4b8] dark:bg-zinc-900 dark:text-zinc-500 dark:ring-white/15"
                }`}
              >
                <BellIcon filled={bellOn} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() =>
              onSave(
                teams.filter((team) => chosen.includes(team.id)).map((team) => team.id),
                prefs,
              )
            }
            className="min-h-12 flex-1 rounded-xl bg-[#c8102e] text-base font-black text-white disabled:bg-zinc-300 disabled:text-[#111827] dark:bg-[#c8102e] dark:text-white dark:disabled:bg-zinc-300 dark:disabled:text-[#111827]"
          >
            {chosen.length === 0 ? "בחרו לפחות קבוצה אחת" : chosen.length === 1 ? "הצגת הקבוצה" : `הצגת ${chosen.length} הקבוצות`}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-12 rounded-xl px-4 text-base font-bold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-white/20"
            >
              ביטול
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function TeamWeek({ data, focusDay }: { data: WeekData; focusDay?: string }) {
  const router = useRouter();
  const teams = useMemo(() => regularTeams(data.teams), [data.teams]);
  const commentsTeam = data.teams.find((team) => team.isComments);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [alertPrefs, setAlertPrefs] = useState<TeamAlertPrefs>({});
  const [pushBlocked, setPushBlocked] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  /** Optional: look at one of the chosen teams only (null = all of them). */
  const [focus, setFocus] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [pitchId, setPitchId] = useState("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(focusDay ?? null);
  const [now, setNow] = useState<Date | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const clockReady = now != null;

  // localStorage and the clock only exist in the browser, so read them after mounting.
  useEffect(() => {
    // One-time read of browser-only state after mount (localStorage, permission, clock).
    /* eslint-disable react-hooks/set-state-in-effect */
    const ids = readTeamSelection("public") ?? [];
    const prefs = readTeamAlertPrefs();
    setTeamIds(ids);
    setAlertPrefs(prefs);
    setNow(new Date());
    const alerting = alertingTeamIds(ids, prefs);
    if (alerting.length > 0 && notificationsAreBlocked()) setPushBlocked(true);
    if (takeIosPushHint(alerting.length > 0)) setIosHint(true);
    void resyncPushIfGranted(alerting);
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!clockReady || !focusDay) return;
    const handle = window.setTimeout(() => scrollToDay(focusDay), 0);
    return () => window.clearTimeout(handle);
  }, [clockReady, focusDay]);

  if (!now) return <div className="min-h-[60vh]" />;

  const today = todayISO();
  const thisWeek = currentWeekStart();
  // Teams that still exist (a saved team may have been renamed or removed).
  const mine = teams.filter((item) => teamIds.includes(item.id));

  function save(ids: number[], prefs: TeamAlertPrefs) {
    setTeamIds(ids);
    setAlertPrefs(prefs);
    saveTeamSelection("public", ids);
    saveTeamAlertPrefs(prefs);
    setFocus(null);
    setPicking(false);
    window.scrollTo({ top: 0 });
    const alerting = alertingTeamIds(ids, prefs);
    void applyPushChoice(alerting).then((result) => {
      setPushBlocked(result === "denied");
      if (takeIosPushHint(alerting.length > 0)) setIosHint(true);
    });
  }

  if (mine.length === 0 || picking) {
    return (
      <TeamPicker
        teams={teams}
        current={mine.map((item) => item.id)}
        alerts={alertPrefs}
        pushBlocked={pushBlocked}
        iosHint={iosHint}
        onSave={save}
        onCancel={mine.length ? () => setPicking(false) : undefined}
      />
    );
  }

  const anyAlert = alertingTeamIds(mine.map((item) => item.id), alertPrefs).length > 0;
  const shown = focus && mine.some((item) => item.id === focus) ? mine.filter((item) => item.id === focus) : mine;
  const shownIds = shown.map((item) => item.id);
  const labels: TeamLabels = Object.fromEntries(shown.map((item) => [item.id, item.name]));

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
    items: slotsForTeams(data.slots, shownIds, date, pitchId),
    notes: pitchId === "all" && commentsTeam ? slotsForDay(data.slots, commentsTeam.id, date) : [],
  }));
  const activeDay = data.dates.includes(selectedDay ?? "") ? (selectedDay as string) : data.dates.includes(today) ? today : data.dates[0];
  function moveDay(delta: number) {
    const index = data.dates.indexOf(activeDay);
    const nextIndex = index + delta;
    if (nextIndex >= 0 && nextIndex < data.dates.length) {
      const next = data.dates[nextIndex];
      setSelectedDay(next);
      if (next < today) setShowPast(true);
      window.setTimeout(() => scrollToDay(next), 0);
      return;
    }
    const target = addDaysISO(activeDay, delta);
    const week = formatISODate(sundayOf(parseISODate(target)));
    router.push(`/?week=${week}&day=${target}`);
  }
  function goToday() {
    const target = todayJump(data.weekStart, today);
    if (target.kind === "navigate") {
      router.push(target.href);
      return;
    }
    setSelectedDay(target.day);
    window.setTimeout(() => scrollToDay(target.day), 0);
  }
  const todayDay = isThisWeek ? days.find((day) => day.date === today) : undefined;
  const past = isThisWeek ? days.filter((day) => day.date < today) : [];
  const upcoming = isThisWeek ? days.filter((day) => day.date > today) : days;

  return (
    <div className="team-week flex flex-col gap-4 pb-24" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg text-start text-2xl font-black text-[#5c0814] dark:text-white"
            aria-label={`הקבוצות שלי: ${mine.map((item) => item.name).join(", ")}. לחצו לשינוי`}
          >
            <span className="truncate">{mine.length === 1 ? mine[0].name : "הקבוצות שלי"}</span>
            <span aria-hidden className="text-sm text-[#c8102e]">▼</span>
          </button>
          <span
            role="img"
            aria-label={anyAlert ? "התראות דולקות לקבוצות שלי" : "התראות כבויות"}
            className={`shrink-0 ${anyAlert ? "text-[#c8102e]" : "text-zinc-400"}`}
          >
            <BellIcon filled={anyAlert} className="h-5 w-5" />
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          שבוע {data.weekNumber} · <bdi>{formatWeekRange(data.weekStart)}</bdi>
        </p>
      </div>
      <PushNotices blocked={pushBlocked} iosHint={iosHint} />

      <MobileDayNav
        dayTitle={`יום ${HEBREW_DAY_NAMES[data.dates.indexOf(activeDay)]}`}
        dateLabel={formatDayMonth(activeDay)}
        onPrevious={() => moveDay(-1)}
        onToday={goToday}
        onNext={() => moveDay(1)}
        todayCurrent={isThisWeek && activeDay === today}
      />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="group" aria-label="סינון לפי מגרש">
        {MOBILE_PITCH_FILTERS.map((item) => {
          const on = pitchId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPitchId(item.id)}
              aria-pressed={on}
              className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-bold whitespace-nowrap ring-1 ${
                on
                  ? "bg-[#c8102e] text-white ring-[#c8102e]"
                  : "bg-white text-[#5c0814] ring-[#d7b4b8] dark:bg-zinc-900 dark:text-white dark:ring-white/15"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {mine.length > 1 ? (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="group" aria-label="הצגה לפי קבוצה">
          {[{ id: null as number | null, name: "כולן" }, ...mine].map((item) => {
            const on = item.id === null ? shown.length === mine.length : focus === item.id;
            return (
              <button
                key={item.id ?? "all"}
                type="button"
                onClick={() => setFocus(item.id)}
                aria-pressed={on}
                className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold whitespace-nowrap ring-1 ${
                  on
                    ? "bg-[#5c0814] text-white ring-[#5c0814] dark:bg-[#f4e6e8] dark:text-[#5c0814]"
                    : "bg-white text-[#5c0814] ring-[#d7b4b8] dark:bg-zinc-900 dark:text-white dark:ring-white/15"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {todayDay ? (
        <TodayBlock day={todayDay} data={data} teamIds={shownIds} labels={labels} today={today} now={now} />
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
              <DayRow key={day.date} day={day} labels={labels} />
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
                <DayRow key={day.date} day={day} labels={labels} />
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
