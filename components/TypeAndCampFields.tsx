"use client";

import { useState } from "react";
import { normalizeClock } from "@/lib/pitch-rules";
import { SLOT_TYPES, isCampSlot, isPitchSlot } from "@/lib/slot-types";

type TypeAndCampFieldsProps = {
  defaultType: string;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  date: string;
  defaultEndDate?: string | null;
  weekOptions: string[];
};

export function TypeAndCampFields({
  defaultType,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  date,
  defaultEndDate,
  weekOptions,
}: TypeAndCampFieldsProps) {
  const [type, setType] = useState(defaultType);
  const pitchSelected = isPitchSlot(type);
  const timeField = "mt-1 w-full rounded-md border border-zinc-300 p-2 tabular-nums";

  return (
    <>
      <label className="block text-sm font-bold">
        סוג
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-medium"
        >
          {SLOT_TYPES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <div className="block text-sm font-bold">
          <label htmlFor="slot-start">
            שעת התחלה {pitchSelected ? <span className="text-red-700">*</span> : null}
          </label>
          <input
            id="slot-start"
            type="time"
            name="startTime"
            dir="ltr"
            step={60}
            value={startTime}
            required={pitchSelected}
            onChange={(event) => onStartTimeChange(normalizeClock(event.target.value))}
            className={timeField}
          />
        </div>
        {pitchSelected ? (
          <div className="block text-sm font-bold">
            <label htmlFor="slot-end">שעת סיום</label>
            <input
              id="slot-end"
              type="time"
              name="endTime"
              dir="ltr"
              step={60}
              value={endTime}
              onChange={(event) => onEndTimeChange(normalizeClock(event.target.value))}
              className={timeField}
            />
          </div>
        ) : null}
      </div>

      {isCampSlot(type) ? (
        <label className="block text-sm font-bold">
          עד יום
          <select
            name="endDate"
            defaultValue={defaultEndDate ?? date}
            className="mt-1 w-full rounded-md border border-zinc-300 p-2"
          >
            {weekOptions
              .filter((option) => option >= date)
              .map((option) => (
                <option key={option} value={option}>
                  {option.split("-").reverse().join(".")}
                </option>
              ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
