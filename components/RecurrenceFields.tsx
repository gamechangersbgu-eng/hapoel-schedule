"use client";

import { useState } from "react";
import { weekdayOf } from "@/lib/pitch-rules";
import { buildOccurrenceDates, effectiveInterval, MAX_SERIES_OCCURRENCES, type SeriesIntervalDays } from "@/lib/recurrence";
import { HEBREW_DAY_LETTERS, addDaysISO } from "@/lib/week";

const chip = (active: boolean) =>
  `min-h-11 rounded-lg px-3 py-2 text-sm font-bold ring-1 ${
    active ? "bg-[#c8102e] text-white ring-[#c8102e]" : "bg-white text-zinc-800 ring-zinc-300"
  }`;

export function RecurrenceFields({
  anchor,
  enabled,
  onEnabled,
  weekdays,
  onWeekdays,
  until,
  onUntil,
  extraDates,
  onExtraDates,
  allowBiweekly = false,
  intervalDays = 7,
  onIntervalDays,
  title = "אימון חוזר — אותה שעה בימים ובמועדים שתבחרו",
}: {
  anchor: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  weekdays: number[];
  onWeekdays: (days: number[]) => void;
  until: string;
  onUntil: (value: string) => void;
  extraDates: string[];
  onExtraDates: (dates: string[]) => void;
  /** Football school only. Other teams keep the weekly checkbox and never see the second option. */
  allowBiweekly?: boolean;
  intervalDays?: SeriesIntervalDays;
  onIntervalDays?: (value: SeriesIntervalDays) => void;
  /** Checkbox label. Trainings keep the default; room bookings say "שיבוץ חוזר". */
  title?: string;
}) {
  const [draft, setDraft] = useState("");
  const interval = effectiveInterval(allowBiweekly, intervalDays);
  const built = buildOccurrenceDates({
    anchor,
    weekdays: enabled ? weekdays : [],
    until: enabled ? until : "",
    extraDates: enabled ? extraDates : [],
    intervalDays: interval,
  });

  function enable(checked: boolean) {
    onEnabled(checked);
    if (!checked) return;
    if (weekdays.length === 0 && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) onWeekdays([weekdayOf(anchor)]);
    if (!until && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) onUntil(addDaysISO(anchor, 7 * 12));
  }

  function chooseInterval(next: SeriesIntervalDays) {
    if (enabled && interval === next) {
      enable(false);
      return;
    }
    onIntervalDays?.(next);
    if (!enabled) enable(true);
  }

  function addDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft) || extraDates.includes(draft) || draft === anchor) {
      setDraft("");
      return;
    }
    onExtraDates([...extraDates, draft].sort());
    setDraft("");
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3">
      <legend className="sr-only">{title.split(" — ")[0]}</legend>
      <label className="flex items-start gap-2 text-sm font-bold">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={enabled}
          onChange={(event) => {
            if (event.target.checked && allowBiweekly) onIntervalDays?.(7);
            enable(event.target.checked);
          }}
        />
        {title}
      </label>
      {allowBiweekly ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">תדירות</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={enabled && interval === 7}
              onClick={() => chooseInterval(7)}
              className={chip(enabled && interval === 7)}
            >
              לחזור על זה כל שבוע
            </button>
            <button
              type="button"
              aria-pressed={enabled && interval === 14}
              onClick={() => chooseInterval(14)}
              className={chip(enabled && interval === 14)}
            >
              לחזור על זה פעם בשבועיים
            </button>
          </div>
        </div>
      ) : null}
      {enabled ? (
        <>
          <p className="text-sm font-bold">ימים בשבוע</p>
          <div className="flex flex-wrap gap-2">
            {HEBREW_DAY_LETTERS.map((letter, index) => (
              <button
                key={letter}
                type="button"
                aria-pressed={weekdays.includes(index)}
                onClick={() =>
                  onWeekdays(
                    weekdays.includes(index)
                      ? weekdays.filter((day) => day !== index)
                      : [...weekdays, index].sort(),
                  )
                }
                className={chip(weekdays.includes(index))}
              >
                {letter}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm font-bold">
            עד תאריך (כולל)
            <input
              type="date"
              dir="ltr"
              value={until}
              onChange={(event) => onUntil(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base"
            />
          </label>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold">או תאריכים מסוימים</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                dir="ltr"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base"
              />
              <button type="button" onClick={addDate} className="min-h-11 rounded-lg px-3 text-sm font-black text-[#8e0b20] ring-1 ring-[#d7b4b8]">
                הוספה
              </button>
            </div>
            {extraDates.length ? (
              <ul className="flex flex-wrap gap-2">
                {extraDates.map((date) => (
                  <li key={date}>
                    <button
                      type="button"
                      onClick={() => onExtraDates(extraDates.filter((item) => item !== date))}
                      className="rounded-full bg-white px-3 py-1 text-sm font-bold ring-1 ring-zinc-300"
                    >
                      <span dir="ltr">{date.split("-").reverse().join(".")}</span>
                      <span className="ms-1 text-red-700">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <p className="text-sm font-bold text-zinc-700">
            {built.dates.length > 1
              ? interval === 14
                ? `יישמרו ${built.dates.length} מועדים, פעם בשבועיים, כולל היום הזה.`
                : `יישמרו ${built.dates.length} מועדים, כולל היום הזה.`
              : "עדיין מועד אחד. בחרו ימים עד תאריך, או הוסיפו תאריכים."}
            {built.truncated ? ` אפשר עד ${MAX_SERIES_OCCURRENCES} מועדים, והרשימה קוצרה.` : ""}
          </p>
        </>
      ) : null}
    </fieldset>
  );
}
