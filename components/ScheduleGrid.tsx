"use client";

import type { ReactNode } from "react";
import { getSlotType, isCampSlot } from "@/lib/slot-types";
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

function SlotChip({ slot, compact }: { slot: SlotDTO; compact?: boolean }) {
  const style = getSlotType(slot.type);
  return (
    <div
      className={`flex w-full flex-col items-center justify-center rounded-[3px] px-1 py-1 text-center leading-tight ${
        compact ? "min-h-[28px]" : "min-h-[52px]"
      }`}
      style={{ background: style.bg, color: style.fg }}
    >
      {slot.startTime ? (
        <span className="text-sm font-extrabold tabular-nums">{slot.startTime}</span>
      ) : null}
      {slot.note ? (
        <span className="max-w-full break-words text-[10px] font-semibold opacity-95">
          {slot.note}
        </span>
      ) : slot.type === "off" ||
        slot.type === "home_game" ||
        slot.type === "away_game" ? (
        <span className="text-[10px] font-semibold">{style.label}</span>
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
            daySlots.map((slot) => (
              <SlotChip
                key={slot.id}
                slot={slot}
                compact={daySlots.length > 1 || team.isComments}
              />
            ))
          )}
        </CellLink>
      </td>,
    );
    index += 1;
  }

  return (
    <tr className={team.isComments ? "bg-zinc-50" : undefined}>
      <th className="team-col bg-[#f4e6e8] px-2 py-1 text-right text-[13px] font-bold text-[#5c0814]">
        {team.name}
      </th>
      {cells}
    </tr>
  );
}

export function ScheduleGrid({
  dates,
  teams,
  slots,
  editable,
  weekStart,
}: ScheduleGridProps) {
  return (
    <div className="schedule-scroll print-full rounded-lg border border-[#c8102e] bg-white shadow-sm">
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
  );
}
