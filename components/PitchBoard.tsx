// Admin pitch board: one day, the four Vasermil pitches side by side, time running down.
// Each booking is drawn across the part of the pitch it uses (north on the right, south on the left).
import Link from "next/link";
import { toggleReservedLock } from "@/app/admin/pitches/actions";
import {
  BOARD_END_MINUTES,
  SUBDIVISION_RANGE,
  SUBDIVISION_SHORT,
  boardStartFor,
  toTime,
  type BoardBooking,
  type PitchDay,
} from "@/lib/pitch-rules";

export const PITCH_COLORS: Record<string, { bg: string; fg: string; soft: string }> = {
  green: { bg: "#558B2F", fg: "#fff", soft: "#EEF5E6" },
  orange: { bg: "#E65100", fg: "#fff", soft: "#FFF1E3" },
  purple: { bg: "#7B1FA2", fg: "#fff", soft: "#F5EAF8" },
  black: { bg: "#212121", fg: "#fff", soft: "#EFEFEF" },
};

const PX_PER_MINUTE = 1.15;
const SURFACE_HE: Record<string, string> = { synthetic: "סינטטי", natural: "דשא טבעי" };
const SHORT_SUB = SUBDIVISION_SHORT;

function PitchActions({
  pitchId,
  locked,
  date,
  baseHref,
}: {
  pitchId: number;
  locked: boolean;
  date: string;
  baseHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={`${baseHref}&new=1&pitch=${pitchId}`}
        className={`rounded-md px-2.5 py-1 text-xs font-bold ${
          locked ? "pointer-events-none bg-zinc-100 text-zinc-400" : "bg-[#c8102e] text-white hover:bg-[#a50d26]"
        }`}
        aria-disabled={locked}
      >
        + שיבוץ
      </Link>
      <form action={toggleReservedLock}>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="pitchId" value={pitchId} />
        <button
          type="submit"
          className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 ${
            locked ? "bg-amber-100 text-amber-900 ring-amber-300" : "text-zinc-600 ring-zinc-300 hover:bg-zinc-50"
          }`}
          title={locked ? "המגרש משוריין. לחצו לשחרור" : "שריון המגרש: אי אפשר יהיה לשבץ עליו"}
        >
          {locked ? "🔒 משוריין" : "שריון"}
        </button>
      </form>
    </div>
  );
}

function bookingSummary(booking: BoardBooking) {
  const cancelled = booking.status === "cancelled";
  const isGame = booking.kind === "home_game";
  if (cancelled) return booking.statusNote ? `בוטל · ${booking.statusNote}` : "בוטל";
  const place = isGame ? `משחק בית${booking.opponent ? ` · ${booking.opponent}` : ""}` : SHORT_SUB[booking.subdivisionCode];
  const extra = [
    booking.substituteStaffId ? "מאמן מחליף" : null,
    !isGame && booking.durationMinutes == null ? "משך לא הוגדר" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return extra ? `${place} · ${extra}` : place;
}

function yAt(boardStart: number, minutes: number) {
  return (minutes - boardStart) * PX_PER_MINUTE;
}

function Block({
  booking,
  color,
  href,
  boardStart,
}: {
  booking: BoardBooking;
  color: { bg: string; fg: string };
  href: string;
  boardStart: number;
}) {
  const [from, to] = SUBDIVISION_RANGE[booking.subdivisionCode] ?? [0, 12];
  const isGame = booking.kind === "home_game";
  const cancelled = booking.status === "cancelled";
  const height = (booking.end - booking.start) * PX_PER_MINUTE;
  const style = {
    top: yAt(boardStart, booking.start) + 1,
    height: height - 2,
    insetInlineStart: `calc(${(from / 12) * 100}% + 2px)`,
    width: `calc(${((to - from) / 12) * 100}% - 4px)`,
    background: cancelled
      ? "repeating-linear-gradient(135deg,#e4e4e7,#e4e4e7 6px,#f4f4f5 6px,#f4f4f5 12px)"
      : isGame
        ? "#C8102E"
        : color.bg,
    color: cancelled ? "#3f3f46" : "#fff",
  };
  const body = (
    <>
      <span className={`block truncate text-[13px] font-black leading-tight ${cancelled ? "line-through" : ""}`}>
        {booking.teamName}
      </span>
      {cancelled ? <span className="block text-[11px] font-black">בוטל{booking.statusNote ? ` · ${booking.statusNote}` : ""}</span> : null}
      {booking.substituteStaffId && !cancelled ? <span className="block truncate text-[11px] font-black">↺ מאמן מחליף</span> : null}
      <span dir="ltr" className="block text-right text-[11px] font-bold tabular-nums opacity-90">
        {toTime(booking.start)}–{toTime(booking.end)}
      </span>
      <span className="block truncate text-[11px] font-semibold opacity-90">
        {isGame ? `משחק בית${booking.opponent ? ` · ${booking.opponent}` : ""}` : SHORT_SUB[booking.subdivisionCode]}
        {!isGame && booking.durationMinutes == null ? " · משך לא הוגדר" : ""}
      </span>
    </>
  );
  const className =
    "absolute overflow-hidden rounded-md px-1.5 py-1 text-right shadow-sm ring-1 ring-black/10 transition hover:z-10 hover:shadow-lg focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[#ffd54f]";
  const label = `${cancelled ? "בוטל: " : ""}${booking.teamName}, ${toTime(booking.start)} עד ${toTime(booking.end)}, ${
    isGame ? "משחק בית" : SHORT_SUB[booking.subdivisionCode]
  }`;
  return isGame ? (
    <div className={className} style={style} aria-label={label} title="משחקים נערכים במסך הניהול הרגיל">
      {body}
    </div>
  ) : (
    <Link href={href} className={className} style={style} aria-label={`${label}. לחצו לעריכה`}>
      {body}
    </Link>
  );
}

function PitchList({ day, baseHref }: { day: PitchDay; baseHref: string }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {day.pitches.map((pitch) => {
        const color = PITCH_COLORS[pitch.colorKey] ?? PITCH_COLORS.black;
        const bookings = day.bookings
          .filter((booking) => booking.pitchId === pitch.id)
          .sort((a, b) => a.start - b.start || a.slotId - b.slotId);
        return (
          <section key={pitch.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10">
            <header className="flex items-center gap-2 px-3 py-2.5" style={{ background: color.soft }}>
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color.bg }} />
              <h2 className="min-w-0 flex-1 truncate text-base font-black">{pitch.nameHe}</h2>
              <span className="shrink-0 text-xs font-semibold text-zinc-500">{SURFACE_HE[pitch.surfaceType]}</span>
            </header>
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <PitchActions pitchId={pitch.id} locked={pitch.isReservedLock} date={day.date} baseHref={baseHref} />
              <span className="text-xs font-bold text-zinc-500">
                {bookings.length === 0 ? "פנוי" : `${bookings.length} שיבוצים`}
              </span>
            </div>
            {bookings.length === 0 ? (
              <p className="px-3 pb-3 text-sm text-zinc-500">אין שיבוץ ביום זה</p>
            ) : (
              <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                {bookings.map((booking) => {
                  const cancelled = booking.status === "cancelled";
                  const isGame = booking.kind === "home_game";
                  const body = (
                    <span className="flex min-h-12 items-center gap-3 px-3 py-2">
                      <span
                        dir="ltr"
                        className={`w-[6.75rem] shrink-0 text-left text-sm font-black tabular-nums ${cancelled ? "text-zinc-400 line-through" : ""}`}
                      >
                        {toTime(booking.start)}–{toTime(booking.end)}
                      </span>
                      <span className="min-w-0 flex-1 text-right">
                        <span className={`block truncate text-sm font-black ${cancelled ? "text-zinc-500 line-through" : ""}`}>
                          {booking.teamName}
                        </span>
                        <span className="block truncate text-xs font-semibold text-zinc-600">{bookingSummary(booking)}</span>
                      </span>
                    </span>
                  );
                  return (
                    <li key={booking.slotId}>
                      {isGame ? (
                        <div className="bg-zinc-50" title="משחקים נערכים במסך הניהול הרגיל">
                          {body}
                        </div>
                      ) : (
                        <Link href={`${baseHref}&slot=${booking.slotId}`} className="block hover:bg-zinc-50">
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function PitchBoard({ day, baseHref }: { day: PitchDay; baseHref: string }) {
  const boardStart = boardStartFor(day);
  const y = (minutes: number) => yAt(boardStart, minutes);
  const hours: number[] = [];
  for (let m = boardStart; m <= BOARD_END_MINUTES; m += 60) hours.push(m);
  const totalHeight = y(BOARD_END_MINUTES);

  return (
    <div className="flex flex-col gap-3">
      <PitchList day={day} baseHref={baseHref} />
      <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/10 md:block">
      <div className="grid min-w-[680px]" style={{ gridTemplateColumns: "3.25rem repeat(4, minmax(0, 1fr))" }}>
        {/* header row */}
        <div className="sticky top-0 z-20 border-b border-black/10 bg-white" />
        {day.pitches.map((pitch) => {
          const color = PITCH_COLORS[pitch.colorKey] ?? PITCH_COLORS.black;
          const count = day.bookings.filter((booking) => booking.pitchId === pitch.id).length;
          return (
            <div
              key={pitch.id}
              className="sticky top-0 z-20 border-b border-s border-black/10 bg-white px-2 py-2"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: color.bg }} />
                <span className="truncate text-sm font-black">{pitch.nameHe}</span>
                <span className="truncate text-[11px] font-semibold text-zinc-500">
                  {SURFACE_HE[pitch.surfaceType]}
                  {count ? ` · ${count}` : ""}
                </span>
              </div>
              <div className="mt-1.5">
                <PitchActions pitchId={pitch.id} locked={pitch.isReservedLock} date={day.date} baseHref={baseHref} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-zinc-400">
                <span>צפון</span>
                <span>דרום</span>
              </div>
            </div>
          );
        })}

        {/* time column */}
        <div className="relative border-black/10" style={{ height: totalHeight }}>
          {hours.map((m) => (
            <span
              key={m}
              dir="ltr"
              className="absolute end-1.5 -translate-y-1/2 text-[11px] font-bold tabular-nums text-zinc-500"
              style={{ top: y(m) }}
            >
              {toTime(m)}
            </span>
          ))}
        </div>

        {/* pitch columns */}
        {day.pitches.map((pitch) => {
          const color = PITCH_COLORS[pitch.colorKey] ?? PITCH_COLORS.black;
          const bookings = day.bookings.filter((booking) => booking.pitchId === pitch.id);
          return (
            <div
              key={pitch.id}
              className="relative border-s border-black/10"
              style={{
                height: totalHeight,
                background: pitch.isReservedLock
                  ? "repeating-linear-gradient(45deg,#fff8e1,#fff8e1 8px,#fff 8px,#fff 16px)"
                  : color.soft,
              }}
            >
              {hours.map((m) => (
                <div key={m} className="absolute inset-x-0 border-t border-black/[0.07]" style={{ top: y(m) }} />
              ))}
              {hours.slice(0, -1).map((m) => (
                <div
                  key={`h${m}`}
                  className="absolute inset-x-0 border-t border-dashed border-black/[0.05]"
                  style={{ top: y(m + 30) }}
                />
              ))}
              {/* faint halfway line between north and south */}
              <div className="absolute inset-y-0 start-1/2 border-s border-dashed border-black/10" />
              {bookings.map((booking) => (
                <Block key={booking.slotId} booking={booking} color={color} href={`${baseHref}&slot=${booking.slotId}`} boardStart={boardStart} />
              ))}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
