import { approveRoomRequestAction, rejectRoomRequestAction } from "@/app/admin/rooms/actions";
import { REQUEST_STATUS_LABEL } from "@/lib/rooms/room-requests";
import type { RoomRequestView } from "@/lib/rooms/room-requests-db";
import type { RoomKind } from "@/lib/rooms/room-rules";

const STATUS_CLASS = {
  pending: "bg-amber-100 text-amber-950",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-800",
} as const;

function RequestCard({
  item,
  kind,
  weekStart,
  approver,
}: {
  item: RoomRequestView;
  kind: RoomKind;
  weekStart: string;
  approver: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg bg-white p-3 ring-1 ring-zinc-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black">
          {item.teamName}
          <span className="ms-2 font-semibold text-zinc-600">
            <bdi>{item.whenLabel}</bdi>
          </span>
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-black ${STATUS_CLASS[item.status]}`}>
          {REQUEST_STATUS_LABEL[item.status]}
        </span>
      </div>
      <p className="text-sm text-zinc-700">
        {item.datesLabel}
        {item.recurrenceLabel ? ` · ${item.recurrenceLabel}` : ""}
        {approver ? ` · ביקש/ה ${item.requesterName}` : ""}
      </p>
      {item.note ? <p className="text-sm text-zinc-600">{item.note}</p> : null}
      {item.status === "rejected" && item.reason ? (
        <p className="text-sm font-semibold text-red-800">סיבת הדחייה: {item.reason}</p>
      ) : null}
      {approver && item.status === "pending" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <form action={approveRoomRequestAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="room" value={kind} />
            <input type="hidden" name="week" value={weekStart} />
            <button type="submit" className="min-h-10 rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-black text-white">
              אישור
            </button>
          </form>
          <form action={rejectRoomRequestAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="room" value={kind} />
            <input type="hidden" name="week" value={weekStart} />
            <input
              name="reason"
              placeholder="סיבת דחייה (לא חובה)"
              className="min-h-10 w-56 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button type="submit" className="min-h-10 rounded-lg px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200">
              דחייה
            </button>
          </form>
        </div>
      ) : null}
    </li>
  );
}

/** Pending queue for the approver, and the signed-in user's own request statuses. */
export function RoomRequests({
  kind,
  weekStart,
  pending,
  mine,
  approver,
}: {
  kind: RoomKind;
  weekStart: string;
  pending: RoomRequestView[];
  mine: RoomRequestView[];
  approver: boolean;
}) {
  const own = mine.filter((item) => !approver || item.status !== "pending");
  return (
    <div className="flex flex-col gap-3">
      {approver ? (
        <section className="flex flex-col gap-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <h2 className="text-base font-black text-amber-950">
            בקשות ממתינות{pending.length > 0 ? ` (${pending.length})` : ""}
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm font-semibold text-amber-900">אין בקשות ממתינות.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((item) => (
                <RequestCard key={item.id} item={item} kind={kind} weekStart={weekStart} approver />
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {own.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-black">הבקשות שלי</h2>
          <ul className="flex flex-col gap-2">
            {own.map((item) => (
              <RequestCard key={item.id} item={item} kind={kind} weekStart={weekStart} approver={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
