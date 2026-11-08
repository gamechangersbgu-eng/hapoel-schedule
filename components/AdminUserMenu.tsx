import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import type { CurrentAdmin } from "@/lib/auth";

/** Signed-in manager, with links to own account, user management (owners) and sign-out. */
export function AdminUserMenu({ user }: { user: CurrentAdmin }) {
  const link = "rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-white/85">שלום, {user.displayName}</span>
      {user.role === "owner" ? (
        <Link href="/admin/users" className={link}>
          משתמשים
        </Link>
      ) : null}
      <Link href="/admin/account" className={link}>
        החשבון שלי
      </Link>
      <form action={logoutAction}>
        <button type="submit" className={link}>
          יציאה
        </button>
      </form>
    </div>
  );
}
