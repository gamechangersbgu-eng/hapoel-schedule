import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { HEBREW_DAY_NAMES } from "@/components/display-utils";
import { requireAdmin } from "@/lib/auth";
import { formatDayMonth } from "@/lib/week";
import { getMaintenanceTasks, type MaintenanceTaskView } from "@/services/notifications/maintenance";
import { israelToday, visibleOpenTasks, weekdayOfISO } from "@/services/notifications/maintenance-rules";
import { markMaintenanceDoneAction, reopenMaintenanceAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "כיסוח וסימון · מצב מנהל" };

function dayLabel(date: string) {
  return `יום ${HEBREW_DAY_NAMES[weekdayOfISO(date)]} ${formatDayMonth(date)}`;
}

function timeLabel(task: MaintenanceTaskView) {
  if (task.kind === "weekly") {
    return task.startTime && task.endTime ? `חלון פנוי ${task.startTime}–${task.endTime}` : null;
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

function TaskCard({ task, tone }: { task: MaintenanceTaskView; tone: "now" | "soon" | "done" }) {
  const time = timeLabel(task);
  const ring = tone === "now" ? "ring-2 ring-[#c8102e]" : "ring-1 ring-zinc-200";
  return (
    <li className={`flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-3 ${ring}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-black">
          {task.pitchName} · {dayLabel(task.date)}
          {task.kind === "weekly" ? (
            <span className="ms-2 rounded-full bg-lime-100 px-2 py-0.5 text-xs font-black text-lime-900">שבועי</span>
          ) : null}
        </p>
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

function Section({ title, tasks, tone, empty }: { title: string; tasks: MaintenanceTaskView[]; tone: "now" | "soon" | "done"; empty?: string }) {
  if (tasks.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-black">{title}</h2>
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

export default async function MaintenancePage() {
  const user = await requireAdmin();
  const today = israelToday();
  const tasks = await getMaintenanceTasks(today);

  const now = visibleOpenTasks(tasks, today);
  const soon = tasks.filter((task) => task.status === "open" && task.showFrom > today);
  const done = tasks.filter((task) => task.status === "done").reverse();

  return (
    <AdminShell user={user} title="כיסוח וסימון מגרשים" current="/admin/maintenance">
      <p className="text-sm text-zinc-600">
        משימה נפתחת יומיים לפני משחק ליגה בבית על וסרמיל 1–3, ופעם בשבוע לוסרמיל 2 בחלון בלי אימונים.
        המגרש נלקח מהשיבוץ במסך המשחקים, ואם אין — משם המגרש שמגיע מההתאחדות.
      </p>
      <Section title="לטיפול עכשיו" tasks={now} tone="now" empty="אין משימות פתוחות להיום." />
      <Section title="בקרוב" tasks={soon} tone="soon" />
      <Section title="בוצע לאחרונה" tasks={done} tone="done" />
    </AdminShell>
  );
}
