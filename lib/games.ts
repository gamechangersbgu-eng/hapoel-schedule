import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  cities as citiesTable,
  db,
  drivers as driversTable,
  medics as medicsTable,
  opponentClubs,
  pitches as pitchesTable,
  slotGameDetails,
  slotTrainingDetails,
  slots,
  teams as teamsTable,
} from "@/lib/db";
import { HOME_GAME_BLOCK_MINUTES, toMinutes, toTime } from "@/lib/pitch-rules";
import { weekDates } from "@/lib/week";

export type GameRow = {
  slotId: number;
  teamId: number;
  teamName: string;
  date: string;
  kind: "home_game" | "away_game";
  kickoff: string | null;
  opponent: string | null;
  pitchId: number | null;
  medicId: number | null;
  cityId: number | null;
  driverId: number | null;
  departureTime: string | null;
  travelMinutes: number | null;
  status: string;
  statusNote: string | null;
  note: string | null;
  source: string | null;
};

export type GamesWeek = {
  dates: string[];
  games: GameRow[];
  teams: { id: number; name: string }[];
  pitches: { id: number; nameHe: string; allowsHomeGames: boolean }[];
  medics: { id: number; name: string; phone: string | null; isActive: boolean }[];
  drivers: { id: number; name: string; phone: string; isActive: boolean }[];
  cities: { id: number; name: string; travelMinutesFromBeerSheva: number; northOfHaderaLine: boolean }[];
  opponentClubs: { name: string; cityId: number | null }[];
  /** Trainings on home-game pitches this week, to warn about overlaps. */
  pitchTrainings: { date: string; pitchId: number; start: number; end: number; teamName: string }[];
};

export async function getGamesWeek(weekStart: string): Promise<GamesWeek> {
  const dates = weekDates(weekStart);
  const [teamRows, pitchRows, medicRows, driverRows, cityRows, clubRows, gameRows, trainingRows] = await Promise.all([
    db.select().from(teamsTable).orderBy(asc(teamsTable.sortOrder)),
    db.select().from(pitchesTable).orderBy(asc(pitchesTable.sortOrder)),
    db.select().from(medicsTable).orderBy(asc(medicsTable.name)),
    db.select().from(driversTable).orderBy(asc(driversTable.name)),
    db.select().from(citiesTable).orderBy(asc(citiesTable.name)),
    db.select({ name: opponentClubs.name, cityId: opponentClubs.cityId }).from(opponentClubs).orderBy(asc(opponentClubs.name)),
    db
      .select({ slot: slots, game: slotGameDetails })
      .from(slots)
      .leftJoin(slotGameDetails, eq(slotGameDetails.slotId, slots.id))
      .where(and(gte(slots.date, dates[0]), lte(slots.date, dates[6]), inArray(slots.type, ["home_game", "away_game"])))
      .orderBy(asc(slots.date), asc(slots.startTime)),
    db
      .select({ slot: slots, training: slotTrainingDetails })
      .from(slots)
      .innerJoin(slotTrainingDetails, eq(slotTrainingDetails.slotId, slots.id))
      .where(and(gte(slots.date, dates[0]), lte(slots.date, dates[6]), eq(slots.status, "active"))),
  ]);
  const teamName = Object.fromEntries(teamRows.map((team) => [team.id, team.name]));

  return {
    dates,
    teams: teamRows.filter((team) => !team.isComments).map((team) => ({ id: team.id, name: team.name })),
    pitches: pitchRows,
    medics: medicRows,
    drivers: driverRows,
    cities: cityRows,
    opponentClubs: clubRows,
    games: gameRows.map(({ slot, game }) => ({
      slotId: slot.id,
      teamId: slot.teamId,
      teamName: teamName[slot.teamId] ?? "",
      date: slot.date,
      kind: slot.type === "away_game" ? "away_game" : "home_game",
      kickoff: game?.kickoffTime || slot.startTime,
      opponent: game?.opponent ?? null,
      pitchId: game?.pitchId ?? null,
      medicId: game?.medicId ?? null,
      cityId: game?.cityId ?? null,
      driverId: game?.driverId ?? null,
      departureTime: game?.departureTime ?? null,
      travelMinutes: game?.travelMinutes ?? null,
      status: slot.status,
      statusNote: slot.statusNote,
      note: slot.note,
      source: game?.source ?? null,
    })),
    pitchTrainings: trainingRows
      .filter(({ slot, training }) => slot.startTime && training.pitchId)
      .map(({ slot, training }) => {
        const start = toMinutes(slot.startTime!);
        return {
          date: slot.date,
          pitchId: training.pitchId!,
          start,
          end: start + (training.durationMinutes ?? 90),
          teamName: teamName[slot.teamId] ?? "",
        };
      }),
  };
}

/** Per-game warnings: missing medic/driver, double bookings, overlaps with trainings. */
export function gameWarnings(week: GamesWeek): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  const active = week.games.filter((game) => game.status !== "cancelled" && game.kickoff);
  const add = (id: number, message: string) => (result[id] = [...(result[id] ?? []), message]);
  const span = (game: GameRow): [number, number] => {
    const kickoff = toMinutes(game.kickoff!);
    const from = game.kind === "away_game" && game.departureTime ? toMinutes(game.departureTime) : kickoff;
    return [from, kickoff + HOME_GAME_BLOCK_MINUTES];
  };
  const overlap = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

  for (const game of active) {
    if (game.kind === "home_game") {
      if (!game.pitchId) add(game.slotId, "לא נבחר מגרש");
      if (!game.medicId) add(game.slotId, "לא שובץ חובש");
    } else {
      if (!game.cityId) add(game.slotId, "לא נבחרה עיר, ולכן אין שעת יציאה");
      if (!game.driverId) add(game.slotId, "לא שובץ נהג");
    }
    for (const other of active) {
      if (other.slotId === game.slotId || other.date !== game.date) continue;
      if (!overlap(span(game), span(other))) continue;
      if (game.medicId && game.medicId === other.medicId) add(game.slotId, `החובש משובץ גם למשחק של ${other.teamName} באותו זמן`);
      if (game.driverId && game.driverId === other.driverId) add(game.slotId, `הנהג משובץ גם למשחק של ${other.teamName} באותו זמן`);
      if (game.kind === "home_game" && other.kind === "home_game" && game.pitchId && game.pitchId === other.pitchId) {
        add(game.slotId, `גם המשחק של ${other.teamName} על אותו מגרש`);
      }
    }
    if (game.kind === "home_game") {
      const others = active.filter((o) => o.kind === "home_game" && o.slotId !== game.slotId && o.date === game.date);
      for (const other of others) {
        if (Math.abs(toMinutes(other.kickoff!) - toMinutes(game.kickoff!)) < 120) {
          add(game.slotId, `פחות משעתיים מהמשחק של ${other.teamName} (${other.kickoff})`);
        }
      }
      if (game.pitchId) {
        const kickoff = toMinutes(game.kickoff!);
        for (const training of week.pitchTrainings) {
          if (training.date === game.date && training.pitchId === game.pitchId && overlap([kickoff, kickoff + HOME_GAME_BLOCK_MINUTES], [training.start, training.end])) {
            add(game.slotId, `חופף לאימון של ${training.teamName} (${toTime(training.start)}) על אותו מגרש`);
          }
        }
      }
    }
  }
  return result;
}
