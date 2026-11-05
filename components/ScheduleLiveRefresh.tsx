"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type ScheduleLiveRefreshProps = {
  initialVersion: number;
  /** Poll interval in ms (default 45s for kiosk/TV). */
  intervalMs?: number;
};

/**
 * Polls schedule revision and refreshes server data when scraper/admin/sync bumps version.
 */
export function ScheduleLiveRefresh({
  initialVersion,
  intervalMs = 45_000,
}: ScheduleLiveRefreshProps) {
  const router = useRouter();
  const versionRef = useRef(initialVersion);

  useEffect(() => {
    versionRef.current = initialVersion;
  }, [initialVersion]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/schedule/revision", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { version: number };
        if (body.version > versionRef.current) {
          versionRef.current = body.version;
          router.refresh();
        }
      } catch {
        // ignore transient network errors on kiosk
      }
    }

    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
