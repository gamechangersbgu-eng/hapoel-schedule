"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ScheduleView } from "@/components/ScheduleView";
import { getWeekDataStatic } from "@/lib/static-schedule";

function Schedule() {
  const week = useSearchParams().get("week");
  const data = getWeekDataStatic(week);
  return (
    <div className="min-h-full">
      <AppHeader
        clubName={data.clubName}
        weekNumber={data.weekNumber}
        weekStart={data.weekStart}
        basePath="/"
      />
      <ScheduleView data={data} />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center text-sm font-bold text-[#8e0b20]">
      טוען לוח אימונים...
    </div>
  );
}

export default function HomePage() {
  // Render client-side only: the demo data depends on the visitor's current date.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Suspense fallback={<Loading />}>{mounted ? <Schedule /> : <Loading />}</Suspense>
  );
}
