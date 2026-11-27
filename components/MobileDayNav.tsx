"use client";

/** Phone day row: previous day, jump to today, next day. */
export function MobileDayNav({
  dayTitle,
  dateLabel,
  onPrevious,
  onToday,
  onNext,
  todayCurrent = false,
}: {
  dayTitle: string;
  dateLabel: string;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  todayCurrent?: boolean;
}) {
  const button =
    "min-h-11 rounded-xl px-2 text-sm font-black";
  const side = `${button} bg-[#f4e6e8] text-[#5c0814] dark:bg-zinc-800 dark:text-white`;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-sm font-black text-[#5c0814] dark:text-white">
        {dayTitle}
        <span className="block text-xs font-semibold text-zinc-500">{dateLabel}</span>
      </p>
      <div className="grid grid-cols-3 items-center gap-2">
        <button type="button" onClick={onPrevious} className={side}>
          → יום קודם
        </button>
        <button
          type="button"
          onClick={onToday}
          aria-current={todayCurrent ? "date" : undefined}
          className={`${button} bg-[#c8102e] text-white`}
        >
          היום
        </button>
        <button type="button" onClick={onNext} className={side}>
          יום הבא ←
        </button>
      </div>
    </div>
  );
}
