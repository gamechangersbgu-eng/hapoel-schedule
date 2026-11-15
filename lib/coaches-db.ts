import "server-only";
import { asc } from "drizzle-orm";
import { db, staff, staffUnavailability, staffWorkDays, teamCoaches } from "@/lib/db";
import type { CoachInfo } from "@/lib/coaches";

export async function getCoaches(): Promise<CoachInfo[]> {
  const [people, links, days, absences] = await Promise.all([
    db.select().from(staff).orderBy(asc(staff.displayName)),
    db.select().from(teamCoaches),
    db.select().from(staffWorkDays),
    db.select().from(staffUnavailability).orderBy(asc(staffUnavailability.startDate)),
  ]);
  return people.map((person) => ({
    id: person.id,
    name: person.displayName,
    phone: person.phone,
    email: person.email,
    roleLabel: person.roleLabel,
    receivesAllUpdates: person.receivesAllUpdates,
    teamIds: links.filter((link) => link.staffId === person.id).map((link) => link.teamId),
    assistantTeamIds: links.filter((link) => link.staffId === person.id && !link.isPrimary).map((link) => link.teamId),
    workDays: days.filter((day) => day.staffId === person.id).map((day) => day.weekday).sort(),
    absences: absences
      .filter((item) => item.staffId === person.id)
      .map((item) => ({
        id: item.id,
        type: item.unavailabilityType,
        startDate: item.startDate,
        endDate: item.endDate,
        note: item.note,
      })),
  }));
}
