"use client";

/** Opponent (from the club bank, or a new name) and a free-text medic for משחק אימון. */
export function PracticeGameFields({
  opponent,
  medicName,
  opponentNames,
}: {
  opponent?: string | null;
  medicName?: string | null;
  opponentNames: string[];
}) {
  const field = "mt-1 w-full rounded-md border border-zinc-300 p-2 font-medium";
  return (
    <fieldset className="space-y-3 rounded-lg bg-[#e0f2f1] p-3 ring-1 ring-[#00695C]/30">
      <legend className="px-1 text-sm font-black text-[#00695C]">משחק אימון</legend>
      <label className="block text-sm font-bold">
        יריבה
        <input
          name="opponent"
          defaultValue={opponent ?? ""}
          list="practice-opponents"
          placeholder="שם הקבוצה היריבה"
          className={field}
          autoComplete="off"
        />
      </label>
      <datalist id="practice-opponents">
        {opponentNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <p className="text-xs font-semibold text-zinc-600">אפשר לבחור יריבה מהמאגר או להקליד שם חדש.</p>
      <label className="block text-sm font-bold">
        חובש
        <input
          name="medicName"
          defaultValue={medicName ?? ""}
          placeholder="שם החובש"
          className={field}
          autoComplete="off"
        />
      </label>
    </fieldset>
  );
}
