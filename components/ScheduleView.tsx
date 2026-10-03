"use client";

import { useMemo, useState } from "react";
import { copyPreviousWeekForm, logoutAction } from "@/app/actions";
import { Legend } from "@/components/Legend";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import type { WeekData } from "@/lib/types";

type ScheduleViewProps = {
  data: WeekData;
  editable?: boolean;
  message?: string;
};

export function ScheduleView({
  data,
  editable = false,
  message,
}: ScheduleViewProps) {
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

        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              <form action={copyPreviousWeekForm}>
                <input type="hidden" name="week" value={data.weekStart} />
                <button
                  type="submit"
                  className="rounded-md bg-[#c8102e] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#8e0b20]"
                >
                  העתק שבוע קודם
                </button>
              </form>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-[#c8102e] px-3 py-1.5 text-sm font-bold text-[#c8102e]"
              >
                הדפסה
              </button>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 text-sm font-bold text-zinc-600 hover:bg-white"
                >
                  יציאה
                </button>
              </form>
            </>
          ) : (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-[#c8102e] px-3 py-1.5 text-sm font-bold text-[#c8102e]"
            >
              הדפסה
            </button>
          )}
        </div>
      </div>

      {editable ? (
        <p className="no-print rounded-md bg-white px-3 py-2 text-sm font-medium text-[#8e0b20] shadow-sm">
          מצב עריכה — לחצו על תא כדי להוסיף או לשנות אימון. השינוי יופיע מיד בקישור
          הציבורי.
        </p>
      ) : null}

      {isEmpty ? (
        <p className="rounded-md border border-dashed border-[#c8102e] bg-white px-3 py-3 text-center text-sm font-medium text-zinc-600">
          אין אימונים בשבוע זה.
          {editable ? " לחצו על תא או העתיקו את השבוע הקודם." : ""}
        </p>
      ) : null}

      {message ? (
        <p className="no-print text-center text-sm font-bold text-[#8e0b20]">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ScheduleGrid
            dates={data.dates}
            teams={teams}
            slots={data.slots}
            editable={editable}
            weekStart={data.weekStart}
          />
        </div>
        <Legend />
      </div>
      <p className="no-print pb-6 text-center text-xs text-zinc-500">
        הלוח מתעדכן אונליין. אין צורך לשלוח PDF אחרי כל שינוי.
      </p>
    </div>
  );
}
