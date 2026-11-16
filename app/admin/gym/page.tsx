import type { Metadata } from "next";
import { RoomSchedule } from "@/components/RoomSchedule";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "חדר כושר · מצב מנהל" };

type Props = { searchParams: Promise<{ week?: string; new?: string; edit?: string; saved?: string; skipped?: string }> };

export default async function Page({ searchParams }: Props) {
  return <RoomSchedule kind="gym" params={await searchParams} />;
}
