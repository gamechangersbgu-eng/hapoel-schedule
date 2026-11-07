import type { PitchCode } from "./pitch";

export const SLOT_KINDS = [
  "training",
  "home_game",
  "away_game",
  "off",
  "camp",
  "other",
] as const;

export type SlotKind = (typeof SLOT_KINDS)[number];

export const EXTERNAL_EVENT_TYPES = [
  "external_activity",
  "driver_assignment",
  "medic_assignment",
] as const;

export type ExternalEventType = (typeof EXTERNAL_EVENT_TYPES)[number];

export type CityRef = {
  id: number;
  name: string;
  travelMinutesFromBeerSheva: number;
  northOfHaderaLine: boolean;
};

/** Values for `slot_game_details.source`. */
export const GAME_DETAIL_SOURCES = {
  IFA_SCRAPER: "ifa_scraper",
  ADMIN: "admin",
  MANUAL_SQLITE: "manual_sqlite",
} as const;

export type GameDetailSource =
  (typeof GAME_DETAIL_SOURCES)[keyof typeof GAME_DETAIL_SOURCES];

/** Payload the IFA scraper upserts (maps to `slots` + `slot_game_details`). */
export type IfaGameUpsert = {
  /** Postgres `teams.id` (map IFA team name via scraper config). */
  teamId: number;
  date: string;
  startTime: string | null;
  gameKind: Extract<SlotKind, "home_game" | "away_game">;
  externalId: string;
  opponent: string | null;
  kickoffTime: string | null;
  cityName: string | null;
  note?: string | null;
};

export type SlotGameDetailsRef = {
  slotId: number;
  gameKind: Extract<SlotKind, "home_game" | "away_game">;
  opponent: string | null;
  pitchCode: PitchCode | null;
  medicId: number | null;
  driverId: number | null;
  cityId: number | null;
  kickoffTime: string | null;
  departureTime: string | null;
  source: GameDetailSource | null;
  externalId: string | null;
};

export type ExternalEventRef = {
  eventType: ExternalEventType;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  pitchCode: PitchCode | null;
};
