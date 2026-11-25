import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { HEBREW_DAY_NAMES } from "@/components/display-utils";
import { requireAdmin } from "@/lib/auth";
import { formatDayMonth } from "@/lib/week";
import {
  getMaintenanceTasks,
  getUnknownVenueGames,
  overrideLabel,
  type MaintenanceTaskView,
  type UnknownVenueGame,
} from "@/services/notifications/maintenance";
import {
  DAYS_BEFORE_GAME,
  OVERRIDE_CODES,
  addDays,
  isOverdue,
  israelToday,
  visibleOpenTasks,
  weekdayOfISO,
} from "@/services/notifications/maintenance-rules";
import { markMaintenanceDoneAction, reopenMaintenanceAction, setPitchOverrideAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "כיסוח וסימון · מצב מנהל" };

function dayLabel(date: string) {
  return `יום ${HEBREW_DAY_NAMES[weekdayOfISO(date)]} ${formatDayMonth(date)}`;
}

function timeLabel(task: MaintenanceTaskView) {
  if (task.kind === "weekly") {
    // Left-to-right isolate keeps "08:00–10:00" in order inside the Hebrew line.
    return task.startTime && task.endTime ? `חלון פנוי \u2066${task.startTime}–${task.endTime}\u2069` : null;
  }
  return task.startTime ? `משחק ראשון ${task.startTime}` : null;
}

function doneLabel(task: MaintenanceTaskView) {
  if (!task.doneAt) return task.doneBy ?? "";
  const d = new Date(task.doneAt);
  const when = d.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${task.doneBy ?? ""} · ${when}`;
}

type Tone = "overdue" | "now" | "soon" | "done";

function TaskCard({ task, tone }: { task: MaintenanceTaskView; tone: Tone }) {
  const time = timeLabel(task);
  const ring =
    tone === "overdue"
      ? "bg-red-50 ring-2 ring-red-600"
      : tone === "now"
        ? "bg-white ring-2 ring-[#c8102e]"
        : "bg-white ring-1 ring-zinc-200";
  return (
    <li className={`flex flex-wrap items-start justify-between gap-3 rounded-xl p-3 ${ring}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-black">
          {task.pitchName} · {dayLabel(task.date)}
          {task.kind === "weekly" ? (
            <span className="ms-2 rounded-full bg-lime-100 px-2 py-0.5 text-xs font-black text-lime-900">שבועי</span>
          ) : null}
        </p>
        {tone === "overdue" ? (
          <p className="w-fit rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">באיחור · לא סומן כבוצע</p>
        ) : null}
        {time ? <p className="text-sm font-bold text-zinc-700">{time}</p> : null}
        <p className="text-sm text-zinc-600">{task.summary}</p>
        {tone === "soon" ? (
          <p className="text-xs text-zinc-500">יופיע כהתראה החל מ{dayLabel(task.showFrom)}</p>
        ) : null}
        {tone === "done" ? <p className="text-xs font-bold text-emerald-800">בוצע · {doneLabel(task)}</p> : null}
      </div>
      {tone === "done" ? (
        <form action={reopenMaintenanceAction}>
          <input type="hidden" name="id" value={task.id} />
          <button type="submit" className="rounded-lg px-3 py-2 text-sm font-bold text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-50">
            בטל סימון
          </button>
        </form>
      ) : (
        <form action={markMaintenanceDoneAction}>
          <input type="hidden" name="id" value={task.id} />
          <button type="submit" className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-black text-white hover:bg-[#8e0b20]">
            בוצע
          </button>
        </form>
      )}
    </li>
  );
}

