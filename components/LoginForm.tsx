"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-bold text-[#5c0814]">
        סיסמת מנהל
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-[#d7b4b8] px-3 py-2 text-base font-medium"
        />
      </label>
      {state?.error ? (
        <p className="text-sm font-bold text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[#c8102e] py-2.5 text-base font-black text-white hover:bg-[#8e0b20] disabled:opacity-60"
      >
        כניסה
      </button>
    </form>
  );
}
