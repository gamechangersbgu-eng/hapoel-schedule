"use client";

// "Teams" button + panel: choose any combination of teams (all, one, two, three...).
import { useEffect, useRef, useState } from "react";
import type { TeamDTO } from "@/lib/types";

export function TeamFilter({
  teams,
  selected,
  onChange,
  tone = "light",
  openUp = false,
}: {
  teams: TeamDTO[];
  /** null = all teams. */
  selected: number[] | null;
  onChange: (ids: number[] | null) => void;
  tone?: "light" | "dark";
  /** Open the panel above the button (for a button at the bottom of the screen). */
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const all = selected === null || teams.every((team) => selected.includes(team.id));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const names = all
    ? "כל הקבוצות"
    : teams
        .filter((team) => (selected ?? []).includes(team.id))
        .map((team) => team.name)
        .join(", ");

  function toggle(id: number) {
    const current = all ? [] : (selected ?? []);
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    // Every team ticked, or none: same as "all".
    onChange(next.length === 0 || next.length === teams.length ? null : next);
  }

  const dark = tone === "dark";
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex max-w-[22rem] items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold ring-1 ${
          dark ? "bg-white/10 text-white ring-white/30 hover:bg-white/20" : "bg-white text-[#5c0814] ring-[#d7b4b8] hover:bg-[#fbf2f3]"
        }`}
      >
        <span className="shrink-0">קבוצות:</span>
        <span className="truncate font-semibold">{names}</span>
        <span aria-hidden className="shrink-0 text-xs">▾</span>
      </button>
      {open ? (
        <div
          role="group"
          aria-label="בחירת קבוצות"
          className={`absolute start-0 z-50 w-[min(32rem,calc(100vw-2rem))] ${openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"} rounded-xl bg-white p-3 text-[#1a1214] shadow-2xl ring-1 ring-black/10`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-black text-[#8e0b20]">אפשר לבחור כל צירוף של קבוצות</p>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-pressed={all}
              className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${
                all ? "bg-[#c8102e] text-white ring-[#c8102e]" : "text-[#5c0814] ring-[#d7b4b8] hover:bg-[#fbf2f3]"
              }`}
            >
              כל הקבוצות
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {teams.map((team) => {
              const on = !all && (selected ?? []).includes(team.id);
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => toggle(team.id)}
                  aria-pressed={on}
                  className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-start text-sm font-bold ring-1 ${
                    on ? "bg-[#fbe9ec] text-[#8e0b20] ring-[#c8102e]" : "bg-white text-zinc-800 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[11px] ${on ? "border-[#c8102e] bg-[#c8102e] text-white" : "border-zinc-400"}`}>
                    {on ? "✓" : ""}
                  </span>
                  {team.name}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-[#c8102e] px-4 py-1.5 text-sm font-black text-white">
              סיום
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
