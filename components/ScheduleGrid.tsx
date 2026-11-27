"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { practiceGameDetail } from "@/components/display-utils";
import { homeGamePitchText } from "@/lib/game-logistics";
import { getSlotType, isCampSlot, isPitchSlot } from "@/lib/slot-types";
import type { SlotDTO, TeamDTO } from "@/lib/types";
import { HEBREW_DAY_LETTERS, formatDayMonth } from "@/lib/week";

type ScheduleGridProps = {
  dates: string[];
  teams: TeamDTO[];
  slots: SlotDTO[];
  editable?: boolean;
  weekStart?: string;
};

function campCovers(slot: SlotDTO, date: string) {
  if (!isCampSlot(slot.type)) return false;
  const end = slot.endDate ?? slot.date;
  return slot.date <= date && end >= date;
}

/** What the slot is, shown under the time: "אימון · וסרמיל 1", "משחק בית", "חופש"... */
function kindLabel(type: string) {
  if (type === "other") return null;
  const style = getSlotType(type);
  return isPitchSlot(type) ? `אימון · ${style.label}` : style.label;
}

function SlotChip({ slot, compact }: { slot: SlotDTO; compact?: boolean }) {
  const style = getSlotType(slot.type);
  const cancelled = slot.status === "cancelled";
  return (
    <div
      className={`flex w-full flex-col items-center justify-center rounded-[3px] px-1 py-1 text-center leading-tight ${
        compact ? "min-h-[28px]" : "min-h-[52px]"
      }`}
      style={
        cancelled
          ? { background: "repeating-linear-gradient(135deg,#e4e4e7,#e4e4e7 6px,#f4f4f5 6px,#f4f4f5 12px)", color: "#3f3f46" }
          : { background: style.bg, color: style.fg }
      }
    >
      {cancelled ? <span className="text-[11px] font-black">בוטל</span> : null}
      {slot.startTime ? (
        <span dir="ltr" className={`text-sm font-extrabold tabular-nums ${cancelled ? "line-through" : ""}`}>
          {slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime}
        </span>
      ) : null}
      {slot.substituteName && !cancelled ? (
        <span className="text-[10px] font-black">מחליף: {slot.substituteName}</span>
      ) : null}
      {cancelled && slot.statusNote ? <span className="text-[10px] font-bold">{slot.statusNote}</span> : null}
      {kindLabel(slot.type) ? (
        <span className="text-[11px] font-bold leading-tight">{kindLabel(slot.type)}</span>
      ) : null}
      {homeGamePitchText(slot) ? (
        <span className="max-w-full break-words text-[10px] font-bold leading-tight">{homeGamePitchText(slot)}</span>
      ) : null}
      {practiceGameDetail(slot) ? (
        <span className="max-w-full break-words text-[10px] font-semibold leading-tight">{practiceGameDetail(slot)}</span>
      ) : null}
      {slot.note ? (
        <span className="max-w-full break-words text-[10px] font-semibold leading-tight opacity-90">
          {slot.note}
        </span>
      ) : null}
    </div>
  );
}

function CellLink({
  href,
  children,
  label,
}: {
  href?: string;
  children: ReactNode;
  label: string;
}) {
  if (!href) {
    return <div className="flex min-h-[52px] flex-col gap-0.5">{children}</div>;
  }

  return (
    <a
      href={href}
      aria-label={label}
      className="flex min-h-[52px] w-full flex-col gap-0.5 rounded-[3px] text-inherit hover:outline hover:outline-2 hover:outline-[#c8102e]"
    >
      {children}
    </a>
  );
}

