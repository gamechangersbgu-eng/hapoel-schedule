"use client";

import type { ChangeEvent } from "react";
import { NOTIFY_TEAM_FIELD, NOTIFY_TEAM_LABEL } from "@/lib/training-notify";

/**
 * Unchecked by default. Pass `name` to submit with the surrounding form.
 * Pass `onChange` when other forms on the same screen (delete, series) need the same choice.
 */
export function NotifyTeamToggle({
  checked = false,
  onChange,
  name,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  name?: string;
}) {
  const controlled = onChange != null;
  const control = controlled
    ? {
        checked,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked),
      }
    : { defaultChecked: false as const };
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#f4e6e8] px-3 py-2 text-sm font-bold text-[#5c0814]">
      <input type="checkbox" name={name} value="1" className="h-4 w-4 accent-[#c8102e]" {...control} />
      {NOTIFY_TEAM_LABEL}
    </label>
  );
}

/** Hidden copy of the opt-in for a form that does not contain the visible checkbox. */
export function NotifyTeamField({ requested }: { requested: boolean }) {
  if (!requested) return null;
  return <input type="hidden" name={NOTIFY_TEAM_FIELD} value="1" />;
}
