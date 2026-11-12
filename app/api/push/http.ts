import { NextResponse } from "next/server";
import { pushCorsHeaders } from "@/lib/push-subscription";

export function pushJson(request: Request, body: unknown, status = 200) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const cors = pushCorsHeaders(request.headers.get("origin"));
  if (cors) {
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  }
  return NextResponse.json(body, { status, headers });
}

export function pushPreflight(request: Request) {
  const cors = pushCorsHeaders(request.headers.get("origin"));
  if (!cors) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: cors });
}
