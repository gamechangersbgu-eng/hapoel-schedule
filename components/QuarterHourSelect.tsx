"use client";

import { QUARTER_HOUR_TIMES, isQuarterHour, roundToQuarterHour } from "@/lib/pitch-rules";

const MINUTES = ["00", "15", "30", "45"];

/** Hour plus quarter-hour minutes. A native time input ignores step on many phones. */
export function QuarterHourSelect({
  id,
  name,
  value,
  onChange,
  required,
  className,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const shown = !value ? "" : isQuarterHour(value) ? value : roundToQuarterHour(value);
  const [hour = "", minute = ""] = shown ? shown.split(":") : ["", ""];
  const hours = [...new Set(QUARTER_HOUR_TIMES.map((time) => time.slice(0, 2)))];
  if (hour && !hours.includes(hour)) hours.unshift(hour);
  const select = `min-h-11 min-w-0 flex-1 ${className ?? "rounded-lg border border-zinc-300 bg-white px-2 py-2 text-base"}`;

  function emit(nextHour: string, nextMinute: string) {
    if (!nextHour || !nextMinute) onChange("");
    else onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <div className="flex items-center gap-1" dir="ltr">
      <select
        id={id}
        aria-label="שעה"
        className={select}
        value={hour}
        required={required}
        onChange={(event) => emit(event.target.value, minute || "00")}
      >
        <option value="">שעה</option>
        {hours.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <span className="font-black text-zinc-400" aria-hidden>
        :
      </span>
      <select
        aria-label="דקות"
        className={select}
        value={minute}
        required={required}
        onChange={(event) => emit(hour, event.target.value)}
      >
        <option value="">דק׳</option>
        {MINUTES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={shown} />
    </div>
  );
}
