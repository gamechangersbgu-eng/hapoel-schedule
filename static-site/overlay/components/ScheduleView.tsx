"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Legend } from "@/components/Legend";
import { TeamWeek } from "@/components/TeamWeek";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import type { WeekData } from "@/lib/types";

type ScheduleViewProps = {
  data: WeekData;
};

// Public schedule for the static export. Read-only: no admin edits, no imports
// of server actions. Slot rows are whatever the Postgres snapshot contained.
export function ScheduleView({ data }: ScheduleViewProps) {
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const teams = useMemo(() => {
    if (teamFilter === "all") return data.teams;
    return data.teams.filter(
      (team) => String(team.id) === teamFilter || team.isComments,
    );
  }, [data.teams, teamFilter]);

  const isEmpty = data.slots.length === 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-5">
      <div className="no-print hidden flex-wrap items-center justify-between gap-3 md:flex">
        <label className="hidden items-center gap-2 text-sm font-bold md:flex">
          קבוצה
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="rounded-md border border-[#d7b4b8] bg-white px-2 py-1.5 font-medium"
          >
            <option value="all">כל הקבוצות</option>
            {data.teams
              .filter((team) => !team.isComments)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-[#c8102e] px-3 py-1.5 text-sm font-bold text-[#c8102e]"
        >
          הדפסה
        </button>
      </div>

      {isEmpty ? (
        <p className="hidden rounded-md border border-dashed border-[#c8102e] bg-white px-3 py-3 text-center text-sm font-medium text-zinc-600 md:block">
          אין אימונים בשבוע זה.
        </p>
      ) : null}

      <div className="md:hidden print:hidden">
        <TeamWeek data={data} />
      </div>

      <div className="hidden flex-col items-stretch gap-3 md:flex print:flex lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ScheduleGrid
            dates={data.dates}
            teams={teams}
            slots={data.slots}
            weekStart={data.weekStart}
          />
        </div>
        <Legend />
      </div>
      <p className="no-print pb-6 text-center text-xs text-zinc-500">
        הלוח מציג רק את מה שנשמר במסד הנתונים.
        <span className="hidden md:inline">
          {" · "}
          <Link href="/tv" className="font-bold text-[#8e0b20] underline">
            מסך טלוויזיה למועדון
          </Link>
        </span>
      </p>
    </div>
  );
}
