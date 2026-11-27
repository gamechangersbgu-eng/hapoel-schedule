"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { COACH_UPDATE_INTENT } from "@/lib/game-logistics";

/** Save, or save and send the team web-push. Must sit inside the game form. */
export function GameSaveButtons({ closeHref }: { closeHref: string }) {
  const { pending, data } = useFormStatus();
  const notifying = pending && data?.get("intent") === COACH_UPDATE_INTENT;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="min-h-11 flex-1 rounded-lg bg-[#c8102e] text-base font-black text-white disabled:opacity-60"
        >
          {pending && !notifying ? "שומר..." : "שמירה"}
        </button>
        <Link href={closeHref} className="min-h-11 rounded-lg px-4 py-2.5 text-base font-bold text-zinc-600 ring-1 ring-zinc-300">
          ביטול
        </Link>
      </div>
      <button
        type="submit"
        name="intent"
        value={COACH_UPDATE_INTENT}
        disabled={pending}
        className="min-h-11 rounded-lg bg-white text-base font-black text-[#8e0b20] ring-1 ring-[#c8102e] disabled:opacity-60"
      >
        {notifying ? "שולח עדכון למאמן..." : "שלח עדכון למאמן"}
      </button>
      <p className="text-xs leading-snug text-zinc-500">
        שומר את החובש, הנהג ושעת היציאה, ואז שולח התראת דפדפן למנויים של הקבוצה.
      </p>
    </div>
  );
}
