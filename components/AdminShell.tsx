import type { ReactNode } from "react";
import Link from "next/link";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import type { CurrentAdmin } from "@/lib/auth";

/** Simple header for management pages that are not the weekly schedule. */
export function AdminShell({ user, title, children }: { user: CurrentAdmin; title: string; children: ReactNode }) {
  return (
    <div className="min-h-full bg-[#fff8f6]">
      <header className="bg-[linear-gradient(135deg,#c8102e_0%,#8e0b20_100%)] text-white">
        <div className="bg-[#ffd54f] px-3 py-1.5 text-center text-sm font-black text-[#3a2a00]">מצב מנהל</div>
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-white/75">הפועל באר שבע · ניהול</p>
            <h1 className="text-2xl font-black">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin" className="rounded-md bg-white px-3 py-1.5 text-sm font-black text-[#8e0b20] hover:bg-white/90">
              ניהול תכנית אימונים
            </Link>
            <AdminUserMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-5">{children}</main>
    </div>
  );
}
