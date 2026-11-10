"use client";

// Booking dialog for the pitch board. Shows conflicts live while the admin fills it in;
// the server checks the same rules again on save.
import Link from "next/link";
import { useMemo, useState } from "react";
import { deleteBoardBooking, saveBoardBooking } from "@/app/admin/pitches/actions";
import {
  DURATION_PRESETS,
  checkBooking,
  durationBetween,
  durationLabelHe,
  fallbackRotations,
  normalizeClock,
  toMinutes,
  toTime,
  type PitchDay,
} from "@/lib/pitch-rules";

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
  const [startTime, setStartTime] = useState(normalizeClock(initial.startTime ?? ""));
  const [duration, setDuration] = useState<number>(initial.durationMinutes ?? 0);
  const [endTime, setEndTime] = useState(
    initial.startTime && initial.durationMinutes
      ? toTime(toMinutes(normalizeClock(initial.startTime)) + initial.durationMinutes)
      : "",
  );
  const [rotationId, setRotationId] = useState<number | null>(initial.rotationTemplateId ?? null);
  const [status, setStatus] = useState<"active" | "cancelled" | "substitute">(
    initial.status === "cancelled" ? "cancelled" : initial.substituteStaffId ? "substitute" : "active",
  );

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
    const next = normalizeClock(value);
    setStartTime(next);
    if (!next) return;
    if (endTime) {
      const minutes = durationBetween(next, endTime);
      if (minutes > 0) {
        setDuration(minutes);
        return;
      }
    }
    if (duration > 0) setEndTime(toTime(toMinutes(next) + duration));
  }

  function applyEnd(value: string) {
    const next = normalizeClock(value);
    setEndTime(next);
    setDuration(startTime ? durationBetween(startTime, next) : 0);
  }

  function applyDuration(minutes: number) {
    setDuration(minutes);
    if (startTime) setEndTime(toTime(toMinutes(startTime) + minutes));
  }

  const problems = useMemo(() => {
    if (!teamId || !pitchId || !subdivisionCode || !/^\d{2}:\d{2}$/.test(startTime) || !duration) return [];
    return checkBooking(day, {
      slotId: initial.slotId,
      teamId,
      pitchId,
      subdivisionCode,
      start: toMinutes(startTime),
      durationMinutes: duration,
    });
  }, [day, initial.slotId, teamId, pitchId, subdivisionCode, startTime, duration]);

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
          </div>
          <Link href={closeHref} className="rounded-md px-3 py-1.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100">
            סגור
          </Link>
        </div>

        <form action={saveBoardBooking} className="flex flex-col gap-4">
          <input type="hidden" name="date" value={day.date} />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 text-sm font-bold">
              <label htmlFor="booking-start">שעת התחלה</label>
              <input
                id="booking-start"
                type="time"
                name="startTime"
                step={60}
                dir="ltr"
                className={`${field} tabular-nums`}
                value={startTime}
                onChange={(event) => applyStart(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1 text-sm font-bold">
              <label htmlFor="booking-end">שעת סיום</label>
              <input
                id="booking-end"
                type="time"
                name="endTime"
                step={60}
                dir="ltr"
                className={`${field} tabular-nums`}
                value={endTime}
                onChange={(event) => applyEnd(event.target.value)}
                required
              />
            </div>
          </div>
          {endBeforeStart ? (
            <p className="text-sm font-bold text-red-700">שעת הסיום חייבת להיות אחרי שעת ההתחלה</p>
          ) : null}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-bold">משך אימון</legend>
            <div className="flex flex-wrap gap-2">
              {durations.map((item) => (
                <button
                  key={item.minutes}
                  type="button"
                  onClick={() => applyDuration(item.minutes)}
                  aria-pressed={item.minutes === duration}
                  className={chip(item.minutes === duration)}
                >
                  {item.labelHe}
                </button>
              ))}
            </div>
          </fieldset>

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

          {ready && status !== "cancelled" ? (
            problems.length ? (
              <div role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                <p className="mb-1 font-black">אי אפשר לשבץ כך:</p>
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
            <button
              type="submit"
              disabled={!ready || (problems.length > 0 && status !== "cancelled")}
              className="min-h-11 flex-1 rounded-lg bg-[#c8102e] px-4 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              שמירה
            </button>
            <Link href={closeHref} className="min-h-11 rounded-lg px-4 py-2.5 text-base font-bold text-zinc-600 ring-1 ring-zinc-300">
              ביטול
            </Link>
          </div>
        </form>

        {initial.slotId ? (
          <form action={deleteBoardBooking} className="mt-3 border-t border-zinc-200 pt-3">
            <input type="hidden" name="date" value={day.date} />
            <input type="hidden" name="id" value={initial.slotId} />
            <button type="submit" className="text-sm font-bold text-red-700 underline">
              מחיקת השיבוץ
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
