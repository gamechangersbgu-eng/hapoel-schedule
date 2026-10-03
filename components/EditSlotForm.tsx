import { deleteSlotForm, saveSlotForm } from "@/app/actions";
import { TypeAndCampFields } from "@/components/TypeAndCampFields";
import { SLOT_TYPES, isCampSlot } from "@/lib/slot-types";
import type { SlotDTO, TeamDTO } from "@/lib/types";
import { addDaysISO } from "@/lib/week";

type EditSlotFormProps = {
  team: TeamDTO;
  date: string;
  weekStart: string;
  slots: SlotDTO[];
  slotId?: number;
  error?: string;
};

export function EditSlotForm({
  team,
  date,
  weekStart,
  slots,
  slotId,
  error,
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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-3">
      <div className="w-full max-w-md rounded-xl bg-white p-4 text-right shadow-2xl">
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

        <form action={saveSlotForm} className="space-y-3">
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="teamId" value={team.id} />
          <input type="hidden" name="date" value={editing?.date ?? date} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <p className="text-sm font-black text-[#8e0b20]">
            {editing ? "עריכת אימון" : "אימון חדש"}
          </p>

          <TypeAndCampFields
            defaultType={editing?.type ?? (team.isComments ? "other" : "vasermil_1")}
            defaultStartTime={editing?.startTime}
            date={date}
            defaultEndDate={editing?.endDate}
            weekOptions={weekOptions}
          />

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
            <button
              type="submit"
              className="rounded-md bg-[#c8102e] px-4 py-2 text-sm font-bold text-white hover:bg-[#8e0b20]"
            >
              שמירה
            </button>
            <a
              href={closeHref}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold"
            >
              ביטול
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
