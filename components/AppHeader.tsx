import type { ReactNode } from "react";
import { WeekNav } from "@/components/WeekNav";
import { formatWeekRange } from "@/lib/week";

type AppHeaderProps = {
  clubName: string;
  weekNumber: number;
  weekStart: string;
  basePath: string;
  children?: ReactNode;
};

export function AppHeader({
  clubName,
  weekNumber,
  weekStart,
  basePath,
  children,
}: AppHeaderProps) {
  return (
    <header className="bg-[linear-gradient(180deg,#c8102e_0%,#8e0b20_100%)] text-white shadow-md">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-white/80">
                מחלקת הנוער
              </p>
              <h1 className="text-xl font-black leading-tight sm:text-2xl">
                {clubName}
              </h1>
            </div>
          </div>
          <div className="no-print">{children}</div>
        </div>
        <div className="flex flex-col items-center gap-2 border-t border-white/20 pt-3 text-center">
          <h2 className="text-lg font-extrabold sm:text-xl">
            תכנית אימונים מחלקתית — שבוע {weekNumber}
          </h2>
          <p className="text-sm text-white/85">{formatWeekRange(weekStart)}</p>
          <WeekNav weekStart={weekStart} basePath={basePath} />
        </div>
      </div>
    </header>
  );
}
