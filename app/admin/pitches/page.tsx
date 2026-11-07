import type { Metadata } from "next";
import Link from "next/link";
import { BookingForm } from "@/components/BookingForm";
import { PitchBoard } from "@/components/PitchBoard";
import { HEBREW_DAY_NAMES } from "@/components/display-utils";
import { dayWarnings, getPitchDay, toTime } from "@/lib/pitch-board";
import { AdminUserMenu } from "@/components/AdminUserMenu";
import { requireAdmin } from "@/lib/auth";
import { addDaysISO, formatDayMonth, formatISODate, weekDates } from "@/lib/week";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "לוח שיבוץ מגרשים" };

type Props = {
  searchParams: Promise<{
    date?: string;
    new?: string;
    slot?: string;
    error?: string;
    saved?: string;
    team?: string;
    pitch?: string;
    sub?: string;
    time?: string;
    dur?: string;
  }>;
};

function sundayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d, 12);
  return addDaysISO(date, -day.getDay());
}

export default async function PitchBoardPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const params = await searchParams;
  const today = formatISODate(new Date());
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const day = await getPitchDay(date);
  const week = weekDates(sundayOf(date));
  const baseHref = `/admin/pitches?date=${date}`;
  const warnings = dayWarnings(day);
  const dayIndex = week.indexOf(date);
  const dateLabel = `יום ${HEBREW_DAY_NAMES[dayIndex]}, ${formatDayMonth(date)}`;

  const editing = params.slot ? day.bookings.find((item) => item.slotId === Number(params.slot)) : undefined;
  const showForm = Boolean(params.new) || Boolean(editing);
  const num = (value?: string) => (value && Number(value) ? Number(value) : undefined);

  const trainings = day.bookings.filter((item) => item.kind === "training").length;
  const games = day.bookings.length - trainings;

  return (
    <div className="min-h-full bg-[#fff8f6]">
      <header className="bg-[linear-gradient(135deg,#c8102e_0%,#8e0b20_100%)] text-white">
        <div className="bg-[#ffd54f] px-3 py-1.5 text-center text-sm font-black text-[#3a2a00]">
          מצב מנהל
        </div>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-white/75">הפועל באר שבע · ניהול</p>
            <h1 className="text-2xl font-black">לוח שיבוץ מגרשים</h1>
          </div>
          <nav className="flex gap-2 text-sm font-bold">
            <Link href="/admin" className="rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10">
              ניהול תכנית אימונים
            </Link>
            <Link href="/" className="rounded-md border border-white/30 px-3 py-1.5 hover:bg-white/10">
              תצוגה ציבורית
            </Link>
            <AdminUserMenu user={user} />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4">
        <nav aria-label="בחירת יום" className="flex items-center gap-2 overflow-x-auto pb-1">
          <Link
            href={`/admin/pitches?date=${addDaysISO(week[0], -7)}`}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-[#5c0814] ring-1 ring-[#d7b4b8] hover:bg-white"
          >
            → שבוע קודם
          </Link>
          {week.map((item, index) => (
            <Link
              key={item}
              href={`/admin/pitches?date=${item}`}
              aria-current={item === date ? "date" : undefined}
              className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-sm font-bold ring-1 ${
                item === date
                  ? "bg-[#c8102e] text-white ring-[#c8102e]"
                  : "bg-white text-zinc-800 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <span>
                {HEBREW_DAY_NAMES[index]}
                {item === today ? " · היום" : ""}
              </span>
              <span className="text-xs font-semibold opacity-80">{formatDayMonth(item)}</span>
            </Link>
          ))}
          <Link
            href={`/admin/pitches?date=${addDaysISO(week[0], 7)}`}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-[#5c0814] ring-1 ring-[#d7b4b8] hover:bg-white"
          >
            שבוע הבא ←
          </Link>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-bold text-zinc-700">
            {dateLabel} · {trainings} אימונים{games ? ` · ${games} משחקי בית` : ""}
          </p>
          <Link
            href={`${baseHref}&new=1`}
            className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-[#a50d26]"
          >
            + שיבוץ חדש
          </Link>
        </div>

        {params.saved ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
            השיבוץ נשמר, והוא מופיע כבר אצל ההורים והשחקנים.
          </p>
        ) : null}
        {warnings.map((warning) => (
          <p key={warning} role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            ⚠ {warning}
          </p>
        ))}

        <PitchBoard day={day} baseHref={baseHref} />

        <p className="pb-6 text-xs text-zinc-500">
          לחיצה על אימון פותחת אותו לעריכה. משחקי בית מוצגים כחסימה של המגרש המלא לשעתיים מהשריקה.
        </p>
      </main>

      {showForm ? (
        <BookingForm
          key={params.slot ?? "new"}
          day={day}
          dateLabel={dateLabel}
          closeHref={baseHref}
          serverError={params.error}
          initial={
            editing
              ? {
                  slotId: editing.slotId,
                  teamId: editing.teamId,
                  pitchId: editing.pitchId,
                  subdivisionCode: editing.subdivisionCode,
                  startTime: toTime(editing.start),
                  durationMinutes: editing.durationMinutes ?? undefined,
                  rotationTemplateId: editing.rotationTemplateId,
                  note: editing.note,
                }
              : {
                  teamId: num(params.team),
                  pitchId: num(params.pitch),
                  subdivisionCode: params.sub,
                  startTime: params.time,
                  durationMinutes: num(params.dur),
                }
          }
        />
      ) : null}
    </div>
  );
}
