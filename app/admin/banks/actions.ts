"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cities, db, drivers, medics } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logChange } from "@/lib/history";
import { nationalIdError, normalizeNationalId } from "@/lib/national-id";
import { saveOpponentMapping } from "@/lib/opponent-cities";

type Bank = "medics" | "drivers" | "cities";
const LABEL: Record<Bank, string> = { medics: "חובש", drivers: "נהג", cities: "עיר" };

function done(message: string, error = false): never {
  revalidatePath("/admin/banks");
  redirect(`/admin/banks?${error ? "error" : "done"}=${encodeURIComponent(message)}`);
}

function bankOf(formData: FormData): Bank {
  const bank = String(formData.get("bank"));
  if (bank === "medics" || bank === "drivers" || bank === "cities") return bank;
  done("רשימה לא מוכרת", true);
}

/** Add or update a person (medic / driver) or a city. */
export async function saveBankItem(formData: FormData) {
  await requireAdmin();
  const bank = bankOf(formData);
  const id = Number(formData.get("id") || 0);
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) done("יש למלא שם", true);

  if (bank === "cities") {
    const minutes = Number(formData.get("minutes"));
    const north = formData.get("north") === "on";
    if (!Number.isFinite(minutes) || minutes <= 0) done("יש למלא זמן נסיעה בדקות", true);
    const values = { name, travelMinutesFromBeerSheva: Math.round(minutes), northOfHaderaLine: north };
    if (id) await db.update(cities).set(values).where(eq(cities.id, id));
    else await db.insert(cities).values(values);
  } else if (bank === "medics" || bank === "drivers") {
    const idError = nationalIdError(String(formData.get("nationalId") ?? ""));
    if (idError) done(idError, true);
    const nationalId = normalizeNationalId(String(formData.get("nationalId") ?? ""));
    if (!nationalId) done("תעודת זהות חייבת להיות 9 ספרות (אפשר אפסים מובילים)", true);
    if (bank === "medics") {
      const values = { name, phone: phone || null, nationalId };
      if (id) await db.update(medics).set(values).where(eq(medics.id, id));
      else await db.insert(medics).values({ ...values, isActive: true });
    } else {
      if (!phone) done("לנהג צריך מספר טלפון", true);
      const values = { name, phone, nationalId };
      if (id) await db.update(drivers).set(values).where(eq(drivers.id, id));
      else await db.insert(drivers).values({ ...values, isActive: true });
    }
  }
  await logChange({ action: "bank", summary: `${id ? "עודכן" : "נוסף"} ${LABEL[bank]}: ${name}` });
  done(`${LABEL[bank]} ${name} ${id ? "עודכן" : "נוסף"}`);
}

/** Opponent name → city. An empty city leaves the club unmatched. */
export async function saveOpponentClub(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id") || 0) || undefined;
  const name = String(formData.get("name") ?? "");
  const cityRaw = String(formData.get("cityId") ?? "");
  const cityId = cityRaw ? Number(cityRaw) : null;
  try {
    const result = await saveOpponentMapping({ id, name, cityId });
    if ("error" in result && result.error) done(result.error, true);
  } catch {
    done("לא הצלחנו לשמור את היריבה. ייתכן שהשם כבר קיים.", true);
  }
  await logChange({ action: "bank", summary: `יריבה: ${name.trim() || "ללא שם"}` });
  done(`היריבה ${name.trim()} נשמרה`);
}

/** People are deactivated rather than deleted, so past games keep their names. */
export async function setBankItemActive(formData: FormData) {
  await requireAdmin();
  const bank = bankOf(formData);
  if (bank === "cities") done("אי אפשר להשבית עיר", true);
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "1";
  const [row] =
    bank === "medics"
      ? await db.update(medics).set({ isActive: active }).where(eq(medics.id, id)).returning()
      : await db.update(drivers).set({ isActive: active }).where(eq(drivers.id, id)).returning();
  await logChange({ action: "bank", summary: `${LABEL[bank]} ${row?.name ?? ""} ${active ? "הופעל" : "הושבת"}` });
  done(`${row?.name ?? ""} ${active ? "חזר לרשימה" : "הוסר מהשיבוצים"}`);
}
