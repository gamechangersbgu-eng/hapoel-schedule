"use client";

// Registers the service worker, and on the public page offers to install the app:
// Android/desktop Chrome get an install button; iPhone gets short "Add to Home Screen" steps.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "hapoel-install-dismissed-v1";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function PwaSetup() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (isStandalone() || readDismissed()) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (isIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time browser check after mount
      setShowIos(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Only on the public pages (parents and players), not on management screens or the TV.
  const publicPage = pathname === "/";
  if (hidden || !publicPage || (!prompt && !showIos)) return null;

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      role="region"
      aria-label="התקנת האפליקציה"
      className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-md rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10 md:bottom-4 print:hidden dark:bg-zinc-900 dark:ring-white/10"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-[#5c0814] dark:text-white">הלו״ז בלחיצה אחת ממסך הבית</p>
          {showIos && !prompt ? (
            <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              לחצו על כפתור השיתוף <span aria-hidden>⎋</span> בתחתית Safari, ואז על
              <span className="font-bold"> &quot;הוסף למסך הבית&quot;</span>.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">מתקינים פעם אחת, והלוח נפתח כמו אפליקציה.</p>
          )}
          <div className="mt-3 flex gap-2">
            {prompt ? (
              <button
                type="button"
                onClick={async () => {
                  await prompt.prompt();
                  await prompt.userChoice.catch(() => null);
                  setPrompt(null);
                  setHidden(true);
                }}
                className="min-h-10 rounded-lg bg-[#c8102e] px-4 text-sm font-black text-white"
              >
                התקנה
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="min-h-10 rounded-lg px-3 text-sm font-bold text-zinc-600 ring-1 ring-zinc-300 dark:text-zinc-300 dark:ring-white/20"
            >
              לא עכשיו
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
