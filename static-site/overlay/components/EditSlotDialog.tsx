"use client";

import { useState } from "react";
import { SLOT_TYPES, isCampSlot, isPitchSlot } from "@/lib/slot-types";
import type { SlotInput } from "@/lib/static-schedule";
import {
  DEFAULT_MINUTES,
  QUARTER_HOURS,
  effectiveEnd,
  formatRange,
  fromMinutes,
  toMinutes,
} from "@/lib/time-range";
import type { SlotDTO, TeamDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/week";

type Props = {
  team: TeamDTO;
  date: string;
  weekStart: string;
  slots: SlotDTO[];
  initialSlotId?: number;
  onSave: (input: SlotInput) => string | null;
  onDelete: (id: number) => void;
  onClose: () => void;
};

// Client-side replacement for components/EditSlotForm.tsx + TypeAndCampFields.tsx.
export function EditSlotDialog({
  team,
  date,
  weekStart,
  slots,
  initialSlotId,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const cellSlots = slots.filter((slot) => {
    if (slot.teamId !== team.id) return false;
    if (isCampSlot(slot.type)) {
      const end = slot.endDate ?? slot.date;
      return slot.date <= date && end >= date;
    }
    return slot.date === date;
  });

  const [editingId, setEditingId] = useState<number | undefined>(
    initialSlotId ?? (cellSlots.length === 1 ? cellSlots[0].id : undefined),
  );
  const editing = cellSlots.find((slot) => slot.id === editingId);

  const [type, setType] = useState(
    editing?.type ?? (team.isComments ? "other" : "vasermil_1"),
  );
  const [startTime, setStartTime] = useState(editing?.startTime ?? "");
  // Older items have no end time: pre-fill start + 90 minutes so it can be confirmed or changed.
  const [endTime, setEndTime] = useState(editing ? (effectiveEnd(editing) ?? "") : "");
  const [endDate, setEndDate] = useState(editing?.endDate ?? date);
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const formDate = editing?.date ?? date;
  const weekOptions = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)).filter(
    (option) => option >= formDate,
  );
  const pitch = isPitchSlot(type);
  const displayDate = date.split("-").reverse().join(".");

  function startEditing(slot?: SlotDTO) {
    setEditingId(slot?.id);
    setType(slot?.type ?? (team.isComments ? "other" : "vasermil_1"));
    setStartTime(slot?.startTime ?? "");
    setEndTime(slot ? (effectiveEnd(slot) ?? "") : "");
    setEndDate(slot?.endDate ?? date);
    setNote(slot?.note ?? "");
    setError(null);
  }

  // Quarter-hour choices (plus an existing off-grid value, so older items stay editable).
  function withCurrent(value: string) {
    return value && !QUARTER_HOURS.includes(value) ? [...QUARTER_HOURS, value].sort() : QUARTER_HOURS;
  }

  // Picking a start fills a default end (+90 min) when there is none or it would not be after the start.
  function changeStart(value: string) {
    setStartTime(value);
    if (value && (!endTime || toMinutes(endTime) <= toMinutes(value))) {
      setEndTime(fromMinutes(toMinutes(value) + DEFAULT_MINUTES));
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = onSave({
      id: editing?.id,
      teamId: team.id,
      date: formDate,
      endDate: isCampSlot(type) ? endDate : null,
      startTime,
      endTime,
      type,
      note,
    });
    if (result) setError(result);
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`עריכת לוח ${team.name}`}
    >
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 text-right shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#8e0b20]">{team.name}</h3>
            <p className="text-sm text-zinc-600">{displayDate}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-bold text-zinc-500 hover:bg-zinc-100"
          >
            סגור
          </button>
        </div>

        {cellSlots.length > 0 ? (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500">אימונים קיימים</p>
            {cellSlots.map((slot) => {
              const style = SLOT_TYPES.find((item) => item.id === slot.type);
              return (
                <div key={slot.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => startEditing(slot)}
                    className="flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: style?.bg, color: style?.fg }}
                  >
                    <span>{style?.label}</span>
                    <span dir="ltr">{formatRange(slot) || slot.note || "עריכה"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(slot.id)}
                    className="h-auto rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50"
                  >
                    מחק
                  </button>
                </div>
              );
            })}
            {editing ? (
              <button
                type="button"
                onClick={() => startEditing(undefined)}
                className="block w-full rounded-lg border border-dashed border-[#c8102e] py-2 text-center text-sm font-bold text-[#c8102e]"
              >
                + הוסף אימון נוסף
              </button>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm font-black text-[#8e0b20]">
            {editing ? "עריכת אימון" : "אימון חדש"}
          </p>

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
            <label className="block text-sm font-bold">
              שעת התחלה {pitch ? <span className="text-red-700">*</span> : null}
              <select
                name="startTime"
                value={startTime}
                onChange={(event) => changeStart(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 p-2"
                dir="ltr"
              >
                <option value="">בחרו שעה</option>
                {withCurrent(startTime).map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              שעת סיום {pitch ? <span className="text-red-700">*</span> : null}
              <select
                name="endTime"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 p-2"
                dir="ltr"
              >
                <option value="">בחרו שעה</option>
                {withCurrent(endTime).map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isCampSlot(type) ? (
            <label className="block text-sm font-bold">
              עד יום
              <select
                name="endDate"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 p-2"
              >
                {weekOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.split("-").reverse().join(".")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-sm font-bold">
            הערה
            <input
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-medium"
              placeholder={team.isComments ? "טקסט להערה..." : "למשל התרשמות"}
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              className="rounded-md bg-[#c8102e] px-4 py-2 text-sm font-bold text-white hover:bg-[#8e0b20]"
            >
              שמירה
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
