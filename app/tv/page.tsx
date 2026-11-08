import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { TvBoard } from "@/components/TvBoard";
import { getWeekData } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "לוח אימונים — מסך מועדון",
};

// Full-screen board for the club TV: always the current week, refreshed every minute.
export default async function TvPage() {
  const data = await getWeekData();
  return (
    <>
      <TvBoard data={data} />
      <AutoRefresh seconds={60} />
    </>
  );
}
