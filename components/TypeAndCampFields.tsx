"use client";

import { useState } from "react";
import { SLOT_TYPES, isCampSlot, isPitchSlot } from "@/lib/slot-types";

type TypeAndCampFieldsProps = {
  defaultType: string;
  defaultStartTime?: string | null;
  date: string;
  defaultEndDate?: string | null;
  weekOptions: string[];
};

export function TypeAndCampFields({
  defaultType,
  defaultStartTime,
  date,
  defaultEndDate,
  weekOptions,
}: TypeAndCampFieldsProps) {
  const [type, setType] = useState(defaultType);
  const pitchSelected = isPitchSlot(type);

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

      <label className="block text-sm font-bold">
        שעה {pitchSelected ? <span className="text-red-700">*</span> : null}
        <input
          type="time"
          name="startTime"
          defaultValue={defaultStartTime ?? ""}
          required={pitchSelected}
          className="mt-1 w-full rounded-md border border-zinc-300 p-2"
        />
      </label>

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
