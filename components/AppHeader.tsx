import type { ReactNode } from "react";
import { ClubLogo } from "@/components/ClubLogo";
import { WeekNav } from "@/components/WeekNav";
import { formatWeekRange } from "@/lib/week";

type AppHeaderProps = {
  clubName: string;
  weekNumber: number;
  weekStart: string;
  basePath: string;
  children?: ReactNode;
  /** Phone: show only the club bar (the phone view has its own week bar). */
  compactOnMobile?: boolean;
  /** Admin pages: a clear "management mode" bar, so it is never confused with the public page. */
  adminMode?: boolean;
};

export function AppHeader({
  clubName,
  weekNumber,
  weekStart,
  basePath,
  children,
  compactOnMobile = false,
  adminMode = false,
}: AppHeaderProps) {
  return (
    <header className="bg-[linear-gradient(180deg,#c8102e_0%,#8e0b20_100%)] text-white shadow-md">
      {adminMode ? (
        <div className="no-print bg-[#ffd54f] px-3 py-1.5 text-center text-sm font-black text-[#3a2a00]">
          מצב מנהל
        </div>
      ) : null}
      <div
        className={`mx-auto flex max-w-[1400px] flex-col gap-3 px-3 sm:px-5 ${
          compactOnMobile ? "py-2.5 md:py-4" : "py-4"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <ClubLogo plate />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-white/80">
                מחלקת הנוער
              </p>
              <h1 className="text-xl font-black leading-tight sm:text-2xl">
                {clubName}
              </h1>
            </div>
          </div>
          <div className="no-print flex flex-wrap items-center justify-end gap-2">{children}</div>
        </div>
        <div
          className={`flex-col items-center gap-2 border-t border-white/20 pt-3 text-center ${
            compactOnMobile ? "hidden md:flex print:flex" : "flex"
          }`}
        >
          <h2 className="text-lg font-extrabold sm:text-xl">
            {adminMode ? "ניהול תכנית אימונים" : "תכנית אימונים מחלקתית"} — שבוע {weekNumber}
          </h2>
          <p className="text-sm text-white/85">{formatWeekRange(weekStart)}</p>
          <WeekNav weekStart={weekStart} basePath={basePath} />
        </div>
      </div>
    </header>
  );
}
