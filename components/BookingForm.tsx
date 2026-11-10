"use client";

// Booking dialog for the pitch board. Shows conflicts live while the admin fills it in;
// the server checks the same rules again on save.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { deleteBoardBooking, previewBoardSeries, saveBoardBooking } from "@/app/admin/pitches/actions";
import { QuarterHourSelect } from "@/components/QuarterHourSelect";
import { DurationPicker } from "@/components/DurationPicker";
import { RecurrenceFields } from "@/components/RecurrenceFields";
import { SeriesConflictReview } from "@/components/SeriesConflictReview";
import {
  DURATION_PRESETS,
  classifyBooking,
  durationBetween,
  durationLabelHe,
  fallbackRotations,
  roundToQuarterHour,
  toMinutes,
  toTime,
  type PitchDay,
} from "@/lib/pitch-rules";
import { buildOccurrenceDates, occurrenceDecision, type OccurrencePreview, type SeriesChoice } from "@/lib/recurrence";

type Initial = {
  slotId?: number;
  teamId?: number;
  pitchId?: number;
  subdivisionCode?: string;
  startTime?: string;
  durationMinutes?: number;
  rotationTemplateId?: number | null;
  note?: string | null;
  status?: string;
  statusNote?: string | null;
  substituteStaffId?: number | null;
  seriesId?: number | null;
};

