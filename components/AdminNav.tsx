import Link from "next/link";
import { isManager, type UserRole } from "@/lib/roles";
import { getVisibleMaintenanceCount } from "@/services/notifications/maintenance";

type Item = { href: string; label: string };

const MANAGER_ITEMS: Item[] = [
  { href: "/admin", label: "ניהול תכנית אימונים" },
  { href: "/admin/pitches", label: "לוח שיבוץ מגרשים" },
  { href: "/admin/games", label: "משחקים" },
  { href: "/admin/coaches", label: "מאמנים" },
  { href: "/admin/players", label: "שחקנים ומאמנים" },
  { href: "/admin/injuries", label: "מעקב פצועים" },
  { href: "/admin/physio", label: "טיפולי פיזיו" },
  { href: "/admin/gym", label: "חדר כושר" },
  { href: "/admin/video", label: "כיתת וידאו" },
  { href: "/admin/banks", label: "חובשים, נהגים וערים" },
  { href: "/admin/history", label: "היסטוריית שינויים" },
  { href: "/admin/maintenance", label: "כיסוח וסימון" },
];

const PHYSIO_ITEMS: Item[] = [
  { href: "/admin/physio", label: "טיפולי פיזיו" },
  { href: "/admin/injuries", label: "מעקב פצועים" },
];

const COACH_ITEMS: Item[] = [{ href: "/admin/injuries", label: "הפצועים שלי" }];

function itemsFor(role: UserRole) {
  if (role === "physio") return PHYSIO_ITEMS;
  if (role === "coach") return COACH_ITEMS;
  return MANAGER_ITEMS;
}

/** Tabs between the management screens. `current` is the active screen's path; `role` decides which tabs show. */
export async function AdminNav({ current, role = "admin" }: { current: string; role?: UserRole }) {
  const manager = isManager(role);
  const { open: taskCount, overdue, unknown } = manager
    ? await getVisibleMaintenanceCount()
    : { open: 0, overdue: 0, unknown: 0 };
  const maintenanceCount = taskCount + unknown;
  return (
    <>
      <nav aria-label="מסכי ניהול" className="no-print border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3">
          {itemsFor(role).map((item) => {
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
                  <span
                    className={`ms-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-black ${
                      overdue > 0 ? "bg-red-600 text-white" : "bg-lime-600 text-white"
                    }`}
                  >
                    {maintenanceCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
      {manager && maintenanceCount > 0 && current !== "/admin/maintenance" ? (
        <Link
          href="/admin/maintenance"
          role="status"
          className={`no-print block px-4 py-2 text-center text-sm font-black ring-1 ${
            overdue > 0
              ? "bg-red-600 text-white ring-red-700 hover:bg-red-700"
              : "bg-lime-50 text-lime-900 ring-lime-200 hover:bg-lime-100"
          }`}
        >
          {taskCount > 0 ? `${taskCount === 1 ? "מגרש אחד דורש" : `${taskCount} מגרשים דורשים`} כיסוח וסימון` : ""}
          {overdue > 0 ? ` · ${overdue === 1 ? "משימה אחת" : `${overdue} משימות`} באיחור` : ""}
          {unknown > 0 ? `${taskCount > 0 ? " · " : ""}${unknown === 1 ? "משחק בית אחד" : `${unknown} משחקי בית`} בלי מגרש ידוע` : ""} ←
        </Link>
      ) : null}
    </>
  );
}
