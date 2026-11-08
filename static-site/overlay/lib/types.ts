export type SlotDTO = {
  id: number;
  teamId: number;
  date: string;
  endDate: string | null;
  startTime: string | null;
  /** Optional end of the time range (HH:MM). Older items only have startTime. */
  endTime?: string | null;
  type: string;
  note: string | null;
  /** Same optional fields as the app (cancellation / substitute coach); not edited on the static site. */
  status?: string;
  statusNote?: string | null;
  substituteName?: string | null;
  place?: string | null;
  opponent?: string | null;
  departureTime?: string | null;
};

export type TeamDTO = {
  id: number;
  name: string;
  sortOrder: number;
  isComments: boolean;
};

export type WeekData = {
  clubName: string;
  seasonStartDate: string;
  weekStart: string;
  weekNumber: number;
  dates: string[];
  teams: TeamDTO[];
  slots: SlotDTO[];
};
