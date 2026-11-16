"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { previewRoomBookingAction, saveRoomBookingAction } from "@/app/admin/rooms/actions";
import { QuarterHourSelect } from "@/components/QuarterHourSelect";
import { RecurrenceFields } from "@/components/RecurrenceFields";
import { buildOccurrenceDates } from "@/lib/recurrence";
import {
  ROOMS,
  ROOM_DURATIONS,
  clockToMinutes,
  minutesToClock,
  needsConfirmation,
  type OccurrenceReview,
  type RoomKind,
} from "@/lib/rooms/room-rules";
import type { TeamOption } from "@/lib/rooms/rooms-db";
import { HEBREW_DAY_LETTERS } from "@/lib/week";

type Initial = { id?: number; teamId: number; date: string; startTime: string; durationMinutes: number; note: string };

function dateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `יום ${HEBREW_DAY_LETTERS[weekday]}, ${d}.${m}`;
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} דק׳`;
  return rest === 0 ? `${hours === 1 ? "שעה" : `${hours} שעות`}` : `${hours}:${String(rest).padStart(2, "0")} שעות`;
}

/** Add or edit a room booking, optionally recurring. Reviews conflicts before saving. */
export function RoomBookingForm({
  kind,
  teams,
  weekStart,
  initial,
}: {
  kind: RoomKind;
  teams: TeamOption[];
  weekStart: string;
  initial: Initial;
}) {
  const room = ROOMS[kind];
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [teamId, setTeamId] = useState(initial.teamId);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [duration, setDuration] = useState(initial.durationMinutes);
  const [note, setNote] = useState(initial.note);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [review, setReview] = useState<OccurrenceReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = clockToMinutes(startTime);
  const endLabel = start != null ? minutesToClock(start + duration) : "";
  const close = `${room.path}?week=${weekStart}`;

  function dates() {
    if (!repeat || editing) return [date];
    return buildOccurrenceDates({ anchor: date, weekdays, until, extraDates }).dates;
  }

  function request() {
    return { teamId, startTime, durationMinutes: duration, dates: dates(), note, id: initial.id };
  }

  function resetReview() {
    setReview(null);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      if (!review) {
        const preview = await previewRoomBookingAction(kind, request());
        if (preview.error) {
          setError(preview.error);
          return;
        }
        if (needsConfirmation(preview.items)) {
          setReview(preview.items);
          return;
        }
      }
      const result = await saveRoomBookingAction(kind, request());
      if (!result.ok) {
        setError(result.error);
        setReview(null);
        return;
      }
      router.push(`${close}&saved=${result.saved.length}&skipped=${result.skipped.length}`);
      router.refresh();
    });
  }

  const blocked = review?.filter((item) => item.blockedBy) ?? [];
  const warned = review?.filter((item) => !item.blockedBy && item.warnings.length > 0) ?? [];
  const willSave = review ? review.length - blocked.length : 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-2 ring-[#c8102e]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-[#8e0b20]">{editing ? "עריכת שיבוץ" : `שיבוץ חדש · ${room.label}`}</h2>
        <a href={close} className="rounded-md px-2 py-1 text-sm font-bold text-zinc-500 hover:bg-zinc-100">
          סגור
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-bold">
          קבוצה
          <select
            value={teamId}
            onChange={(event) => {
              setTeamId(Number(event.target.value));
              resetReview();
            }}
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-base font-medium"
          >
            <option value={0}>בחירת קבוצה</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          תאריך
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              resetReview();
            }}
            className="min-h-11 rounded-lg border border-zinc-300 px-2 py-2 text-base"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm font-bold">
          <label htmlFor="room-start">שעת התחלה</label>
          <QuarterHourSelect
            id="room-start"
            name="startTime"
            value={startTime}
            onChange={(value) => {
              setStartTime(value);
              resetReview();
            }}
            required
          />
        </div>
        <label className="flex flex-col gap-1 text-sm font-bold">
          משך {endLabel ? <span className="font-medium text-zinc-500">(עד {endLabel})</span> : null}
          <select
            value={duration}
            onChange={(event) => {
              setDuration(Number(event.target.value));
              resetReview();
            }}
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-base font-medium"
          >
            {ROOM_DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {durationLabel(minutes)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-bold">
        הערה
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-11 rounded-lg border border-zinc-300 px-2 py-2 text-base font-medium"
          placeholder={kind === "video" ? "למשל: ניתוח משחק מול..." : "למשל: כוח רגליים"}
        />
      </label>

      {editing ? null : (
        <RecurrenceFields
          anchor={date}
          enabled={repeat}
          onEnabled={(value) => {
            setRepeat(value);
            resetReview();
          }}
          weekdays={weekdays}
          onWeekdays={(value) => {
            setWeekdays(value);
            resetReview();
          }}
          until={until}
          onUntil={(value) => {
            setUntil(value);
            resetReview();
          }}
          extraDates={extraDates}
          onExtraDates={(value) => {
            setExtraDates(value);
            resetReview();
          }}
        />
      )}

      {review ? (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          <p className="font-black">
            {willSave === 0 ? "אין מועד פנוי לשמירה." : `יישמרו ${willSave} מתוך ${review.length} מועדים.`}
          </p>
          {blocked.length > 0 ? (
            <div>
              <p className="font-bold text-red-800">ידלגו (החדר תפוס או סגור):</p>
              <ul className="list-inside list-disc">
                {blocked.map((item) => (
                  <li key={item.date}>
                    {dateLabel(item.date)} — {item.blockedBy}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {warned.length > 0 ? (
            <div>
              <p className="font-bold text-amber-900">יישמרו עם אזהרה:</p>
              <ul className="list-inside list-disc">
                {warned.map((item) => (
                  <li key={item.date}>
                    {dateLabel(item.date)} — {item.warnings.join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || teamId === 0 || start == null || (review !== null && willSave === 0)}
          className="min-h-11 rounded-lg bg-[#c8102e] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
        >
          {pending ? "שומר..." : review ? "אישור ושמירה" : "שמירה"}
        </button>
        <a href={close} className="min-h-11 rounded-lg px-4 py-2 text-sm font-bold ring-1 ring-zinc-300">
          ביטול
        </a>
      </div>
    </section>
  );
}
