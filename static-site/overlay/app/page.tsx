"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { EditSlotDialog } from "@/components/EditSlotDialog";
import { ScheduleView, type SyncStatus } from "@/components/ScheduleView";
import {
  ADMIN_KEY,
  applyDiff,
  applyEdits,
  copyPreviousWeek,
  deleteSlot,
  diffEdits,
  emptyEdits,
  exportJson,
  fetchPublishedSchedule,
  fetchSharedEdits,
  getWeekDataFrom,
  hasEdits as hasEditsFn,
  loadEdits,
  parseScheduleFile,
  pushSharedEdits,
  replaceDiff,
  saveSlot,
  seedSchedule,
  sharedEnabled,
  storeEdits,
  type EditsDiff,
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
  const [sync, setSync] = useState<SyncStatus>({ state: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<EditsDiff[]>([]); // changes not yet written to the shared store
  const busy = useRef(false);

  // Pull the latest shared edits (skipped while local changes are waiting to be saved).
  const refresh = useCallback(async () => {
    if (!sharedEnabled() || busy.current || pending.current.length > 0) return;
    try {
      const remote = await fetchSharedEdits();
      if (busy.current || pending.current.length > 0) return;
      setEdits(remote);
      storeEdits(remote);
      setSync((s) => (s.state === "error" || s.state === "loadError" ? { state: "idle" } : s));
    } catch {
      setSync((s) => (s.state === "saving" || s.state === "error" ? s : { state: "loadError" }));
    }
  }, []);

  // Write pending changes: re-read the latest shared data, replay our changes on it, save it for everyone.
  const flush = useCallback(async () => {
    if (!sharedEnabled() || busy.current || pending.current.length === 0) return;
    busy.current = true;
    setSync({ state: "saving" });
    try {
      while (pending.current.length > 0) {
        const batch = pending.current.slice();
        const remote = await fetchSharedEdits();
        const merged = batch.reduce(applyDiff, remote);
        await pushSharedEdits(merged);
        pending.current.splice(0, batch.length);
        if (pending.current.length === 0) {
          setEdits(merged);
          storeEdits(merged);
        }
      }
      setSync({ state: "saved" });
    } catch {
      setSync({ state: "error" });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!sharedEnabled()) return;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

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

  const editsRef = useRef<LocalEdits>(edits);
  editsRef.current = edits;

  const current = useMemo(() => (base ? applyEdits(base, edits) : null), [base, edits]);
  const data = useMemo(() => (current ? getWeekDataFrom(current, week) : null), [current, week]);

  const commit = useCallback(
    (next: LocalEdits, diff?: EditsDiff) => {
      setEdits(next);
      storeEdits(next);
      pending.current.push(diff ?? diffEdits(editsRef.current, next));
      editsRef.current = next;
      void flush();
    },
    [flush],
  );

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
    setMessage(sharedEnabled() ? null : "נשמר");
    return null;
  }

  function handleDelete(id: number) {
    commit(deleteSlot(edits, id));
    setMessage(sharedEnabled() ? null : "האימון נמחק");
  }

  function handleCopy() {
    const result = copyPreviousWeek(current!, edits, data!.weekStart);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    commit(result.edits);
    setMessage(sharedEnabled() ? null : "השבוע הקודם הועתק");
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
      // Imported file becomes the edit layer on top of the current base (and replaces the shared data).
      const importedIds = new Set(parsed.slots.map((s) => s.id));
      const next = {
        upserts: parsed.slots,
        deletedIds: base!.slots.filter((s) => !importedIds.has(s.id)).map((s) => s.id),
      };
      commit(next, replaceDiff(next));
      setMessage("הקובץ יובא");
    } catch {
      setMessage("הקובץ לא תקין");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleReset() {
    if (!window.confirm("לאפס את כל השינויים ולחזור לנתוני ברירת המחדל? הפעולה משפיעה על כל המשתמשים.")) return;
    commit(emptyEdits(), replaceDiff(emptyEdits()));
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
        sync={sync}
        onRetry={() => void flush()}
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
