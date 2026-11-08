import Link from "next/link";

const ITEMS = [
  { href: "/admin", label: "ניהול תכנית אימונים" },
  { href: "/admin/pitches", label: "לוח שיבוץ מגרשים" },
  { href: "/admin/games", label: "משחקים" },
  { href: "/admin/coaches", label: "מאמנים" },
  { href: "/admin/banks", label: "חובשים, נהגים וערים" },
  { href: "/admin/history", label: "היסטוריית שינויים" },
];

/** Tabs between the management screens. `current` is the active screen's path. */
export function AdminNav({ current }: { current: string }) {
  return (
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
