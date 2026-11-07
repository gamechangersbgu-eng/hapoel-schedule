import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { EditSlotForm } from "@/components/EditSlotForm";
import { ScheduleView } from "@/components/ScheduleView";
import { ScheduleLiveRefresh } from "@/components/ScheduleLiveRefresh";
import { getWeekData } from "@/lib/schedule";
import { getScheduleRevision } from "@/lib/schedule-revision";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "מצב מנהל · תכנית אימונים" };

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
  const user = await requireAdmin();
  const params = await searchParams;
  const [data, revision] = await Promise.all([
    getWeekData(params.week),
    getScheduleRevision(),
  ]);
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
      <ScheduleLiveRefresh initialVersion={revision.version} />
      <AppHeader
        clubName={data.clubName}
        weekNumber={data.weekNumber}
        weekStart={data.weekStart}
        basePath="/admin"
        adminMode
      >
        <Link
          href="/admin/pitches"
          className="rounded-md bg-white px-3 py-1.5 text-sm font-black text-[#8e0b20] hover:bg-white/90"
        >
          לוח שיבוץ מגרשים
        </Link>
        <Link
          href={`/?week=${data.weekStart}`}
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10"
        >
          תצוגה ציבורית
        </Link>
        <AdminUserMenu user={user} />
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
