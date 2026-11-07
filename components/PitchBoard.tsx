// Admin pitch board: one day, the four Vasermil pitches side by side, time running down.
// Each booking is drawn across the part of the pitch it uses (north on the right, south on the left).
import Link from "next/link";
import { toggleReservedLock } from "@/app/admin/pitches/actions";
import {
  BOARD_END_MINUTES,
  SUBDIVISION_RANGE,
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
const SHORT_SUB: Record<string, string> = {
  whole: "מלא",
  half_north: "½ צפון",
  half_south: "½ דרום",
  third_north: "⅓ צפון",
  third_center: "⅓ מרכז",
  third_south: "⅓ דרום",
  quarter_north_1: "¼ צפון 1",
  quarter_north_2: "¼ צפון 2",
  quarter_south_1: "¼ דרום 1",
  quarter_south_2: "¼ דרום 2",
};

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
  const height = (booking.end - booking.start) * PX_PER_MINUTE;
  const style = {
    top: yAt(boardStart, booking.start) + 1,
    height: height - 2,
    insetInlineStart: `calc(${(from / 12) * 100}% + 2px)`,
    width: `calc(${((to - from) / 12) * 100}% - 4px)`,
    background: isGame ? "#C8102E" : color.bg,
    color: "#fff",
  };
  const body = (
    <>
      <span className="block truncate text-[13px] font-black leading-tight">{booking.teamName}</span>
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
  const label = `${booking.teamName}, ${toTime(booking.start)} עד ${toTime(booking.end)}, ${
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

export function PitchBoard({ day, baseHref }: { day: PitchDay; baseHref: string }) {
  const boardStart = boardStartFor(day);
  const y = (minutes: number) => yAt(boardStart, minutes);
  const hours: number[] = [];
  for (let m = boardStart; m <= BOARD_END_MINUTES; m += 60) hours.push(m);
  const totalHeight = y(BOARD_END_MINUTES);

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/10">
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: "3.5rem repeat(4, minmax(0, 1fr))" }}>
        {/* header row */}
        <div className="sticky top-0 z-20 border-b border-black/10 bg-white" />
        {day.pitches.map((pitch) => {
          const color = PITCH_COLORS[pitch.colorKey] ?? PITCH_COLORS.black;
          return (
            <div
              key={pitch.id}
              className="sticky top-0 z-20 border-b border-s border-black/10 bg-white px-2 pt-2 pb-1.5"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color.bg }} />
                <span className="truncate text-base font-black">{pitch.nameHe}</span>
                <span className="truncate text-xs font-semibold text-zinc-500">{SURFACE_HE[pitch.surfaceType]}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Link
                  href={`${baseHref}&new=1&pitch=${pitch.id}`}
                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                    pitch.isReservedLock
                      ? "pointer-events-none bg-zinc-100 text-zinc-400"
                      : "bg-[#c8102e] text-white hover:bg-[#a50d26]"
                  }`}
                  aria-disabled={pitch.isReservedLock}
                >
                  + שיבוץ
                </Link>
                <form action={toggleReservedLock}>
                  <input type="hidden" name="date" value={day.date} />
                  <input type="hidden" name="pitchId" value={pitch.id} />
                  <button
                    type="submit"
                    className={`rounded-md px-2 py-1 text-xs font-bold ring-1 ${
                      pitch.isReservedLock
                        ? "bg-amber-100 text-amber-900 ring-amber-300"
                        : "text-zinc-600 ring-zinc-300 hover:bg-zinc-50"
                    }`}
                    title={pitch.isReservedLock ? "המגרש משוריין. לחצו לשחרור" : "שריון המגרש: אי אפשר יהיה לשבץ עליו"}
                  >
                    {pitch.isReservedLock ? "🔒 משוריין" : "שריון"}
                  </button>
                </form>
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
  );
}
