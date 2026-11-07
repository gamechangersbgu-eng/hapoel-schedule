"use client";

// Club TV screen: the whole week for every team on one screen, readable from across the room.
// No buttons, no scrolling: rows and text scale with the screen size (vh / vw units).
import { type ReactNode, useEffect, useState } from "react";
import {
  HEBREW_DAY_NAMES,
  campCovers,
  slotsForDay,
  timeLabel,
  todayISO,
} from "@/components/display-utils";
import { SLOT_TYPES, getSlotType, isCampSlot } from "@/lib/slot-types";
import type { SlotDTO, TeamDTO, WeekData } from "@/lib/types";
import { formatDayMonth, formatWeekRange } from "@/lib/week";

type TvBoardProps = {
  data: WeekData;
  /** Optional small status line, e.g. when fresh data could not be loaded. */
  notice?: string | null;
};

function useNow(intervalMs: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Keeps the TV from dimming while the page is open (where the browser supports it). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      nav.wakeLock
        ?.request("screen")
        .then((s) => {
          sentinel = s;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

function Chip({ slot, size }: { slot: SlotDTO; size: "lg" | "sm" }) {
  const style = getSlotType(slot.type);
  const time = timeLabel(slot);
  const showLabel = slot.type === "home_game" || slot.type === "away_game" || slot.type === "off";
  const sub = slot.note || (showLabel ? style.label : null);
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[0.4vh] px-[0.3vw] text-center leading-[1.1] ring-1 ring-white/15"
      style={{ background: style.bg, color: style.fg }}
    >
      {time ? (
        <span
          dir="ltr"
          className="font-black tabular-nums"
          style={{ fontSize: size === "lg" ? "min(2.3vh, 1.25vw)" : "min(1.7vh, 1vw)" }}
        >
          {time}
        </span>
      ) : null}
      {sub ? (
        <span
          className="line-clamp-2 max-w-full font-bold opacity-95"
          style={{ fontSize: size === "lg" ? "min(1.45vh, 0.85vw)" : "min(1.2vh, 0.75vw)" }}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function dayTone(date: string, today: string | null) {
  if (today == null) return "";
  if (date === today) return "tv-today";
  if (date < today) return "opacity-40";
  return "";
}

function TeamCells({
  team,
  dates,
  slots,
  today,
}: {
  team: TeamDTO;
  dates: string[];
  slots: SlotDTO[];
  today: string | null;
}) {
  const cells: ReactNode[] = [];
  const teamSlots = slots.filter((slot) => slot.teamId === team.id);
  let index = 0;
  while (index < dates.length) {
    const date = dates[index];
    const camp = teamSlots.find((slot) => campCovers(slot, date));
    if (camp) {
      // One wide block across all visible days of the camp.
      let span = 0;
      for (let j = index; j < dates.length && campCovers(camp, dates[j]); j += 1) span += 1;
      const covered = dates.slice(index, index + span);
      const style = getSlotType("camp");
      const tone =
        today && covered.includes(today) ? "tv-today" : today && covered[span - 1] < today ? "opacity-40" : "";
      cells.push(
        <div key={`${team.id}-${date}`} className={`tv-cell ${tone}`} style={{ gridColumn: `span ${span}` }}>
          <div
            className="flex flex-1 items-center justify-center gap-[0.6vw] rounded-[0.4vh] font-black"
            style={{ background: style.bg, color: style.fg, fontSize: "min(2.1vh, 1.2vw)" }}
          >
            <span className="truncate">{camp.note || style.label}</span>
            {timeLabel(camp) ? (
              <span dir="ltr" className="tabular-nums">
                {timeLabel(camp)}
              </span>
            ) : null}
          </div>
        </div>,
      );
      index += span;
      continue;
    }
    const day = slotsForDay(slots, team.id, date).filter((slot) => !isCampSlot(slot.type));
    cells.push(
      <div key={`${team.id}-${date}`} className={`tv-cell ${dayTone(date, today)}`}>
        {day.slice(0, 3).map((slot) => (
          <Chip key={slot.id} slot={slot} size={day.length > 1 ? "sm" : "lg"} />
        ))}
      </div>,
    );
    index += 1;
  }
  return <>{cells}</>;
}

export function TvBoard({ data, notice }: TvBoardProps) {
  const now = useNow(15_000);
  useWakeLock();
  const today = now ? todayISO() : null;
  const todayIndex = today ? data.dates.indexOf(today) : -1;

  const clock = now
    ? now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "";
  const dateLine =
    now && todayIndex >= 0
      ? `יום ${HEBREW_DAY_NAMES[todayIndex]}, ${formatDayMonth(data.dates[todayIndex])}`
      : formatWeekRange(data.weekStart);

  return (
    <div className="tv-root fixed inset-0 flex cursor-none flex-col overflow-hidden px-[1.2vw] pt-[1.4vh] pb-[1vh] text-white">
      <header className="flex shrink-0 items-center justify-between gap-[2vw] pb-[1.2vh]">
        <div className="min-w-0">
          <p className="font-semibold text-white/70" style={{ fontSize: "min(1.8vh, 1vw)" }}>
            {data.clubName} · מחלקת הנוער
          </p>
          <h1 className="truncate font-black leading-tight" style={{ fontSize: "min(4.2vh, 2.4vw)" }}>
            תכנית אימונים — שבוע {data.weekNumber}
            <bdi className="ms-[1vw] font-semibold text-white/70" style={{ fontSize: "min(2.6vh, 1.5vw)" }}>
              {formatWeekRange(data.weekStart)}
            </bdi>
          </h1>
        </div>
        <div className="shrink-0 text-left" dir="ltr">
          <p className="font-black tabular-nums leading-none" style={{ fontSize: "min(6vh, 3.4vw)" }}>
            {clock}
          </p>
          <p className="text-right font-semibold text-white/75" dir="rtl" style={{ fontSize: "min(2vh, 1.15vw)" }}>
            {dateLine}
          </p>
        </div>
      </header>

      <div
        className="tv-grid grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: "minmax(0, 10vw) repeat(7, minmax(0, 1fr))",
          gridTemplateRows: `auto repeat(${data.teams.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="tv-head" />
        {data.dates.map((date, index) => (
          <div
            key={date}
            className={`tv-head flex flex-col items-center justify-center py-[0.6vh] ${
              date === today ? "tv-head-today" : dayTone(date, today)
            }`}
          >
            <span className="font-black" style={{ fontSize: "min(2.3vh, 1.3vw)" }}>
              {date === today ? "היום · " : ""}
              {HEBREW_DAY_NAMES[index]}
            </span>
            <span className="font-semibold opacity-80" style={{ fontSize: "min(1.6vh, 0.9vw)" }}>
              {formatDayMonth(date)}
            </span>
          </div>
        ))}

        {data.teams.map((team) => (
          <div key={team.id} className="contents">
            <div
              className={`tv-team flex items-center truncate px-[0.6vw] font-extrabold ${
                team.isComments ? "text-white/70" : ""
              }`}
              style={{ fontSize: "min(2.2vh, 1.2vw)" }}
            >
              {team.name}
            </div>
            <TeamCells team={team} dates={data.dates} slots={data.slots} today={today} />
          </div>
        ))}
      </div>

      <footer
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-[1.2vw] gap-y-[0.4vh] pt-[1vh] text-white/80"
        style={{ fontSize: "min(1.5vh, 0.85vw)" }}
      >
        <div className="flex flex-wrap items-center gap-x-[1.2vw] gap-y-[0.4vh]">
          {SLOT_TYPES.filter((item) => item.id !== "other").map((item) => (
            <span key={item.id} className="flex items-center gap-[0.35vw]">
              <span
                className="inline-block rounded-[0.3vh]"
                style={{ background: item.bg, width: "1.6vh", height: "1.6vh" }}
              />
              {item.label}
            </span>
          ))}
        </div>
        <span>{notice ?? "מתעדכן אוטומטית"}</span>
      </footer>
    </div>
  );
}
