import { homeGamePitchText } from "@/lib/game-logistics";
import type { SlotDTO } from "@/lib/types";

type GameSlot = Pick<SlotDTO, "type" | "opponent" | "departureTime" | "pitchName">;

/** Opponent, home pitch, and the effective away departure on the phone schedule. */
export function GameScheduleDetail({ slot }: { slot: GameSlot }) {
  const pitch = homeGamePitchText(slot);
  const isGame = slot.type === "home_game" || slot.type === "away_game";
  if (!isGame || (!slot.opponent && !slot.departureTime && !pitch)) return null;
  return (
    <p className="mt-0.5 text-[15px] font-semibold leading-snug text-zinc-700 dark:text-zinc-200">
      {slot.opponent ? `נגד ${slot.opponent}` : ""}
      {slot.opponent && (pitch || slot.departureTime) ? " · " : ""}
      {pitch}
      {pitch && slot.departureTime ? " · " : ""}
      {slot.departureTime ? (
        <>
          יציאה מבאר שבע <span dir="ltr" className="tabular-nums">{slot.departureTime}</span>
        </>
      ) : null}
    </p>
  );
}
