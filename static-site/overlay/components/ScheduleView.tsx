"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Legend } from "@/components/Legend";
import { TeamFilter } from "@/components/TeamFilter";
import { TeamWeek } from "@/components/TeamWeek";
import { readTeamSelection, saveTeamSelection } from "@/lib/team-selection";
import { ScheduleGrid, type CellClick } from "@/components/ScheduleGrid";
import type { WeekData } from "@/lib/types";

export type SyncStatus = {
  state: "idle" | "saving" | "saved" | "error" | "loadError";
};

type ScheduleViewProps = {
  sync?: SyncStatus;
  onRetry?: () => void;
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
  sync = { state: "idle" },
  onRetry,
  onCellClick,
  onCopyPreviousWeek,
  onExport,
  onCopyJson,
  onImport,
  onReset,
}: ScheduleViewProps) {
  const scope = admin ? "admin" : "public";
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
  const primary =
    "rounded-md bg-[#c8102e] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#8e0b20]";
  const outline =
    "rounded-md border border-[#c8102e] px-3 py-1.5 text-sm font-bold text-[#c8102e] hover:bg-white";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-5">
      <div
        className={`no-print flex-wrap items-center justify-between gap-3 ${admin ? "flex" : "hidden md:flex"}`}
      >
        <div className={`items-center gap-2 ${admin ? "flex" : "hidden md:flex"}`}>
          <TeamFilter
            teams={data.teams.filter((team) => !team.isComments)}
            selected={selected}
            onChange={changeSelection}
          />
        </div>

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
          מצב מנהל — לחצו על תא כדי להוסיף, לערוך או למחוק אימון. כל שינוי נשמר אוטומטית ונראה
          לכל מי שפותח את האתר (ללא סיסמה). ״ייצוא״ מוריד גיבוי של הלוח.
        </p>
      ) : null}

      {message ? (
        <p role="status" className="no-print text-center text-sm font-bold text-[#8e0b20]">
          {message}
        </p>
      ) : null}

      {sync.state !== "idle" ? (
        <p
          role="status"
          data-testid="sync-status"
          className={`no-print text-center text-sm font-bold ${
            sync.state === "saved" ? "text-green-700" : sync.state === "saving" ? "text-zinc-600" : "text-[#c8102e]"
          }`}
        >
          {sync.state === "saving" ? "שומר..." : null}
          {sync.state === "saved" ? "נשמר לכולם" : null}
          {sync.state === "error" ? (
            <>
              השמירה לכולם נכשלה — השינוי נשמר רק בדפדפן הזה.{" "}
              <button type="button" onClick={onRetry} className="underline">
                נסו שוב
              </button>
            </>
          ) : null}
          {sync.state === "loadError" ? "לא הצלחנו לטעון עדכונים עדכניים, מוצג הלוח האחרון שנשמר." : null}
        </p>
      ) : null}

      {isEmpty ? (
        <p className={`rounded-md ${admin ? "" : "hidden md:block"} border border-dashed border-[#c8102e] bg-white px-3 py-3 text-center text-sm font-medium text-zinc-600`}>
          אין אימונים בשבוע זה.
          {admin ? " לחצו על תא או העתיקו את השבוע הקודם." : ""}
        </p>
      ) : null}

      {admin ? null : (
        <div className="md:hidden print:hidden">
          <TeamWeek data={data} />
        </div>
      )}

      <div
        className={`flex-col items-stretch gap-3 lg:flex-row lg:items-start ${
          admin ? "flex" : "hidden md:flex print:flex"
        }`}
      >
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
        אתר סטטי ב-GitHub Pages. הלוח משותף לכולם ונשמר בשירות אחסון ציבורי וללא הרשאות.
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
