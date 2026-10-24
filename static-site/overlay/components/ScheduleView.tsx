"use client";

import { useMemo, useState } from "react";
import { Legend } from "@/components/Legend";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import type { WeekData } from "@/lib/types";

type ScheduleViewProps = {
  data: WeekData;
};

// Static, read-only version of components/ScheduleView.tsx (no admin / server actions).
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
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-bold">
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
        <p className="rounded-md border border-dashed border-[#c8102e] bg-white px-3 py-3 text-center text-sm font-medium text-zinc-600">
          אין אימונים בשבוע זה.
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-start">
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
        גרסת הדגמה לקריאה בלבד עם נתוני דוגמה.
      </p>
    </div>
  );
}
