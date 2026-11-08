"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ScheduleView } from "@/components/ScheduleView";
import { getWeekDataFrom, scheduleSnapshot } from "@/lib/static-schedule";

function Schedule() {
  const week = useSearchParams().get("week");
  const data = getWeekDataFrom(scheduleSnapshot(), week);

  return (
    <div className="min-h-full">
      <AppHeader
        clubName={data.clubName}
        weekNumber={data.weekNumber}
        weekStart={data.weekStart}
        basePath="/"
        compactOnMobile
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
  return (
    <Suspense fallback={<Loading />}>
      <Schedule />
    </Suspense>
  );
}
