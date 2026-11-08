// Away-game departure time, per the club spec:
// - נוער, נערים א–ג: arrive 1.5 hours before kick-off; everyone else: 1 hour before.
// - Trips from the Haifa line northwards: add a 30-minute break.
// - Midweek trips (Sunday–Thursday): add 30 minutes for traffic.
import { toMinutes, toTime } from "@/lib/pitch-rules";

export function arrivalMinutesBefore(teamName: string) {
  return teamName.startsWith("נוער") || teamName.startsWith("נערים") ? 90 : 60;
}

export function isMidweek(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, m - 1, d, 12).getDay();
  return weekday >= 0 && weekday <= 4;
}

export type DepartureBreakdown = {
  departure: string;
  arriveBy: string;
  parts: { label: string; minutes: number }[];
};

export function departureFor(opts: {
  teamName: string;
  date: string;
  kickoff: string;
  travelMinutes: number;
  north: boolean;
}): DepartureBreakdown {
  const before = arrivalMinutesBefore(opts.teamName);
  const parts = [
    { label: `הגעה ${before === 90 ? "שעה וחצי" : "שעה"} לפני השריקה`, minutes: before },
    { label: "זמן נסיעה מבאר שבע", minutes: opts.travelMinutes },
  ];
  if (opts.north) parts.push({ label: "הפסקה (חיפה וצפונה)", minutes: 30 });
  if (isMidweek(opts.date)) parts.push({ label: "פקקים באמצע שבוע", minutes: 30 });
  const kickoff = toMinutes(opts.kickoff);
  const total = parts.reduce((sum, part) => sum + part.minutes, 0);
  return {
    departure: toTime(Math.max(0, kickoff - total)),
    arriveBy: toTime(kickoff - before),
    parts,
  };
}