function Section({ title, tasks, tone, empty }: { title: string; tasks: MaintenanceTaskView[]; tone: Tone; empty?: string }) {
  if (tasks.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`text-lg font-black ${tone === "overdue" ? "text-red-700" : ""}`}>{title}</h2>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-center text-sm text-zinc-600">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} tone={tone} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UnknownVenueRow({ game, today }: { game: UnknownVenueGame; today: string }) {
  const urgent = !game.overrideCode && addDays(game.date, -DAYS_BEFORE_GAME) <= today;
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ${
        urgent ? "bg-amber-50 ring-2 ring-amber-500" : "bg-white ring-1 ring-zinc-200"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-black">
          {dayLabel(game.date)} · {game.kickoff ?? "שעה לא ידועה"} · {game.teamName}
          {game.opponent ? <span className="font-semibold text-zinc-600"> נגד {game.opponent}</span> : null}
        </p>
        {game.overrideCode ? (
          <p className="w-fit rounded-full bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-900">
            שיבוץ זמני: {overrideLabel(game.overrideCode)} · יוחלף אוטומטית כשההתאחדות תעדכן מגרש
          </p>
        ) : (
          <p className="text-xs font-bold text-amber-900">
            {urgent ? "המשימה כבר הייתה אמורה להופיע — בחרו מגרש" : "ההתאחדות עוד לא פרסמה מגרש"}
          </p>
        )}
      </div>
      <form action={setPitchOverrideAction} className="flex items-center gap-2">
        <input type="hidden" name="slotId" value={game.slotId} />
        <select
          name="pitchCode"
          defaultValue={game.overrideCode ?? ""}
          aria-label="מגרש זמני"
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm font-medium"
        >
          <option value="">{game.overrideCode ? "הסרת השיבוץ הזמני" : "בחירת מגרש"}</option>
          {OVERRIDE_CODES.map((code) => (
            <option key={code} value={code}>
              {overrideLabel(code)}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-lg bg-[#8e0b20] px-3 py-2 text-sm font-black text-white">
          שמירה
        </button>
      </form>
    </li>
  );
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireAdmin();
  const today = israelToday();
  const { error } = await searchParams;
  const tasks = await getMaintenanceTasks(today);
  const unknown = await getUnknownVenueGames(today);

  const visible = visibleOpenTasks(tasks, today);
  const overdue = visible.filter((task) => isOverdue(task, today));
  const now = visible.filter((task) => !isOverdue(task, today));
  const soon = tasks.filter((task) => task.status === "open" && task.showFrom > today);
  const done = tasks.filter((task) => task.status === "done").reverse();

  return (
    <AdminShell user={user} title="כיסוח וסימון מגרשים" current="/admin/maintenance">
      <p className="text-sm text-zinc-600">
        משימה נפתחת יומיים לפני משחק ליגה בבית על וסרמיל 2 ו־3, ופעם בשבוע לוסרמיל 2 בחלון בלי אימונים.
        וסרמיל 1 (סינטטי) ווסרמיל 4 (אקדמיה לכדורגל) לא דורשים כיסוח וסימון.
        המגרש נלקח מהשיבוץ במסך המשחקים, ואם אין — משם המגרש שמגיע מההתאחדות.
      </p>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}
      <Section title="באיחור" tasks={overdue} tone="overdue" />
      <Section title="לטיפול עכשיו" tasks={now} tone="now" empty="אין משימות פתוחות להיום." />
      {unknown.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-black">משחקי בית בלי מגרש ידוע · שיבוץ זמני</h2>
          <p className="text-sm text-zinc-600">
            ההתאחדות לא פרסמה מגרש למשחקים האלה. בחרו מגרש זמני כדי שתיפתח משימת כיסוח וסימון.
            כשההתאחדות תעדכן מגרש (או כשיוגדר מגרש במסך המשחקים), המשחק ישובץ לפיו ויוסר מכאן אוטומטית.
          </p>
          <ul className="flex flex-col gap-2">
            {unknown.map((game) => (
              <UnknownVenueRow key={game.slotId} game={game} today={today} />
            ))}
          </ul>
        </section>
      ) : null}
      <Section title="בקרוב" tasks={soon} tone="soon" />
      <Section title="בוצע לאחרונה" tasks={done} tone="done" />
    </AdminShell>
  );
}
