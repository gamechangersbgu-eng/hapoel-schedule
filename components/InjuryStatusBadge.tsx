import { INJURY_STATUS_LABELS, type InjuryStatus } from "@/lib/injuries";

const COLORS: Record<InjuryStatus, string> = {
  injured: "bg-red-100 text-red-800 ring-red-200",
  treatment: "bg-amber-100 text-amber-900 ring-amber-200",
  gradual_return: "bg-sky-100 text-sky-900 ring-sky-200",
  fit: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

export function InjuryStatusBadge({ status }: { status: InjuryStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ${COLORS[status]}`}>
      {INJURY_STATUS_LABELS[status]}
    </span>
  );
}

/** "17.11" from YYYY-MM-DD (empty for no date). */
export function shortDate(iso: string | null) {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}.${m}`;
}
