import Link from "next/link";
import { getVisibleMaintenanceCount } from "@/services/notifications/maintenance";

const ITEMS = [
  { href: "/admin", label: "ניהול תכנית אימונים" },
  { href: "/admin/pitches", label: "לוח שיבוץ מגרשים" },
  { href: "/admin/games", label: "משחקים" },
  { href: "/admin/coaches", label: "מאמנים" },
  { href: "/admin/banks", label: "חובשים, נהגים וערים" },
  { href: "/admin/history", label: "היסטוריית שינויים" },
  { href: "/admin/maintenance", label: "כיסוח וסימון" },
];

/** Tabs between the management screens. `current` is the active screen's path. */
export async function AdminNav({ current }: { current: string }) {
  const maintenanceCount = await getVisibleMaintenanceCount();
  return (
    <>
    <nav aria-label="מסכי ניהול" className="no-print border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3">
        {ITEMS.map((item) => {
          const active = item.href === current;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-[3px] px-3 py-2.5 text-sm font-bold whitespace-nowrap ${
                active
                  ? "border-[#c8102e] text-[#8e0b20]"
                  : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              }`}
            >
              {item.label}
              {item.href === "/admin/maintenance" && maintenanceCount > 0 ? (
                <span className="ms-1.5 rounded-full bg-[#c8102e] px-1.5 py-0.5 text-[11px] font-black text-white">
                  {maintenanceCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
    {maintenanceCount > 0 && current !== "/admin/maintenance" ? (
      <Link
        href="/admin/maintenance"
        role="status"
        className="no-print block bg-lime-50 px-4 py-2 text-center text-sm font-black text-lime-900 ring-1 ring-lime-200 hover:bg-lime-100"
      >
        {maintenanceCount === 1 ? "מגרש אחד דורש" : `${maintenanceCount} מגרשים דורשים`} כיסוח וסימון ←
      </Link>
    ) : null}
    </>
  );
}
