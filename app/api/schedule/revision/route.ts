import { NextResponse } from "next/server";
import { getScheduleRevision } from "@/lib/schedule-revision";

export const dynamic = "force-dynamic";

export async function GET() {
  const revision = await getScheduleRevision();
  return NextResponse.json(revision, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
