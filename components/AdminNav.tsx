import Link from "next/link";
import type { UserRole } from "@/lib/roles";

type Item = { href: string; label: string };

const MANAGER_ITEMS: Item[] = [
  { href: "/admin", label: "ניהול תכנית אימונים" },
  { href: "/admin/pitches", label: "לוח שיבוץ מגרשים" },
  { href: "/admin/games", label: "משחקים" },
  { href: "/admin/coaches", label: "מאמנים" },
  { href: "/admin/players", label: "שחקנים ומאמנים" },
  { href: "/admin/injuries", label: "מעקב פצועים" },
  { href: "/admin/physio", label: "טיפולי פיזיו" },
  { href: "/admin/banks", label: "חובשים, נהגים וערים" },
  { href: "/admin/history", label: "היסטוריית שינויים" },
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
export function AdminNav({ current, role = "admin" }: { current: string; role?: UserRole }) {
  return (
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
