"use client";

// Static-site version of app/tv/page.tsx: loads the same data as the static home page
// (base schedule + shared edits) and re-reads the shared edits every minute.
import { useCallback, useEffect, useMemo, useState } from "react";
import { TvBoard } from "@/components/TvBoard";
import {
  applyEdits,
  fetchPublishedSchedule,
  fetchSharedEdits,
  getWeekDataFrom,
  loadEdits,
  seedSchedule,
  sharedEnabled,
  storeEdits,
  type LocalEdits,
  type ScheduleFile,
} from "@/lib/static-schedule";
import { currentWeekStart } from "@/lib/week";

function Board() {
  const [base, setBase] = useState<ScheduleFile | null>(null);
  const [edits, setEdits] = useState<LocalEdits>(() => loadEdits());
  const [offline, setOffline] = useState(false);
  // Changes when the week rolls over (Saturday night -> Sunday), so the board moves to the new week.
  const [week, setWeek] = useState(currentWeekStart);

  const refresh = useCallback(async () => {
    setWeek(currentWeekStart());
    if (!sharedEnabled()) return;
    try {
      const remote = await fetchSharedEdits();
      setEdits(remote);
      storeEdits(remote);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedSchedule().then((published) => {
      if (!cancelled) setBase(published ?? seedSchedule());
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of shared edits
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const data = useMemo(
    () => (base ? getWeekDataFrom(applyEdits(base, edits), week) : null),
    [base, edits, week],
  );

  if (!data) {
    return (
      <div className="tv-root fixed inset-0 flex items-center justify-center text-2xl font-bold text-white">
        טוען לוח אימונים...
      </div>
    );
  }

  return (
    <TvBoard
      data={data}
      notice={offline ? "אין חיבור לעדכונים, מוצג הלוח האחרון שנשמר" : null}
    />
  );
}

export default function TvPage() {
  // Client-only: the demo data and "today" depend on the screen's own clock.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- render only after mounting
  useEffect(() => setMounted(true), []);
  return mounted ? <Board /> : null;
}
