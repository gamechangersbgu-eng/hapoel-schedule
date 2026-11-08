"use client";

// Static-site TV board. The week comes from the screen clock; the slots come only
// from the Postgres snapshot captured at build time.
import { useEffect, useState } from "react";
import { TvBoard } from "@/components/TvBoard";
import { getWeekDataFrom, scheduleSnapshot } from "@/lib/static-schedule";
import { currentWeekStart } from "@/lib/week";

export default function TvPage() {
  const [week, setWeek] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setWeek(currentWeekStart());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!week) {
    return (
      <div className="tv-root fixed inset-0 flex items-center justify-center text-2xl font-bold text-white">
        טוען לוח אימונים...
      </div>
    );
  }

  return <TvBoard data={getWeekDataFrom(scheduleSnapshot(), week)} />;
}
