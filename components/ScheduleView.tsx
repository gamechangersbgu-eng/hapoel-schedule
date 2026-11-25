"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { copyPreviousWeekForm } from "@/app/actions";
import { TRAINING_SCHEDULE_DENIED } from "@/lib/roles";
import { Legend } from "@/components/Legend";
import { TeamFilter } from "@/components/TeamFilter";
import { TeamWeek } from "@/components/TeamWeek";
import { readTeamSelection, saveTeamSelection } from "@/lib/team-selection";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import type { WeekData } from "@/lib/types";

type ScheduleViewProps = {
  data: WeekData;
  editable?: boolean;
  message?: string;
  /** Copy-week rewrites trainings. Only the head manager. */
  canScheduleTrainings?: boolean;
  /** Phone view opens on this day when it belongs to the loaded week. */
  focusDay?: string;
};

export function ScheduleView({
  data,
  editable = false,
  message,
  canScheduleTrainings = false,
  focusDay,
}: ScheduleViewProps) {
  const scope = editable ? "admin" : "public";
  /** null = all teams. Remembered in this browser (shared with the phone view on the public page). */
  const [selected, setSelected] = useState<number[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only state after mount
    setSelected(readTeamSelection(scope));
  }, [scope]);
  function changeSelection(ids: number[] | null) {
    setSelected(ids);
    saveTeamSelection(scope, ids);
  }

  const teams = useMemo(() => {
    if (!selected) return data.teams;
    return data.teams.filter((team) => selected.includes(team.id) || team.isComments);
  }, [data.teams, selected]);

  const isEmpty = data.slots.length === 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-5">
      <div
        className={`no-print relative z-30 flex-wrap items-center justify-between gap-3 ${editable ? "flex" : "hidden md:flex"}`}
      >
        <div className={`items-center gap-2 ${editable ? "flex" : "hidden md:flex"}`}>
          <TeamFilter
            teams={data.teams.filter((team) => !team.isComments)}
            selected={selected}
            onChange={changeSelection}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && canScheduleTrainings ? (
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
          {canScheduleTrainings
            ? "מצב עריכה — לחצו על תא כדי להוסיף או לשנות אימון. השינוי יופיע מיד בקישור הציבורי."
            : `מצב עריכה — ${TRAINING_SCHEDULE_DENIED}. משחקים, חופש ושאר מסכי הניהול נשארים פתוחים.`}
        </p>
      ) : null}

      {isEmpty ? (
        <p className={`rounded-md ${editable ? "" : "hidden md:block"} border border-dashed border-[#c8102e] bg-white px-3 py-3 text-center text-sm font-medium text-zinc-600`}>
          אין אימונים בשבוע זה.
          {editable ? " לחצו על תא או העתיקו את השבוע הקודם." : ""}
        </p>
      ) : null}

      {message ? (
        <p className="no-print text-center text-sm font-bold text-[#8e0b20]">
          {message}
        </p>
      ) : null}

      {editable ? null : (
        <div className="md:hidden print:hidden">
          <TeamWeek data={data} focusDay={focusDay} />
        </div>
      )}

      <div
        className={`flex-col items-stretch gap-3 lg:flex-row lg:items-start ${
          editable ? "flex" : "hidden md:flex print:flex"
        }`}
      >
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
