import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { EditSlotForm } from "@/components/EditSlotForm";
import { ScheduleView } from "@/components/ScheduleView";
import { getWeekData } from "@/lib/schedule";

export const dynamic = "force-dynamic";

type AdminProps = {
  searchParams: Promise<{
    week?: string;
    team?: string;
    date?: string;
    slot?: string;
    error?: string;
    copied?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminProps) {
  const params = await searchParams;
  const data = await getWeekData(params.week);
  const selectedTeam = data.teams.find(
    (team) => String(team.id) === params.team,
  );
  const selectedDate = params.date;
  const slotId = params.slot ? Number(params.slot) : undefined;
  const message = params.copied
    ? "השבוע הקודם הועתק"
    : params.error && !selectedTeam
      ? params.error
      : undefined;

  return (
    <div className="min-h-full">
      <AppHeader
        clubName={data.clubName}
        weekNumber={data.weekNumber}
        weekStart={data.weekStart}
        basePath="/admin"
      >
        <Link
          href={`/?week=${data.weekStart}`}
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10"
        >
          תצוגה ציבורית
        </Link>
      </AppHeader>
      <ScheduleView data={data} editable message={message} />
      {selectedTeam && selectedDate ? (
        <EditSlotForm
          team={selectedTeam}
          date={selectedDate}
          weekStart={data.weekStart}
          slots={data.slots}
          slotId={Number.isFinite(slotId) ? slotId : undefined}
          error={params.error}
        />
      ) : null}
    </div>
  );
}