function TeamRow({
  team,
  dates,
  slots,
  editable,
  weekStart,
}: {
  team: TeamDTO;
  dates: string[];
  slots: SlotDTO[];
  editable?: boolean;
  weekStart?: string;
}) {
  const teamSlots = slots.filter((slot) => slot.teamId === team.id);
  const cells: ReactNode[] = [];
  let index = 0;

  function hrefFor(date: string) {
    if (!editable || !weekStart) return undefined;
    return `/admin?week=${weekStart}&team=${team.id}&date=${date}`;
  }

  while (index < dates.length) {
    const date = dates[index];
    const coveringCamp = teamSlots.find((slot) => campCovers(slot, date));

    if (coveringCamp) {
      const visibleStart =
        coveringCamp.date < dates[0] ? dates[0] : coveringCamp.date;
      if (date !== visibleStart) {
        index += 1;
        continue;
      }

      const end = coveringCamp.endDate ?? coveringCamp.date;
      let span = 0;
      for (let j = index; j < dates.length; j += 1) {
        if (dates[j] <= end) span += 1;
        else break;
      }

      const style = getSlotType("camp");
      cells.push(
        <td key={`${team.id}-${date}-camp`} colSpan={span} className="p-0.5">
          <CellLink
            href={hrefFor(coveringCamp.date)}
            label={`עריכת מחנה אימון ${team.name}`}
          >
            <div
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[3px] px-2 text-center font-extrabold"
              style={{ background: style.bg, color: style.fg }}
            >
              <span>{coveringCamp.note || style.label}</span>
              {coveringCamp.startTime ? (
                <span className="tabular-nums">{coveringCamp.startTime}</span>
              ) : null}
            </div>
          </CellLink>
        </td>,
      );
      index += span;
      continue;
    }

    const daySlots = teamSlots.filter(
      (slot) => !isCampSlot(slot.type) && slot.date === date,
    );

    cells.push(
      <td key={`${team.id}-${date}`} className="bg-white p-0.5">
        <CellLink
          href={hrefFor(date)}
          label={`${daySlots.length ? "עריכת" : "הוספת"} אימון ${team.name}`}
        >
          {daySlots.length === 0 ? (
            <div className="flex min-h-[52px] items-center justify-center text-lg font-bold text-[#c8102e]/40">
              {editable ? "+" : ""}
            </div>
          ) : (
            <>
              {daySlots.map((slot) => (
                <SlotChip
                  key={slot.id}
                  slot={slot}
                  compact={daySlots.length > 1 || team.isComments}
                />
              ))}
              {editable && !team.isComments ? (
                <span className="text-center text-[11px] font-bold leading-4 text-[#c8102e]/60">
                  + אימון נוסף
                </span>
              ) : null}
            </>
          )}
        </CellLink>
      </td>,
    );
    index += 1;
  }

  return (
    <tr className={team.isComments ? "bg-zinc-50" : undefined}>
      <th data-comments={team.isComments ? "1" : undefined} className="team-col bg-[#f4e6e8] px-2 py-1 text-right text-[13px] font-bold text-[#5c0814]">
        {team.name}
      </th>
      {cells}
    </tr>
  );
}

type PinnedRow = { key: string; top: number; height: number; label: string; head: boolean; comments: boolean };
type PinnedLayout = { right: number; width: number; rows: PinnedRow[] };

/**
 * Measures where the team-name cells are, so a plain (non-sticky) copy of the column can be drawn on
 * top of the table at the right edge. iPhone Safari blanks sticky table cells while the page scrolls,
 * so the pinned column is an ordinary positioned layer outside the horizontal scroller.
 */
function usePinnedColumn(teamsKey: string) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PinnedLayout | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const scroller = scrollRef.current;
    if (!wrap || !scroller) return;
    const measure = () => {
      const base = wrap.getBoundingClientRect();
      const box = scroller.getBoundingClientRect();
      const cells = Array.from(scroller.querySelectorAll<HTMLTableCellElement>("tr > .team-col"));
      if (!cells.length) return setLayout(null);
      const rows = cells.map((cell, index) => {
        const row = cell.parentElement!.getBoundingClientRect();
        return {
          key: `${index}-${cell.textContent}`,
          top: row.top - base.top,
          height: row.height,
          label: cell.textContent ?? "",
          head: cell.closest("thead") != null,
          comments: cell.dataset.comments === "1",
        };
      });
      setLayout({
        right: base.right - (box.left + scroller.clientLeft + scroller.clientWidth),
        width: cells[0].getBoundingClientRect().width,
        rows,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    const table = scroller.querySelector("table");
    if (table) observer.observe(table);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [teamsKey]);

  return { wrapRef, scrollRef, layout };
}

export function ScheduleGrid({
  dates,
  teams,
  slots,
  editable,
  weekStart,
}: ScheduleGridProps) {
  const { wrapRef, scrollRef, layout } = usePinnedColumn(teams.map((team) => team.id).join(","));
  return (
    <div ref={wrapRef} className="relative">
    <div
      ref={scrollRef}
      className={`schedule-scroll print-full rounded-lg border border-[#c8102e] bg-white shadow-sm ${
        editable ? "schedule-editable" : ""
      } ${layout ? "has-pinned-col" : ""}`}
    >
      <table className="schedule-table">
        <thead>
          <tr>
            <th className="team-col bg-[#8e0b20] px-2 py-2 text-right text-sm font-black text-white">
              קבוצה
            </th>
            {dates.map((date, index) => (
              <th
                key={date}
                className="bg-[#8e0b20] px-1 py-2 text-center text-sm font-black text-white"
              >
                <span className="block">{HEBREW_DAY_LETTERS[index]}</span>
                <span className="block text-[11px] font-semibold text-white/85">
                  {formatDayMonth(date)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              dates={dates}
              slots={slots}
              editable={editable}
              weekStart={weekStart}
            />
          ))}
        </tbody>
      </table>
    </div>
      {layout ? (
        <div
          aria-hidden
          className="pinned-team-col no-print pointer-events-none absolute top-0"
          style={{ right: layout.right, width: layout.width }}
        >
          {layout.rows.map((row) => (
            <div
              key={row.key}
              className={`absolute inset-x-0 flex items-center px-2 text-right font-bold ${
                row.head
                  ? "rounded-tr-md bg-[#8e0b20] text-sm font-black text-white"
                  : `${row.comments ? "bg-zinc-100" : "bg-[#f4e6e8]"} text-[13px] text-[#5c0814]`
              }`}
              style={{ top: row.top, height: row.height }}
            >
              {row.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
