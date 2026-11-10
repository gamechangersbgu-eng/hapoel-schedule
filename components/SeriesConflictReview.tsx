"use client";

import { useEffect } from "react";
import { weekdayOf } from "@/lib/pitch-rules";
import { occurrenceDecision, type OccurrencePreview, type SeriesChoice } from "@/lib/recurrence";
import { HEBREW_DAY_LETTERS } from "@/lib/week";

function label(date: string) {
  const [, month, day] = date.split("-");
  return `יום ${HEBREW_DAY_LETTERS[weekdayOf(date)]}, ${Number(day)}.${Number(month)}`;
}

export function SeriesConflictReview({
  items,
  choices,
  onChoice,
}: {
  items: OccurrencePreview[];
  choices: Record<string, SeriesChoice>;
  onChoice: (date: string, choice: SeriesChoice) => void;
}) {
  const clean = items.filter((item) => occurrenceDecision(item) === "save");
  const blocked = items.filter((item) => occurrenceDecision(item) !== "save");

  useEffect(() => {
    document.getElementById("series-review")?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div id="series-review" role="status" className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
      <p className="font-black text-amber-950">לפני השמירה</p>
      {clean.length ? <p className="font-bold text-emerald-800">{clean.length} מועדים בלי התנגשות יישמרו.</p> : null}
      <ul className="flex flex-col gap-2">
        {blocked.map((item) => {
          const decision = occurrenceDecision(item);
          const lines = [...item.hard, ...item.conflicts.map((conflict) => conflict.summary)];
          return (
            <li key={item.date} className="rounded-lg bg-white p-2 ring-1 ring-amber-100">
              <p className="font-black">{label(item.date)}</p>
              {lines.map((line) => (
                <p key={line} className="font-semibold text-amber-950">
                  • {line}
                </p>
              ))}
              {decision === "choose" ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    aria-pressed={choices[item.date] === "override"}
                    onClick={() => onChoice(item.date, "override")}
                    className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-black ring-1 ${
                      choices[item.date] === "override"
                        ? "bg-amber-700 text-white ring-amber-700"
                        : "bg-white text-amber-900 ring-amber-300"
                    }`}
                  >
                    החלף את הקיים
                  </button>
                  <button
                    type="button"
                    aria-pressed={choices[item.date] !== "override"}
                    onClick={() => onChoice(item.date, "skip")}
                    className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-black ring-1 ${
                      choices[item.date] !== "override"
                        ? "bg-zinc-800 text-white ring-zinc-800"
                        : "bg-white text-zinc-800 ring-zinc-300"
                    }`}
                  >
                    דלג על המועד
                  </button>
                </div>
              ) : (
                <p className="mt-1 font-bold text-red-800">אי אפשר להחליף את מה שתופס את המגרש. המועד ידולג.</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
