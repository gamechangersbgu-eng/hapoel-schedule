import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_DISABLED, SESSION_COOKIE, decryptSession } from "@/lib/session";

// Quick check on management pages: no valid session cookie → login page.
// The full check (user still active, etc.) runs in each page and action (lib/auth.ts).
export async function proxy(request: NextRequest) {
  if (AUTH_DISABLED) return NextResponse.next();
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
