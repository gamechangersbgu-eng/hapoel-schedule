"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { deleteSlotForm, previewWeeklySeries, saveSlotForm } from "@/app/actions";
import { DurationPicker } from "@/components/DurationPicker";
import { RecurrenceFields } from "@/components/RecurrenceFields";
import { SeriesConflictReview } from "@/components/SeriesConflictReview";
import { TypeAndCampFields } from "@/components/TypeAndCampFields";
import { SLOT_TYPES, isCampSlot } from "@/lib/slot-types";
import {
  clocksAfterDurationChange,
  clocksAfterEndChange,
  clocksAfterStartChange,
  durationBetween,
  roundToQuarterHour,
  toMinutes,
  toTime,
  type BoardRotation,
} from "@/lib/pitch-rules";
import {
  buildOccurrenceDates,
  effectiveInterval,
  occurrenceDecision,
  type OccurrencePreview,
  type SeriesChoice,
  type SeriesIntervalDays,
} from "@/lib/recurrence";
import { biweeklyRepeatAllowed } from "@/lib/team-labels";
import type { SlotDTO, TeamDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/week";

type EditSlotFormProps = {
  team: TeamDTO;
  date: string;
  weekStart: string;
  slots: SlotDTO[];
  slotId?: number;
  error?: string;
  rotations: BoardRotation[];
};

export function EditSlotForm({
  team,
  date,
  weekStart,
  slots,
  slotId,
  error,
  rotations,
}: EditSlotFormProps) {
  const cellSlots = slots.filter((slot) => {
    if (slot.teamId !== team.id) return false;
    if (isCampSlot(slot.type)) {
      const end = slot.endDate ?? slot.date;
      return slot.date <= date && end >= date;
    }
    return slot.date === date;
  });

  const editing = slotId
    ? cellSlots.find((slot) => slot.id === slotId)
    : undefined;
  const closeHref = `/admin?week=${weekStart}`;
  const addHref = `/admin?week=${weekStart}&team=${team.id}&date=${date}`;
  const weekOptions = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
  const displayDate = date.split("-").reverse().join(".");
  const [startTime, setStartTime] = useState(roundToQuarterHour(editing?.startTime ?? ""));
  const [endTime, setEndTime] = useState(roundToQuarterHour(editing?.endTime ?? ""));
  const [duration, setDuration] = useState(() =>
    durationBetween(roundToQuarterHour(editing?.startTime ?? ""), roundToQuarterHour(editing?.endTime ?? "")),
  );
  const [rotationId, setRotationId] = useState<number | null>(editing?.rotationTemplateId ?? null);
  const [slotType, setSlotType] = useState(editing?.type ?? (team.isComments ? "other" : "vasermil_1"));
  const [repeat, setRepeat] = useState(false);
  const [intervalDays, setIntervalDays] = useState<SeriesIntervalDays>(7);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [review, setReview] = useState<OccurrencePreview[] | null>(null);
  const [choices, setChoices] = useState<Record<string, SeriesChoice>>({});
  const [checking, setChecking] = useState(false);
  const allowSubmit = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const seriesFlag = useRef<HTMLInputElement>(null);
  const seriesDatesRef = useRef<HTMLInputElement>(null);
  const seriesChoicesRef = useRef<HTMLInputElement>(null);
  const rotation = rotations.find((item) => item.id === rotationId);
  const chip = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-bold ring-1 ${
      active ? "bg-[#c8102e] text-white ring-[#c8102e]" : "bg-white text-zinc-800 ring-zinc-300"
    }`;

  const repeatable = !editing && !isCampSlot(slotType) && slotType !== "home_game" && slotType !== "away_game";
  const allowBiweekly = repeatable && biweeklyRepeatAllowed([team]);
  const interval = effectiveInterval(allowBiweekly, intervalDays);
  const occurrence = buildOccurrenceDates({
    anchor: editing?.date ?? date,
    weekdays: repeat && repeatable ? weekdays : [],
    until: repeat && repeatable ? until : "",
    extraDates: repeat && repeatable ? extraDates : [],
    intervalDays: interval,
  });
  const seriesOn = repeatable && repeat && occurrence.dates.length > 1;

  useEffect(() => {
    setReview(null);
    allowSubmit.current = false;
  }, [startTime, endTime, slotType, repeat, weekdays, until, extraDates, interval]);

  function writeSeries(dates: string[], nextChoices: Record<string, SeriesChoice>) {
    if (seriesFlag.current) seriesFlag.current.value = "1";
    if (seriesDatesRef.current) seriesDatesRef.current.value = dates.join(",");
    if (seriesChoicesRef.current) seriesChoicesRef.current.value = JSON.stringify(nextChoices);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!seriesOn || allowSubmit.current) return;
    event.preventDefault();
    setChecking(true);
    try {
      const preview = await previewWeeklySeries({
        dates: occurrence.dates,
        teamId: team.id,
        type: slotType,
        startTime,
        durationMinutes: duration,
      });
      if (!preview.some((item) => occurrenceDecision(item) !== "save")) {
        writeSeries(occurrence.dates, {});
        allowSubmit.current = true;
        event.currentTarget.requestSubmit();
        return;
      }
      const next: Record<string, SeriesChoice> = {};
      for (const item of preview) {
        if (occurrenceDecision(item) === "choose") next[item.date] = "skip";
      }
      setChoices(next);
      setReview(preview);
    } finally {
      setChecking(false);
    }
  }

  function confirmSeries() {
    writeSeries(occurrence.dates, choices);
    allowSubmit.current = true;
    formRef.current?.requestSubmit();
  }

  function applyClocks(next: { startTime: string; endTime: string; duration: number }) {
    setStartTime(next.startTime);
    setEndTime(next.endTime);
    setDuration(next.duration);
  }

  function applyStart(value: string) {
    applyClocks(clocksAfterStartChange({ startTime, endTime, duration }, value));
    setRotationId(null);
  }

  function applyEnd(value: string) {
    applyClocks(clocksAfterEndChange({ startTime, endTime, duration }, value));
  }

  function applyDuration(minutes: number) {
    applyClocks(clocksAfterDurationChange({ startTime, endTime, duration }, minutes));
  }

  function pickRotationTime(id: number, time: string) {
    const next = roundToQuarterHour(time);
    const kept = duration > 0 ? duration : 0;
    setRotationId(id);
    setStartTime(next);
    if (next && kept > 0) setEndTime(roundToQuarterHour(toTime(toMinutes(next) + kept)));
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-3">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 text-right shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#8e0b20]">{team.name}</h3>
            <p className="text-sm text-zinc-600">{displayDate}</p>
          </div>
          <a
            href={closeHref}
            className="rounded-md px-2 py-1 text-sm font-bold text-zinc-500 hover:bg-zinc-100"
          >
            סגור
          </a>
        </div>

        {cellSlots.length > 0 ? (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold text-zinc-500">אימונים קיימים</p>
            {cellSlots.map((slot) => {
              const style = SLOT_TYPES.find((item) => item.id === slot.type);
              return (
                <div key={slot.id} className="flex items-stretch gap-1">
                  <a
                    href={`/admin?week=${weekStart}&team=${team.id}&date=${date}&slot=${slot.id}`}
                    className="flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-sm font-bold"
                    style={{ background: style?.bg, color: style?.fg }}
                  >
                    <span>{style?.label}</span>
                    <span>{slot.startTime || slot.note || "עריכה"}</span>
                  </a>
                  <form action={deleteSlotForm}>
                    <input type="hidden" name="week" value={weekStart} />
                    <input type="hidden" name="id" value={slot.id} />
                    <button
                      type="submit"
                      className="h-full rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      מחק
                    </button>
                  </form>
                </div>
              );
            })}
            {editing ? (
              <a
                href={addHref}
                className="block rounded-lg border border-dashed border-[#c8102e] py-2 text-center text-sm font-bold text-[#c8102e]"
              >
                + הוסף אימון נוסף
              </a>
            ) : null}
          </div>
        ) : null}

        <form ref={formRef} action={saveSlotForm} onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="series" ref={seriesFlag} defaultValue="" />
          <input type="hidden" name="seriesDates" ref={seriesDatesRef} defaultValue="" />
          <input type="hidden" name="seriesChoices" ref={seriesChoicesRef} defaultValue="" />
          <input type="hidden" name="seriesWeekdays" value={weekdays.join(",")} />
          <input type="hidden" name="seriesUntil" value={until} />
          <input type="hidden" name="seriesInterval" value={interval} />
          <input type="hidden" name="teamId" value={team.id} />
          <input type="hidden" name="date" value={editing?.date ?? date} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <p className="text-sm font-black text-[#8e0b20]">
            {editing ? "עריכת אימון" : cellSlots.length > 0 ? "+ הוספת אימון נוסף ליום הזה" : "אימון חדש"}
          </p>

          <input type="hidden" name="rotationTemplateId" value={rotationId != null && rotationId > 0 ? rotationId : ""} />
          <input type="hidden" name="durationMinutes" value={duration > 0 ? duration : ""} />

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-bold">סבב (לבחירת שעה מהירה)</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRotationId(null)} aria-pressed={rotationId == null} className={chip(rotationId == null)}>
                בלי סבב
              </button>
              {rotations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRotationId(item.id)}
                  aria-pressed={item.id === rotationId}
                  className={chip(item.id === rotationId)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {rotation ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {rotation.times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    dir="ltr"
                    onClick={() => pickRotationTime(rotation.id, time)}
                    aria-pressed={time === startTime}
                    className={`${chip(time === startTime)} tabular-nums`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            ) : null}
          </fieldset>

          <TypeAndCampFields
            defaultType={editing?.type ?? (team.isComments ? "other" : "vasermil_1")}
            startTime={startTime}
            onStartTimeChange={applyStart}
            endTime={endTime}
            onEndTimeChange={applyEnd}
            date={date}
            defaultEndDate={editing?.endDate}
            weekOptions={weekOptions}
            onTypeChange={setSlotType}
          />

          <DurationPicker value={duration} onChange={applyDuration} />

          {repeatable ? (
            <RecurrenceFields
              anchor={date}
              enabled={repeat}
              onEnabled={setRepeat}
              weekdays={weekdays}
              onWeekdays={setWeekdays}
              until={until}
              onUntil={setUntil}
              extraDates={extraDates}
              onExtraDates={setExtraDates}
              allowBiweekly={allowBiweekly}
              intervalDays={interval}
              onIntervalDays={setIntervalDays}
            />
          ) : null}
          {review ? (
            <SeriesConflictReview
              items={review}
              choices={choices}
              onChoice={(itemDate, choice) => setChoices((current) => ({ ...current, [itemDate]: choice }))}
            />
          ) : null}

          {startTime && endTime && duration <= 0 ? (
            <p className="text-sm font-bold text-red-700">שעת הסיום חייבת להיות אחרי שעת ההתחלה</p>
          ) : null}

          <label className="block text-sm font-bold">
            הערה
            <input
              name="note"
              defaultValue={editing?.note ?? ""}
              className="mt-1 w-full rounded-md border border-zinc-300 p-2 font-medium"
              placeholder={team.isComments ? "טקסט להערה..." : "למשל התרשמות"}
            />
          </label>

          {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {review ? (
              <button
                type="button"
                onClick={confirmSeries}
                className="rounded-md bg-[#c8102e] px-4 py-2 text-sm font-bold text-white hover:bg-[#8e0b20]"
              >
                שמירה לפי הבחירה
              </button>
            ) : (
              <button
                type="submit"
                disabled={checking}
                className="rounded-md bg-[#c8102e] px-4 py-2 text-sm font-bold text-white hover:bg-[#8e0b20] disabled:bg-zinc-300"
              >
                {checking ? "בודק התנגשויות…" : seriesOn ? "בדיקה ושמירה" : "שמירה"}
              </button>
            )}
            <a
              href={closeHref}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold"
            >
              ביטול
            </a>
          </div>
        </form>
        {editing?.seriesId ? (
          <form
            action={deleteSlotForm}
            className="mt-3 flex flex-col gap-2 border-t border-zinc-200 pt-3"
            onSubmit={(event) => {
              const scope = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
              if (scope === "series" && !window.confirm("למחוק את כל מועדי הסדרה?")) event.preventDefault();
              if (scope === "future" && !window.confirm("למחוק את המועד הזה וכל המועדים שאחריו?")) event.preventDefault();
            }}
          >
            <input type="hidden" name="week" value={weekStart} />
            <input type="hidden" name="id" value={editing.id} />
            <button type="submit" name="scope" value="future" className="min-h-11 rounded-lg text-sm font-bold text-red-800 ring-1 ring-red-200">
              מחיקת המועד הזה וכל הבאים
            </button>
            <button type="submit" name="scope" value="series" className="min-h-11 rounded-lg bg-red-700 text-sm font-bold text-white">
              מחיקת כל הסדרה
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
