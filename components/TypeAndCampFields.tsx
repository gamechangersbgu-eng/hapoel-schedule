"use client";

import { useState } from "react";
import { QuarterHourSelect } from "@/components/QuarterHourSelect";
import { roundToQuarterHour } from "@/lib/pitch-rules";
import { SLOT_TYPES, isCampSlot, isPitchSlot, isPracticeGame } from "@/lib/slot-types";

type TypeAndCampFieldsProps = {
  defaultType: string;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  date: string;
  defaultEndDate?: string | null;
  weekOptions: string[];
  onTypeChange?: (type: string) => void;
  /** Omit training types when this manager cannot schedule them. */
  types?: readonly { id: string; label: string }[];
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
  onTypeChange,
  types = SLOT_TYPES,
}: TypeAndCampFieldsProps) {
  const [type, setType] = useState(defaultType);
  const pitchSelected = isPitchSlot(type);
  const timed = pitchSelected || isPracticeGame(type);
  const timeField = "mt-1 w-full rounded-md border border-zinc-300 p-2 tabular-nums";

  return (
    <>
      <label className="block text-sm font-bold">
        סוג
        <select
          name="type"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            onTypeChange?.(event.target.value);
          }}
          className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-medium"
        >
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="block text-sm font-bold">
          <label htmlFor="slot-start">
            שעת התחלה {timed ? <span className="text-red-700">*</span> : null}
          </label>
          <QuarterHourSelect
            id="slot-start"
            name="startTime"
            value={startTime}
            required={timed}
            onChange={(value) => onStartTimeChange(roundToQuarterHour(value))}
            className={timeField}
          />
        </div>
        {timed ? (
          <div className="block text-sm font-bold">
            <label htmlFor="slot-end">שעת סיום</label>
            <QuarterHourSelect
              id="slot-end"
              name="endTime"
              value={endTime}
              onChange={(value) => onEndTimeChange(roundToQuarterHour(value))}
              className={timeField}
            />
          </div>
        ) : null}
        <p className="col-span-2 text-xs font-semibold text-zinc-500">השעות בקפיצות של רבע שעה.</p>
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
