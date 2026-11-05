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
};

export type ExternalEventRef = {
  eventType: ExternalEventType;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  pitchCode: PitchCode | null;
};
