import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ScheduleView } from "@/components/ScheduleView";
import { getWeekData } from "@/lib/schedule";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function HomePage({ searchParams }: HomeProps) {
  const { week } = await searchParams;
  const data = await getWeekData(week);

  return (
    <div className="min-h-full">
      <AppHeader
        clubName={data.clubName}
        weekNumber={data.weekNumber}
        weekStart={data.weekStart}
        basePath="/"
      >
        <Link
          href="/admin"
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10"
        >
          כניסת מנהל
        </Link>
      </AppHeader>
      <ScheduleView data={data} />
    </div>
  );
}
