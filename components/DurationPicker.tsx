"use client";

import { DURATION_PRESETS, durationLabelHe, isOfficialDuration } from "@/lib/pitch-rules";

type DurationPickerProps = {
  value: number;
  onChange: (minutes: number) => void;
  /** Academy-only lengths, such as 4 hours. */
  extras?: { minutes: number; labelHe: string }[];
};

/** The official training lengths from the club guidelines. No custom duration menu. */
export function DurationPicker({ value, onChange, extras = [] }: DurationPickerProps) {
  const choices = [...DURATION_PRESETS, ...extras.filter((item) => !DURATION_PRESETS.some((preset) => preset.minutes === item.minutes))];
  const savedLegacy = value > 0 && !choices.some((item) => item.minutes === value);
  const chip = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-bold ring-1 ${
      active ? "bg-[#c8102e] text-white ring-[#c8102e]" : "bg-white text-zinc-800 ring-zinc-300"
    }`;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-bold">משך אימון</legend>
      <div className="flex flex-wrap items-center gap-2">
        {choices.map((item) => (
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
      </div>
      {savedLegacy ? (
        <p className="text-xs font-semibold text-amber-800">
          האימון שמור ל־{durationLabelHe(value)}. בחרו אחד המשמכים שמופיעים כאן כדי לעדכן.
        </p>
      ) : (
        <p className="text-xs font-semibold text-zinc-500">בחירת משך מעדכנת את שעת הסיום לפי שעת ההתחלה.</p>
      )}
    </fieldset>
  );
}