export function BookingForm({
  day,
  initial,
  closeHref,
  serverError,
  dateLabel,
}: {
  day: PitchDay;
  initial: Initial;
  closeHref: string;
  serverError?: string;
  dateLabel: string;
}) {
  const [teamId, setTeamId] = useState<number>(initial.teamId ?? 0);
  const [pitchId, setPitchId] = useState<number>(initial.pitchId ?? day.pitches[0]?.id ?? 0);
  const [subdivisionCode, setSubdivisionCode] = useState(initial.subdivisionCode ?? "whole");
  const [startTime, setStartTime] = useState(roundToQuarterHour(initial.startTime ?? ""));
  const [duration, setDuration] = useState<number>(initial.durationMinutes ?? 0);
  const [endTime, setEndTime] = useState(
    initial.startTime && initial.durationMinutes
      ? roundToQuarterHour(toTime(toMinutes(roundToQuarterHour(initial.startTime)) + initial.durationMinutes))
      : "",
  );
  const [rotationId, setRotationId] = useState<number | null>(initial.rotationTemplateId ?? null);
  const [status, setStatus] = useState<"active" | "cancelled" | "substitute">(
    initial.status === "cancelled" ? "cancelled" : initial.substituteStaffId ? "substitute" : "active",
  );
  const [repeat, setRepeat] = useState(false);
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

  const team = day.teams.find((item) => item.id === teamId);
  const allowed = team?.allowedSubdivisions ?? [];
  const rotations = day.rotations.length > 0 ? day.rotations : fallbackRotations();
  const presetMinutes = new Set(DURATION_PRESETS.map((item) => item.minutes));
  const presetDurations = (day.durations.length > 0 ? day.durations : DURATION_PRESETS).filter((item) =>
    presetMinutes.has(item.minutes),
  );
  const durations =
    duration > 0 && !presetMinutes.has(duration)
      ? [...(presetDurations.length > 0 ? presetDurations : DURATION_PRESETS), { minutes: duration, labelHe: durationLabelHe(duration) }]
      : presetDurations.length > 0
        ? presetDurations
        : DURATION_PRESETS;
  const rotation = rotations.find((item) => item.id === rotationId);

  function applyStart(value: string) {
    const next = roundToQuarterHour(value);
    setStartTime(next);
    if (!next) return;
    if (duration > 0) {
      setEndTime(roundToQuarterHour(toTime(toMinutes(next) + duration)));
      return;
    }
    if (endTime) {
      const minutes = durationBetween(next, endTime);
      if (minutes > 0) setDuration(minutes);
    }
  }

  function applyEnd(value: string) {
    const next = roundToQuarterHour(value);
    setEndTime(next);
    setDuration(startTime ? durationBetween(startTime, next) : 0);
  }

  function applyDuration(minutes: number) {
    if (!startTime) {
      setDuration(minutes);
      return;
    }
    const nextEnd = roundToQuarterHour(toTime(toMinutes(startTime) + minutes));
    setEndTime(nextEnd);
    setDuration(durationBetween(startTime, nextEnd) || minutes);
  }

  const occurrence = buildOccurrenceDates({
    anchor: day.date,
    weekdays: repeat ? weekdays : [],
    until: repeat ? until : "",
    extraDates: repeat ? extraDates : [],
  });
  const seriesOn = repeat && !initial.slotId && occurrence.dates.length > 1;
  const classified = useMemo(() => {
    if (!teamId || !pitchId || !subdivisionCode || !/^\d{2}:\d{2}$/.test(startTime) || !duration) {
      return { hard: [] as string[], conflicts: [] };
    }
    return classifyBooking(day, {
      slotId: initial.slotId,
      teamId,
      pitchId,
      subdivisionCode,
      start: toMinutes(startTime),
      durationMinutes: duration,
    });
  }, [day, initial.slotId, teamId, pitchId, subdivisionCode, startTime, duration]);
  const problems = [...classified.hard, ...classified.conflicts.map((conflict) => conflict.summary)];
  const blocked = classified.hard.length > 0 || (classified.conflicts.length > 0 && !seriesOn);

  useEffect(() => {
    setReview(null);
    allowSubmit.current = false;
  }, [teamId, pitchId, subdivisionCode, startTime, duration, repeat, weekdays, until, extraDates]);

  function writeSeries(dates: string[], nextChoices: Record<string, SeriesChoice>) {
    if (seriesFlag.current) seriesFlag.current.value = "1";
    if (seriesDatesRef.current) seriesDatesRef.current.value = dates.join(",");
    if (seriesChoicesRef.current) seriesChoicesRef.current.value = JSON.stringify(nextChoices);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!seriesOn || allowSubmit.current) return;
    if (status === "cancelled") {
      writeSeries(occurrence.dates, {});
      return;
    }
    event.preventDefault();
    setChecking(true);
    try {
      const preview = await previewBoardSeries({
        dates: occurrence.dates,
        teamId,
        pitchId,
        subdivisionCode,
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

  const ready = teamId && pitchId && subdivisionCode && startTime && endTime && duration > 0;
  const teamCoaches = day.coaches.filter((coach) => coach.teamIds.includes(teamId));
  const endBeforeStart = Boolean(startTime && endTime && duration <= 0);

  const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base";
  const chip = (active: boolean, disabled = false) =>
    `rounded-lg px-3 py-2 text-sm font-bold ring-1 transition ${
      disabled
        ? "cursor-not-allowed bg-zinc-50 text-zinc-300 ring-zinc-200"
        : active
          ? "bg-[#c8102e] text-white ring-[#c8102e]"
          : "bg-white text-zinc-800 ring-zinc-300 hover:bg-zinc-50"
    }`;

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 text-right shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="booking-title" className="text-xl font-black text-[#8e0b20]">
              {initial.slotId ? "עריכת שיבוץ" : "שיבוץ חדש"}
            </h2>
            <p className="text-sm text-zinc-600">{dateLabel}</p>
            {initial.seriesId ? <p className="text-sm font-bold text-zinc-700">האימון הזה חלק מסדרה</p> : null}
          </div>
          <Link href={closeHref} className="rounded-md px-3 py-1.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100">
            סגור
          </Link>
        </div>

        <form ref={formRef} action={saveBoardBooking} onSubmit={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="date" value={day.date} />
          <input type="hidden" name="series" ref={seriesFlag} defaultValue="" />
          <input type="hidden" name="seriesDates" ref={seriesDatesRef} defaultValue="" />
          <input type="hidden" name="seriesChoices" ref={seriesChoicesRef} defaultValue="" />
          <input type="hidden" name="seriesWeekdays" value={weekdays.join(",")} />
          <input type="hidden" name="seriesUntil" value={until} />
          {initial.slotId ? <input type="hidden" name="id" value={initial.slotId} /> : null}
          <input type="hidden" name="subdivisionCode" value={subdivisionCode} />
          <input type="hidden" name="durationMinutes" value={duration > 0 ? duration : ""} />
          <input type="hidden" name="rotationTemplateId" value={rotationId != null && rotationId > 0 ? rotationId : ""} />

          <label className="flex flex-col gap-1 text-sm font-bold">
            קבוצה
            <select
              name="teamId"
              className={field}
              value={teamId || ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTeamId(next);
                const nextAllowed = day.teams.find((item) => item.id === next)?.allowedSubdivisions ?? [];
                if (!nextAllowed.includes(subdivisionCode)) setSubdivisionCode("whole");
              }}
              required
            >
              <option value="">בחרו קבוצה</option>
              {day.teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-bold">מגרש</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {day.pitches.map((pitch) => (
                <button
                  key={pitch.id}
                  type="button"
                  onClick={() => setPitchId(pitch.id)}
                  aria-pressed={pitch.id === pitchId}
                  className={chip(pitch.id === pitchId)}
                >
                  {pitch.nameHe}
                  {pitch.isReservedLock ? " 🔒" : ""}
                </button>
              ))}
            </div>
            <input type="hidden" name="pitchId" value={pitchId} />
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-bold">
              חלק מגרש
              {team ? <span className="ms-2 font-semibold text-zinc-500">(מוצגות רק האפשרויות המותרות ל{team.name})</span> : null}
            </legend>
            <div className="flex flex-wrap gap-2">
              {day.subdivisions.map((item) => {
                const disabled = Boolean(team) && !allowed.includes(item.code);
                if (disabled) return null;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setSubdivisionCode(item.code)}
                    aria-pressed={item.code === subdivisionCode}
                    className={chip(item.code === subdivisionCode)}
                  >
                    {item.labelHe}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-bold">סבב (לבחירת שעה מהירה)</legend>
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
                    onClick={() => applyStart(time)}
                    aria-pressed={time === startTime}
                    className={`${chip(time === startTime)} tabular-nums`}
                    dir="ltr"
                  >
                    {time}
                  </button>
                ))}
              </div>
            ) : null}
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-sm font-bold">
              <label htmlFor="booking-start">שעת התחלה</label>
              <QuarterHourSelect
                id="booking-start"
                name="startTime"
                className={field}
                value={startTime}
                onChange={applyStart}
                required
              />
            </div>
            <div className="flex flex-col gap-1 text-sm font-bold">
              <label htmlFor="booking-end">שעת סיום</label>
              <QuarterHourSelect
                id="booking-end"
                name="endTime"
                className={field}
                value={endTime}
                onChange={applyEnd}
                required
              />
            </div>
          </div>
          <p className="text-xs font-semibold text-zinc-500">השעות בקפיצות של רבע שעה: 00, 15, 30, 45.</p>
          {endBeforeStart ? (
            <p className="text-sm font-bold text-red-700">שעת הסיום חייבת להיות אחרי שעת ההתחלה</p>
          ) : null}

          <DurationPicker value={duration} onChange={applyDuration} presets={durations} />

          {initial.slotId ? null : (
            <RecurrenceFields
              anchor={day.date}
              enabled={repeat}
              onEnabled={setRepeat}
              weekdays={weekdays}
              onWeekdays={setWeekdays}
              until={until}
              onUntil={setUntil}
              extraDates={extraDates}
              onExtraDates={setExtraDates}
            />
          )}

          {review ? (
            <SeriesConflictReview
              items={review}
              choices={choices}
              onChoice={(date, choice) => setChoices((current) => ({ ...current, [date]: choice }))}
            />
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-bold">
            הערה (לא חובה)
            <input name="note" className={field} defaultValue={initial.note ?? ""} placeholder="למשל: מאמן מחליף" />
          </label>

          <fieldset className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3">
            <legend className="sr-only">סטטוס האימון</legend>
            <p className="text-sm font-bold">
              סטטוס
              {teamCoaches.length ? (
                <span className="ms-2 font-semibold text-zinc-500">מאמן הקבוצה: {teamCoaches.map((coach) => coach.name).join(", ")}</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["active", "מתקיים כרגיל"],
                  ["substitute", "מאמן מחליף"],
                  ["cancelled", "בוטל"],
                ] as const
              ).map(([value, text]) => (
                <button key={value} type="button" onClick={() => setStatus(value)} aria-pressed={status === value} className={chip(status === value)}>
                  {text}
                </button>
              ))}
            </div>
            <input type="hidden" name="status" value={status} />
            {status === "substitute" ? (
              <select name="substituteStaffId" className={field} defaultValue={initial.substituteStaffId ?? ""} required>
                <option value="">בחרו מאמן מחליף</option>
                {day.coaches
                  .filter((coach) => !coach.teamIds.includes(teamId))
                  .map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name}
                    </option>
                  ))}
              </select>
            ) : null}
            {status !== "active" ? (
              <input
                name="statusNote"
                className={field}
                defaultValue={initial.statusNote ?? ""}
                placeholder={status === "cancelled" ? "סיבה, תוצג להורים (למשל: המאמן חולה)" : "הערה להורים (לא חובה)"}
              />
            ) : null}
          </fieldset>

          {serverError ? (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200">
              {serverError.split(" | ").map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}

          {ready && status !== "cancelled" && !review ? (
            problems.length ? (
              <div role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                <p className="mb-1 font-black">
                  {seriesOn && classified.hard.length === 0 ? "ביום הזה יש התנגשות:" : "אי אפשר לשבץ כך:"}
                </p>
                {problems.map((line) => (
                  <p key={line}>• {line}</p>
                ))}
              </div>
            ) : (
              <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
                ✓ אין התנגשויות
              </p>
            )
          ) : null}

          <div className="flex items-center gap-2">
            {review ? (
              <button
                type="button"
                onClick={confirmSeries}
                className="min-h-11 flex-1 rounded-lg bg-[#c8102e] px-4 text-base font-black text-white"
              >
                שמירה לפי הבחירה
              </button>
            ) : (
              <button
                type="submit"
                disabled={!ready || checking || (blocked && status !== "cancelled")}
                className="min-h-11 flex-1 rounded-lg bg-[#c8102e] px-4 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {checking ? "בודק התנגשויות…" : seriesOn ? "בדיקה ושמירה" : "שמירה"}
              </button>
            )}
            <Link href={closeHref} className="min-h-11 rounded-lg px-4 py-2.5 text-base font-bold text-zinc-600 ring-1 ring-zinc-300">
              ביטול
            </Link>
          </div>
        </form>

        {initial.slotId ? (
          <form
            action={deleteBoardBooking}
            className="mt-3 flex flex-col items-stretch gap-2 border-t border-zinc-200 pt-3"
            onSubmit={(event) => {
              const scope = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
              if (scope === "series" && !window.confirm("למחוק את כל מועדי הסדרה?")) event.preventDefault();
              if (scope === "future" && !window.confirm("למחוק את המועד הזה וכל המועדים שאחריו?")) event.preventDefault();
            }}
          >
            <input type="hidden" name="date" value={day.date} />
            <input type="hidden" name="id" value={initial.slotId} />
            <button type="submit" name="scope" value="one" className="min-h-11 text-sm font-bold text-red-700 underline">
              מחיקת המועד הזה
            </button>
            {initial.seriesId ? (
              <>
                <button type="submit" name="scope" value="future" className="min-h-11 rounded-lg text-sm font-bold text-red-800 ring-1 ring-red-200">
                  מחיקת המועד הזה וכל הבאים
                </button>
                <button type="submit" name="scope" value="series" className="min-h-11 rounded-lg text-sm font-bold text-white bg-red-700">
                  מחיקת כל הסדרה
                </button>
              </>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
