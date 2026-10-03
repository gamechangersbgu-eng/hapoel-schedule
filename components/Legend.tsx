import { SLOT_TYPES } from "@/lib/slot-types";

export function Legend() {
  return (
    <aside className="no-print flex shrink-0 flex-row flex-wrap items-center gap-2 self-stretch rounded-lg border border-[#d7b4b8] bg-white p-2 shadow-sm lg:sticky lg:top-4 lg:flex-col lg:items-stretch lg:self-start">
      <p className="mb-0 text-[11px] font-bold tracking-wide text-[#8e0b20] lg:mb-1 lg:text-center">
        מקרא
      </p>
      {SLOT_TYPES.filter((item) => item.id !== "other").map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span
            className="h-5 w-5 shrink-0 rounded-sm border border-black/10"
            style={{ background: item.bg }}
          />
          <span className="text-[11px] font-medium leading-none">{item.label}</span>
        </div>
      ))}
    </aside>
  );
}
