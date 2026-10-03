import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-[#d7b4b8] bg-white p-6 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-xl font-black text-[#8e0b20]">כניסת מנהל</h1>
          <p className="mt-1 text-sm text-zinc-600">
            רק מנהלים יכולים לערוך את לוח האימונים
          </p>
        </div>
        <LoginForm />
        <Link
          href="/"
          className="mt-4 block text-center text-sm font-bold text-[#c8102e] hover:underline"
        >
          חזרה ללוח הזמנים
        </Link>
      </div>
    </div>
  );
}
