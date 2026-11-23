import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { HEBREW_DAY_NAMES } from "@/components/display-utils";
import { RoomBookingForm } from "@/components/RoomBookingForm";
import { RoomRequests } from "@/components/RoomRequests";
import { deleteRoomBookingAction } from "@/app/admin/rooms/actions";
import { requireRoomViewer } from "@/lib/auth";
import { canApproveRoomRequests, canBookRoomDirectly, canSubmitRoomRequest } from "@/lib/rooms/room-access";
import { isManager } from "@/lib/roles";
import { listRoomRequests } from "@/lib/rooms/room-requests-db";
import { ROOMS, formatRange, minutesToClock, weekdayOfDate, type RoomKind } from "@/lib/rooms/room-rules";
import { getRoomWeek } from "@/lib/rooms/rooms-db";
import { addDaysISO, formatDayMonth, formatWeekRange, resolveWeekStart } from "@/lib/week";

type Params = {
  week?: string;
  new?: string;
  edit?: string;
  saved?: string;
  skipped?: string;
  requested?: string;
  dropped?: string;
  approved?: string;
  rejected?: string;
  error?: string;
};

/** Weekly schedule of one internal room (admin only; the club TV shows today's bookings). */
export async function RoomSchedule({ kind, params }: { kind: RoomKind; params: Params }) {
  const user = await requireRoomViewer(kind);
  const approver = canApproveRoomRequests(user);
  const canBook = canBookRoomDirectly(user);
  const canRequest = canSubmitRoomRequest(user, kind);
  const manager = isManager(user.role);
  const room = ROOMS[kind];
  const weekStart = resolveWeekStart(params.week);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)).filter((date) =>
    room.weekdays.includes(weekdayOfDate(date)),
  );
  const [{ bookings, teams }, requests] = await Promise.all([
    getRoomWeek(kind, dates[0], dates[dates.length - 1]),
    listRoomRequests(kind, user.id, approver),
  ]);
  const base = `${room.path}?week=${weekStart}`;
  const editing = params.edit ? bookings.find((booking) => booking.id === Number(params.edit)) : undefined;
  const newDate = params.new && dates.includes(params.new) ? params.new : undefined;
  const saved = Number(params.saved ?? 0);
  const skipped = Number(params.skipped ?? 0);

  return (
    <AdminShell user={user} title={room.label} current={room.path}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-2" aria-label="בחירת שבוע">
          <Link href={`${room.path}?week=${addDaysISO(weekStart, -7)}`} className="rounded-lg px-3 py-2 text-sm font-bold ring-1 ring-[#d7b4b8] hover:bg-white">
            → שבוע קודם
          </Link>
          <span className="px-2 text-base font-black">
            <bdi>{formatWeekRange(weekStart)}</bdi>
          </span>
          <Link href={`${room.path}?week=${addDaysISO(weekStart, 7)}`} className="rounded-lg px-3 py-2 text-sm font-bold ring-1 ring-[#d7b4b8] hover:bg-white">
            שבוע הבא ←
          </Link>
        </nav>
        <p className="text-sm text-zinc-600">קבוצה אחת בכל זמן · מוצג למנהלים ובמסך המועדון בלבד</p>
      </div>

      {params.requested === "1" ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950 ring-1 ring-amber-200">
          הבקשה נשלחה וממתינה לאישור. היא לא תופיע בלוח עד שתאושר.
          {Number(params.dropped) > 0 ? " ימים שבהם החדר סגור לא נכללו." : ""}
        </p>
      ) : null}
      {params.approved === "1" ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
          הבקשה אושרה והשיבוץ נכנס ללוח.
        </p>
      ) : null}
      {params.rejected === "1" ? (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-bold text-zinc-800 ring-1 ring-zinc-200">
          הבקשה נדחתה ולא נכנסה ללוח.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">
          {params.error}
        </p>
      ) : null}

      {saved > 0 ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">
          {saved === 1 ? "השיבוץ נשמר." : `נשמרו ${saved} מועדים.`}
          {skipped === 1 ? " מועד אחד דולג כי החדר היה תפוס או סגור." : ""}
          {skipped > 1 ? ` ${skipped} מועדים דולגו כי החדר היה תפוס או סגור.` : ""}
        </p>
      ) : null}

      {((canBook || (manager && editing)) && (editing || newDate)) || (canRequest && newDate && !editing) ? (
        <RoomBookingForm
          kind={kind}
          teams={teams}
          weekStart={weekStart}
          purpose={canRequest && newDate && !editing ? "request" : "book"}
          initial={
            editing
              ? {
                  id: editing.id,
                  teamId: editing.teamId,
                  date: editing.date,
                  startTime: minutesToClock(editing.start),
                  durationMinutes: editing.end - editing.start,
                  note: editing.note ?? "",
                }
              : { teamId: 0, date: newDate!, startTime: "16:00", durationMinutes: 60, note: "" }
          }
        />
      ) : null}

      {kind === "gym" && !canBook && !canRequest ? (
        <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200">
          בקשת שיבוץ בחדר הכושר פתוחה למאמן כושר. שיבוץ ישיר פתוח למנהל הראשי.
        </p>
      ) : null}

      <RoomRequests kind={kind} weekStart={weekStart} pending={requests.pending} mine={requests.mine} approver={approver} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dates.map((date) => {
          const day = bookings.filter((booking) => booking.date === date);
          return (
            <section key={date} className="flex flex-col gap-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-black">
                  יום {HEBREW_DAY_NAMES[weekdayOfDate(date)]}{" "}
                  <span className="font-semibold text-zinc-500">{formatDayMonth(date)}</span>
                </h2>
                {canBook || canRequest ? (
                  <Link href={`${base}&new=${date}`} className="rounded-lg bg-[#c8102e] px-3 py-1.5 text-sm font-black text-white">
                    {canBook ? "+ שיבוץ" : "+ בקשה"}
                  </Link>
                ) : null}
              </div>
              {day.length === 0 ? <p className="text-sm text-zinc-500">פנוי כל היום</p> : null}
              <ul className="flex flex-col gap-2">
                {day.map((booking) => (
                  <li key={booking.id} className="flex flex-col gap-1 rounded-lg bg-indigo-50 p-2 ring-1 ring-indigo-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black">
                        <bdi className="tabular-nums">{formatRange(booking.start, booking.end)}</bdi> · {booking.teamName}
                      </p>
                      {booking.seriesId ? (
                        <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-xs font-black text-indigo-900">חוזר</span>
                      ) : null}
                    </div>
                    {booking.note ? <p className="text-sm text-zinc-700">{booking.note}</p> : null}
                    {manager ? (
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Link href={`${base}&edit=${booking.id}`} className="font-bold text-[#8e0b20] underline">
                        עריכה
                      </Link>
                      <form action={deleteRoomBookingAction}>
                        <input type="hidden" name="room" value={kind} />
                        <input type="hidden" name="id" value={booking.id} />
                        <input type="hidden" name="week" value={weekStart} />
                        <button type="submit" className="font-bold text-red-700 underline">
                          מחיקה
                        </button>
                      </form>
                      {booking.seriesId ? (
                        <form action={deleteRoomBookingAction}>
                          <input type="hidden" name="room" value={kind} />
                          <input type="hidden" name="id" value={booking.id} />
                          <input type="hidden" name="week" value={weekStart} />
                          <input type="hidden" name="scope" value="following" />
                          <button type="submit" className="font-bold text-red-700 underline">
                            מחיקת זה וכל הבאים
                          </button>
                        </form>
                      ) : null}
                    </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
