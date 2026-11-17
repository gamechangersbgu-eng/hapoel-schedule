import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import {
  adminUsers,
  db,
  injuries,
  injuryStatusChanges,
  physioSessions,
  players,
  staff,
  teamCoaches,
  teams,
} from "@/lib/db";
import { isInjuryStatus, isSessionStatus, type InjuryStatus, type SessionStatus } from "@/lib/injuries";

export type InjuryRow = {
  id: number;
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  coachStaffId: number | null;
  coachName: string | null;
  injuredAt: string;
  bodyPart: string;
  status: InjuryStatus;
  expectedReturn: string | null;
  note: string | null;
  closedAt: string | null;
  /** Next scheduled treatment from today on, if any. */
  nextSession: { date: string; startTime: string } | null;
};

function asStatus(value: string): InjuryStatus {
  return isInjuryStatus(value) ? value : "injured";
}

function asSessionStatus(value: string): SessionStatus {
  return isSessionStatus(value) ? value : "scheduled";
}

/** Injuries with player, team and coach. Open only unless includeClosed. coachStaffId → that coach's players only. */
export async function listInjuries(options: {
  today: string;
  includeClosed?: boolean;
  coachStaffId?: number;
  teamId?: number;
}): Promise<InjuryRow[]> {
  const filters = [
    options.includeClosed ? undefined : isNull(injuries.closedAt),
    options.coachStaffId != null ? eq(players.coachStaffId, options.coachStaffId) : undefined,
    options.teamId != null ? eq(players.teamId, options.teamId) : undefined,
  ].filter((value) => value !== undefined);

  const rows = await db
    .select({
      id: injuries.id,
      playerId: players.id,
      playerName: players.displayName,
      teamId: teams.id,
      teamName: teams.name,
      coachStaffId: players.coachStaffId,
      coachName: staff.displayName,
      injuredAt: injuries.injuredAt,
      bodyPart: injuries.bodyPart,
      status: injuries.status,
      expectedReturn: injuries.expectedReturn,
      note: injuries.note,
      closedAt: injuries.closedAt,
    })
    .from(injuries)
    .innerJoin(players, eq(injuries.playerId, players.id))
    .innerJoin(teams, eq(players.teamId, teams.id))
    .leftJoin(staff, eq(players.coachStaffId, staff.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(injuries.injuredAt));

  const ids = rows.map((row) => row.id);
  const upcoming = ids.length
    ? await db
        .select({ injuryId: physioSessions.injuryId, date: physioSessions.date, startTime: physioSessions.startTime })
        .from(physioSessions)
        .where(
          and(
            inArray(physioSessions.injuryId, ids),
            eq(physioSessions.status, "scheduled"),
            gte(physioSessions.date, options.today),
          ),
        )
        .orderBy(asc(physioSessions.date), asc(physioSessions.startTime))
    : [];

  return rows.map((row) => {
    const next = upcoming.find((session) => session.injuryId === row.id);
    return {
      ...row,
      status: asStatus(row.status),
      nextSession: next ? { date: next.date, startTime: next.startTime } : null,
    };
  });
}

export type InjuryChange = {
  id: number;
  fromStatus: InjuryStatus | null;
  toStatus: InjuryStatus;
  at: string;
  changedByName: string;
  note: string | null;
};

export type SessionRow = {
  id: number;
  injuryId: number;
  playerName: string;
  teamName: string;
  bodyPart: string;
  physioUserId: number | null;
  physioName: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: SessionStatus;
  note: string | null;
};

const sessionColumns = {
  id: physioSessions.id,
  injuryId: physioSessions.injuryId,
  playerName: players.displayName,
  teamName: teams.name,
  bodyPart: injuries.bodyPart,
  physioUserId: physioSessions.physioUserId,
  physioName: physioSessions.physioName,
  date: physioSessions.date,
  startTime: physioSessions.startTime,
  durationMinutes: physioSessions.durationMinutes,
  status: physioSessions.status,
  note: physioSessions.note,
};

function sessionQuery() {
  return db
    .select(sessionColumns)
    .from(physioSessions)
    .innerJoin(injuries, eq(physioSessions.injuryId, injuries.id))
    .innerJoin(players, eq(injuries.playerId, players.id))
    .innerJoin(teams, eq(players.teamId, teams.id));
}

/** History and treatments of one injury (managers and physio only). */
export async function getInjuryDetail(injuryId: number) {
  const [changes, sessions] = await Promise.all([
    db
      .select()
      .from(injuryStatusChanges)
      .where(eq(injuryStatusChanges.injuryId, injuryId))
      .orderBy(desc(injuryStatusChanges.at), desc(injuryStatusChanges.id)),
    sessionQuery()
      .where(eq(physioSessions.injuryId, injuryId))
      .orderBy(desc(physioSessions.date), desc(physioSessions.startTime)),
  ]);
  return {
    changes: changes.map(
      (change): InjuryChange => ({
        id: change.id,
        fromStatus: change.fromStatus && isInjuryStatus(change.fromStatus) ? change.fromStatus : null,
        toStatus: asStatus(change.toStatus),
        at: change.at,
        changedByName: change.changedByName,
        note: change.note,
      }),
    ),
    sessions: sessions.map((session): SessionRow => ({ ...session, status: asSessionStatus(session.status) })),
  };
}

/** Treatments between two dates (inclusive), for the physio week view. */
export async function listSessionsBetween(from: string, to: string): Promise<SessionRow[]> {
  const rows = await sessionQuery()
    .where(and(gte(physioSessions.date, from), lte(physioSessions.date, to)))
    .orderBy(asc(physioSessions.date), asc(physioSessions.startTime));
  return rows.map((row) => ({ ...row, status: asSessionStatus(row.status) }));
}

/** Every non-cancelled treatment of one physio on one day (clash check). */
export async function sessionsOfPhysioOn(physioUserId: number, date: string) {
  const rows = await db
    .select()
    .from(physioSessions)
    .where(and(eq(physioSessions.physioUserId, physioUserId), eq(physioSessions.date, date)));
  return rows.map((row) => ({ ...row, status: asSessionStatus(row.status) }));
}

export type PlayerOption = {
  id: number;
  name: string;
  teamId: number;
  teamName: string;
  coachStaffId: number | null;
  birthDate: string | null;
  hasOpenInjury: boolean;
};

/** Active players grouped in team order, for the injury form and the players page. */
export async function listPlayers(): Promise<PlayerOption[]> {
  const [rows, open] = await Promise.all([
    db
      .select({
        id: players.id,
        name: players.displayName,
        teamId: teams.id,
        teamName: teams.name,
        coachStaffId: players.coachStaffId,
        birthDate: players.birthDate,
      })
      .from(players)
      .innerJoin(teams, eq(players.teamId, teams.id))
      .where(eq(players.isActive, true))
      .orderBy(asc(teams.sortOrder), asc(players.sortOrder), asc(players.displayName)),
    db.select({ playerId: injuries.playerId }).from(injuries).where(isNull(injuries.closedAt)),
  ]);
  const injured = new Set(open.map((row) => row.playerId));
  return rows.map((row) => ({ ...row, hasOpenInjury: injured.has(row.id) }));
}

export type CoachOption = { staffId: number; name: string; teamIds: number[] };

/** Staff people linked to at least one team as coach. */
export async function listCoachOptions(): Promise<CoachOption[]> {
  const rows = await db
    .select({ staffId: staff.id, name: staff.displayName, teamId: teamCoaches.teamId })
    .from(teamCoaches)
    .innerJoin(staff, eq(teamCoaches.staffId, staff.id))
    .where(isNotNull(teamCoaches.staffId))
    .orderBy(asc(staff.displayName));
  const byId = new Map<number, CoachOption>();
  for (const row of rows) {
    const coach = byId.get(row.staffId) ?? { staffId: row.staffId, name: row.name, teamIds: [] };
    if (!coach.teamIds.includes(row.teamId)) coach.teamIds.push(row.teamId);
    byId.set(row.staffId, coach);
  }
  return [...byId.values()];
}

/** Active physio logins, for the "who treats" select. */
export async function listPhysioUsers() {
  return db
    .select({ id: adminUsers.id, name: adminUsers.displayName })
    .from(adminUsers)
    .where(and(eq(adminUsers.role, "physio"), eq(adminUsers.isActive, true)))
    .orderBy(asc(adminUsers.displayName));
}
