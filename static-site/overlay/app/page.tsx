"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { EditSlotDialog } from "@/components/EditSlotDialog";
import { ScheduleView } from "@/components/ScheduleView";
import {
  ADMIN_KEY,
  applyEdits,
  copyPreviousWeek,
  deleteSlot,
  emptyEdits,
  exportJson,
  fetchPublishedSchedule,
  getWeekDataFrom,
  hasEdits as hasEditsFn,
  loadEdits,
  parseScheduleFile,
  saveSlot,
  seedSchedule,
  storeEdits,
  type LocalEdits,
  type ScheduleFile,
  type SlotInput,
} from "@/lib/static-schedule";

type DialogState = { teamId: number; date: string; slotId?: number };

function Schedule() {
  const week = useSearchParams().get("week");

  const [base, setBase] = useState<ScheduleFile | null>(null);
  const [edits, setEdits] = useState<LocalEdits>(emptyEdits);
  const [admin, setAdmin] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEdits(loadEdits());
    try {
      setAdmin(window.localStorage.getItem(ADMIN_KEY) === "1");
    } catch {
      /* ignore */
    }
    let cancelled = false;
    fetchPublishedSchedule().then((published) => {
      if (!cancelled) setBase(published ?? seedSchedule());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(() => (base ? applyEdits(base, edits) : null), [base, edits]);
  const data = useMemo(() => (current ? getWeekDataFrom(current, week) : null), [current, week]);

  const commit = useCallback((next: LocalEdits) => {
    setEdits(next);
    storeEdits(next);
  }, []);

  function setAdminMode(on: boolean) {
    setAdmin(on);
    setDialog(null);
    setMessage(null);
    try {
      if (on) window.localStorage.setItem(ADMIN_KEY, "1");
      else window.localStorage.removeItem(ADMIN_KEY);
    } catch {
      /* ignore */
    }
  }

  if (!current || !data) return <Loading />;

  const dialogTeam = dialog ? current.teams.find((t) => t.id === dialog.teamId) : undefined;

  function handleSave(input: SlotInput): string | null {
    const result = saveSlot(current!, edits, input);
    if ("error" in result) return result.error;
    commit(result.edits);
    setDialog(null);
    setMessage("נשמר");
    return null;
  }

  function handleDelete(id: number) {
    commit(deleteSlot(edits, id));
    setMessage("האימון נמחק");
  }

  function handleCopy() {
    const result = copyPreviousWeek(current!, edits, data!.weekStart);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    commit(result.edits);
    setMessage("השבוע הקודם הועתק");
  }

  function handleExport() {
    const blob = new Blob([exportJson(current!)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedule-data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("הקובץ schedule-data.json הורד. כדי לפרסם: ראו README.");
  }

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(exportJson(current!));
      setMessage("ה-JSON הועתק ללוח");
    } catch {
      setMessage("לא הצלחתי להעתיק ללוח. השתמשו ב״ייצוא״ להורדת הקובץ.");
    }
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = parseScheduleFile(JSON.parse(await file.text()));
      if (!parsed) throw new Error("bad");
      // Imported file becomes the edit layer on top of the current base.
      const importedIds = new Set(parsed.slots.map((s) => s.id));
      commit({
        upserts: parsed.slots,
        deletedIds: base!.slots.filter((s) => !importedIds.has(s.id)).map((s) => s.id),
      });
      setMessage("הקובץ יובא");
    } catch {
      setMessage("הקובץ לא תקין");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleReset() {
    if (!window.confirm("לאפס את כל השינויים המקומיים ולחזור לנתוני ברירת המחדל?")) return;
    commit(emptyEdits());
    setMessage("השינויים אופסו");
  }

  return (
    <div className="min-h-full">
      <AppHeader
        clubName={data.clubName}
        weekNumber={data.weekNumber}
        weekStart={data.weekStart}
        basePath="/"
      >
        {admin ? (
          <button
            type="button"
            onClick={() => setAdminMode(false)}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10"
          >
            יציאה ממצב מנהל
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAdminMode(true)}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white/90 hover:bg-white/10"
          >
            כניסת מנהל
          </button>
        )}
      </AppHeader>
      <ScheduleView
        data={data}
        admin={admin}
        hasEdits={hasEditsFn(edits)}
        message={message}
        onCellClick={(teamId, date, slotId) => {
          setMessage(null);
          setDialog({ teamId, date, slotId });
        }}
        onCopyPreviousWeek={handleCopy}
        onExport={handleExport}
        onCopyJson={handleCopyJson}
        onImport={() => fileInput.current?.click()}
        onReset={handleReset}
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="import-input"
        onChange={(event) => void handleImportFile(event.target.files?.[0])}
      />
      {admin && dialog && dialogTeam ? (
        <EditSlotDialog
          key={`${dialog.teamId}-${dialog.date}-${dialog.slotId ?? "new"}`}
          team={dialogTeam}
          date={dialog.date}
          weekStart={data.weekStart}
          slots={data.slots}
          initialSlotId={dialog.slotId}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-full items-center justify-center text-sm font-bold text-[#8e0b20]">
      טוען לוח אימונים...
    </div>
  );
}

export default function HomePage() {
  // Render client-side only: the demo data depends on the visitor's current date.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Suspense fallback={<Loading />}>{mounted ? <Schedule /> : <Loading />}</Suspense>
  );
}
