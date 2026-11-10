import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { AdminShell } from "@/components/AdminShell";
import { saveBankItem, saveOpponentClub, setBankItemActive } from "@/app/admin/banks/actions";
import { requireAdmin } from "@/lib/auth";
import { cities, db, drivers, medics, opponentClubs } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "חובשים, נהגים וערים · מצב מנהל" };

type Props = { searchParams: Promise<{ error?: string; done?: string; edit?: string }> };
const input = "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm";
const button = "rounded-md px-3 py-1.5 text-sm font-bold";

type Person = { id: number; name: string; phone: string | null; isActive: boolean };

function PeopleBank({ bank, title, hint, people, phoneRequired }: {
  bank: "medics" | "drivers";
  title: string;
  hint: string;
  people: Person[];
  phoneRequired: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h2 className="text-lg font-black text-[#8e0b20]">{title}</h2>
        <p className="text-sm text-zinc-600">{hint}</p>
      </div>
      <ul className="divide-y divide-zinc-100">
        {people.length === 0 ? <li className="px-5 py-3 text-sm text-zinc-500">עוד אין אנשים ברשימה.</li> : null}
        {people.map((person) => (
          <li key={person.id} className={`flex flex-wrap items-center gap-2 px-5 py-2.5 ${person.isActive ? "" : "opacity-55"}`}>
            <form action={saveBankItem} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="bank" value={bank} />
              <input type="hidden" name="id" value={person.id} />
              <input name="name" defaultValue={person.name} aria-label="שם" className={`${input} min-w-36 flex-1`} required />
              <input
                name="phone"
                defaultValue={person.phone ?? ""}
                aria-label="טלפון"
                dir="ltr"
                inputMode="tel"
                placeholder="טלפון"
                className={`${input} w-36`}
                required={phoneRequired}
              />
              <button type="submit" className={`${button} ring-1 ring-zinc-300 hover:bg-zinc-50`}>
                שמירה
              </button>
            </form>
            <form action={setBankItemActive}>
              <input type="hidden" name="bank" value={bank} />
              <input type="hidden" name="id" value={person.id} />
              <input type="hidden" name="active" value={person.isActive ? "0" : "1"} />
              <button type="submit" className={`${button} ${person.isActive ? "text-red-700" : "text-emerald-700"}`}>
                {person.isActive ? "הסרה מהשיבוצים" : "החזרה לרשימה"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={saveBankItem} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
        <input type="hidden" name="bank" value={bank} />
        <input name="name" placeholder="שם מלא" className={`${input} min-w-36 flex-1`} required />
        <input name="phone" placeholder={phoneRequired ? "טלפון" : "טלפון (לא חובה)"} dir="ltr" inputMode="tel" className={`${input} w-40`} required={phoneRequired} />
        <button type="submit" className={`${button} bg-[#c8102e] text-white`}>
          + הוספה
        </button>
      </form>
    </section>
  );
}

export default async function BanksPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const { error, done } = await searchParams;
  const [medicRows, driverRows, cityRows, clubRows] = await Promise.all([
    db.select().from(medics).orderBy(asc(medics.name)),
    db.select().from(drivers).orderBy(asc(drivers.name)),
    db.select().from(cities).orderBy(asc(cities.name)),
    db.select().from(opponentClubs).orderBy(asc(opponentClubs.name)),
  ]);
  const clubs = [...clubRows].sort(
    (a, b) => Number(a.cityId != null) - Number(b.cityId != null) || a.name.localeCompare(b.name, "he"),
  );
  const unmatched = clubs.filter((club) => club.cityId == null);

  return (
    <AdminShell user={user} title="חובשים, נהגים וערים" current="/admin/banks">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">{error}</p>
      ) : null}
      {done ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200">{done}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PeopleBank
          bank="medics"
          title="בנק חובשים"
          hint="חובשים שאפשר לשבץ למשחקי בית."
          people={medicRows}
          phoneRequired={false}
        />
        <PeopleBank
          bank="drivers"
          title="בנק נהגים"
          hint="נהגים שאפשר לשבץ למשחקי חוץ. הטלפון מוצג לצוות במשחק."
          people={driverRows}
          phoneRequired
        />
      </div>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-lg font-black text-[#8e0b20]">ערים וזמני נסיעה</h2>
          <p className="text-sm text-zinc-600">
            זמן הנסיעה מבאר שבע משמש לחישוב שעת היציאה במשחקי חוץ. &quot;חיפה וצפונה&quot; מוסיף חצי שעה הפסקה.
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {cityRows.length === 0 ? <li className="px-5 py-3 text-sm text-zinc-500">עוד אין ערים ברשימה.</li> : null}
          {cityRows.map((city) => (
            <li key={city.id} className="px-5 py-2.5">
              <form action={saveBankItem} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="bank" value="cities" />
                <input type="hidden" name="id" value={city.id} />
                <input name="name" defaultValue={city.name} aria-label="שם העיר" className={`${input} min-w-36 flex-1`} required />
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    name="minutes"
                    type="number"
                    min={5}
                    max={600}
                    defaultValue={city.travelMinutesFromBeerSheva}
                    className={`${input} w-20`}
                    required
                  />
                  דקות נסיעה
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input name="north" type="checkbox" defaultChecked={city.northOfHaderaLine} className="h-4 w-4" />
                  חיפה וצפונה
                </label>
                <button type="submit" className={`${button} ring-1 ring-zinc-300 hover:bg-zinc-50`}>
                  שמירה
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveBankItem} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <input type="hidden" name="bank" value="cities" />
          <input name="name" placeholder="שם העיר" className={`${input} min-w-36 flex-1`} required />
          <label className="flex items-center gap-1.5 text-sm">
            <input name="minutes" type="number" min={5} max={600} placeholder="90" className={`${input} w-20`} required />
            דקות נסיעה
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input name="north" type="checkbox" className="h-4 w-4" />
            חיפה וצפונה
          </label>
          <button type="submit" className={`${button} bg-[#c8102e] text-white`}>
            + הוספה
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h2 className="text-lg font-black text-[#8e0b20]">יריבות וערים</h2>
          <p className="text-sm text-zinc-600">
            במשחק חוץ העיר נבחרת לפי שם היריבה. ההתאמה הראשונה היא העיר הארוכה ביותר שבתוך השם, ואפשר לתקן כאן.
          </p>
        </div>
        {unmatched.length ? (
          <p role="status" className="mx-5 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950 ring-1 ring-amber-200">
            יריבות בלי עיר ({unmatched.length}): {unmatched.map((club) => club.name).join(" · ")}
          </p>
        ) : (
          <p className="mx-5 mt-3 text-sm font-bold text-emerald-800">לכל היריבות השמורות יש עיר.</p>
        )}
        <ul className="divide-y divide-zinc-100">
          {clubs.length === 0 ? <li className="px-5 py-3 text-sm text-zinc-500">עוד אין יריבות. הן נוספות ממשחקים ומכאן.</li> : null}
          {clubs.map((club) => (
            <li key={club.id} className={`px-5 py-2.5 ${club.cityId == null ? "bg-amber-50/60" : ""}`}>
              <form action={saveOpponentClub} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={club.id} />
                <input name="name" defaultValue={club.name} aria-label="שם היריבה" className={`${input} min-w-40 flex-1`} required />
                <select name="cityId" defaultValue={club.cityId ?? ""} aria-label="עיר" className={`${input} min-w-36`}>
                  <option value="">לא הותאמה עיר</option>
                  {cityRows.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className={`${button} ring-1 ring-zinc-300 hover:bg-zinc-50`}>
                  שמירה
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveOpponentClub} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
          <input name="name" placeholder="שם יריבה חדשה" className={`${input} min-w-40 flex-1`} required />
          <select name="cityId" aria-label="עיר" className={`${input} min-w-36`} defaultValue="">
            <option value="">לא הותאמה עיר</option>
            {cityRows.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <button type="submit" className={`${button} bg-[#c8102e] text-white`}>
            + הוספה
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
