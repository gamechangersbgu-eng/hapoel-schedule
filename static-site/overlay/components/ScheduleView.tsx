"use client";

import { useMemo, useState } from "react";
import { Legend } from "@/components/Legend";
import { ScheduleGrid, type CellClick } from "@/components/ScheduleGrid";
import type { WeekData } from "@/lib/types";

type ScheduleViewProps = {
  data: WeekData;
  admin: boolean;
  hasEdits: boolean;
  message?: string | null;
  onCellClick: CellClick;
  onCopyPreviousWeek: () => void;
  onExport: () => void;
  onCopyJson: () => void;
  onImport: () => void;
  onReset: () => void;
};

// Static version of components/ScheduleView.tsx: admin mode is a client-side switch.
export function ScheduleView({
  data,
  admin,
  hasEdits,
  message,
  onCellClick,
  onCopyPreviousWeek,
  onExport,
  onCopyJson,
  onImport,
  onReset,
}: ScheduleViewProps) {
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const teams = useMemo(() => {
    if (teamFilter === "all") return data.teams;
    return data.teams.filter(
      (team) => String(team.id) === teamFilter || team.isComments,
    );
  }, [data.teams, teamFilter]);

  const isEmpty = data.slots.length === 0;
  const primary =
    "rounded-md bg-[#c8102e] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#8e0b20]";
  const outline =
    "rounded-md border border-[#c8102e] px-3 py-1.5 text-sm font-bold text-[#c8102e] hover:bg-white";

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
          {admin ? (
            <>
              <button type="button" onClick={onCopyPreviousWeek} className={primary}>
                העתק שבוע קודם
              </button>
              <button type="button" onClick={onExport} className={primary}>
                ייצוא
              </button>
              <button type="button" onClick={onCopyJson} className={outline}>
                העתק JSON
              </button>
              <button type="button" onClick={onImport} className={outline}>
                ייבוא
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={!hasEdits}
                className="rounded-md px-3 py-1.5 text-sm font-bold text-zinc-600 hover:bg-white disabled:opacity-40"
              >
                אפס לברירת מחדל
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className={outline}
          >
            הדפסה
          </button>
        </div>
      </div>

      {admin ? (
        <p className="no-print rounded-md bg-white px-3 py-2 text-sm font-medium text-[#8e0b20] shadow-sm">
          מצב מנהל — לחצו על תא כדי להוסיף, לערוך או למחוק אימון. השינויים נשמרים בדפדפן הזה
          בלבד. כדי לפרסם אותם לכולם לחצו ״ייצוא״ והעלו את הקובץ ל-GitHub (ראו README).
          {hasEdits ? " יש שינויים מקומיים שלא פורסמו." : ""}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="no-print text-center text-sm font-bold text-[#8e0b20]">
          {message}
        </p>
      ) : null}

      {isEmpty ? (
        <p className="rounded-md border border-dashed border-[#c8102e] bg-white px-3 py-3 text-center text-sm font-medium text-zinc-600">
          אין אימונים בשבוע זה.
          {admin ? " לחצו על תא או העתיקו את השבוע הקודם." : ""}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ScheduleGrid
            dates={data.dates}
            teams={teams}
            slots={data.slots}
            editable={admin}
            onCellClick={onCellClick}
          />
        </div>
        <Legend />
      </div>
      <p className="no-print pb-6 text-center text-xs text-zinc-500">
        אתר סטטי ב-GitHub Pages. עריכות נשמרות בדפדפן של המנהל ומתפרסמות לכולם רק דרך קובץ
        schedule-data.json.
      </p>
    </div>
  );
}
