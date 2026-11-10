"use client";

import { DURATION_PRESETS, durationLabelHe } from "@/lib/pitch-rules";

const OTHER_MINUTES = [30, 45, 75, 90, 135, 150, 165, 180];

type DurationPickerProps = {
  value: number;
  onChange: (minutes: number) => void;
  presets?: { minutes: number; labelHe: string }[];
};

export function DurationPicker({ value, onChange, presets }: DurationPickerProps) {
  const chips = (presets && presets.length > 0 ? presets : DURATION_PRESETS).filter(
    (item, index, list) => list.findIndex((row) => row.minutes === item.minutes) === index,
  );
  const chipMinutes = new Set(chips.map((item) => item.minutes));
  const extra =
    value > 0 && !chipMinutes.has(value) ? [{ minutes: value, labelHe: durationLabelHe(value) }] : [];
  const chip = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-bold ring-1 ${
      active ? "bg-[#c8102e] text-white ring-[#c8102e]" : "bg-white text-zinc-800 ring-zinc-300"
    }`;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-bold">משך אימון</legend>
      <div className="flex flex-wrap items-center gap-2">
        {chips.concat(extra).map((item) => (
          <button
            key={item.minutes}
            type="button"
            onClick={() => onChange(item.minutes)}
            aria-pressed={item.minutes === value}
            className={chip(item.minutes === value)}
          >
            {item.labelHe}
          </button>
        ))}
        <label className="text-sm font-bold">
          <span className="sr-only">משך אחר</span>
          <select
            value={chipMinutes.has(value) ? "" : value > 0 ? String(value) : ""}
            onChange={(event) => {
              const minutes = Number(event.target.value);
              if (minutes > 0) onChange(minutes);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm font-bold"
          >
            <option value="">משך אחר…</option>
            {OTHER_MINUTES.filter((minutes) => !chipMinutes.has(minutes)).map((minutes) => (
              <option key={minutes} value={minutes}>
                {durationLabelHe(minutes)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs font-semibold text-zinc-500">בחירת משך מעדכנת את שעת הסיום לפי שעת ההתחלה.</p>
    </fieldset>
  );
}
