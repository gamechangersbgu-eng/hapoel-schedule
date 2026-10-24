"use client";

import { HEBREW_DAY_LETTERS, addDaysISO, currentWeekStart } from "@/lib/week";

type WeekNavProps = {
  weekStart: string;
  basePath: string;
};

// Static-site version: week navigation only changes ?week=... via the History API
// (Next.js keeps useSearchParams in sync), so no server round trip is needed.
export function WeekNav({ weekStart }: WeekNavProps) {
  const today = currentWeekStart();

  function go(next: string) {
    window.history.pushState(null, "", `?week=${next}`);
  }

  return (
    <nav className="no-print flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => go(addDaysISO(weekStart, -7))}
        className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
      >
        → שבוע קודם
      </button>
      {weekStart !== today ? (
        <button
          type="button"
          onClick={() => go(today)}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-bold text-[#c8102e] hover:bg-zinc-100"
        >
          השבוע
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => go(addDaysISO(weekStart, 7))}
        className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
      >
        שבוע הבא ←
      </button>
      <span className="sr-only">
        ניווט שבועות {HEBREW_DAY_LETTERS[0]} עד {HEBREW_DAY_LETTERS[6]}
      </span>
    </nav>
  );
}
